import { randomUUID } from 'node:crypto'
import type { ExecuteValues } from 'mysql2'
import { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { Request } from 'express'
import { pool } from '../db/pool.js'
import { HttpError } from '../errors.js'
import { TaskInput } from '../schemas.js'
import { Role } from '../types.js'

export interface UserIdentity {
  id: string
  role: Role
}

interface TaskRow extends RowDataPacket {
  id: string
  title: string
  description: string
  status: string
  priority: string
  category: string
  due_date: string | null
  completed_at: string | null
  created_by: string
  assigned_to: string | null
  created_at: string
  updated_at: string
}

interface ChildRow extends RowDataPacket {
  id: string
  task_id: string
  title?: string
  is_done: number
  position?: number
  follow_up_date?: string
  note?: string
}

export interface TaskDto {
  id: string
  title: string
  description: string
  status: TaskInput['status']
  priority: TaskInput['priority']
  category: string
  dueDate: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
  assignedTo: string | null
  subtasks: { id: string; title: string; done: boolean }[]
  followUps: { id: string; date: string; note: string; completed: boolean }[]
}

export function visibility(user: UserIdentity, alias = 't') {
  return user.role === 'admin' || user.role === 'manager'
    ? { clause: '1 = 1', values: [] as ExecuteValues[] }
    : { clause: `(${alias}.created_by = ? OR ${alias}.assigned_to = ?)`, values: [user.id, user.id] }
}

export async function assertTaskAccess(
  taskId: string,
  user: UserIdentity,
  connection: PoolConnection | typeof pool = pool,
) {
  const scope = visibility(user)
  const [rows] = await connection.execute<(RowDataPacket & { id: string })[]>(
    `SELECT t.id FROM tasks t WHERE t.id = ? AND t.deleted_at IS NULL AND ${scope.clause} LIMIT 1`,
    [taskId, ...scope.values],
  )
  if (!rows[0]) throw new HttpError(404, 'TASK_NOT_FOUND', 'Task was not found.')
}

export async function resolveCategoryId(name: string, userId: string, connection: PoolConnection): Promise<string> {
  const [rows] = await connection.execute<(RowDataPacket & { id: string })[]>(
    'SELECT id FROM categories WHERE name = ? LIMIT 1',
    [name],
  )
  const existing = rows[0]
  if (existing) return existing.id
  const id = randomUUID()
  try {
    await connection.execute('INSERT INTO categories (id, name, is_builtin, created_by) VALUES (?, ?, FALSE, ?)', [
      id,
      name,
      userId,
    ])
    return id
  } catch (error) {
    const [afterRace] = await connection.execute<(RowDataPacket & { id: string })[]>(
      'SELECT id FROM categories WHERE name = ? LIMIT 1',
      [name],
    )
    if (afterRace[0]) return afterRace[0].id
    throw error
  }
}

async function writeChildren(connection: PoolConnection, taskId: string, input: TaskInput) {
  for (let index = 0; index < input.subtasks.length; index += 1) {
    const subtask = input.subtasks[index]
    await connection.execute('INSERT INTO subtasks (id, task_id, title, is_done, position) VALUES (?, ?, ?, ?, ?)', [
      randomUUID(),
      taskId,
      subtask.title,
      subtask.done,
      index,
    ])
  }
  for (const followUp of input.followUps) {
    await connection.execute(
      'INSERT INTO follow_ups (id, task_id, follow_up_date, note, is_done) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), taskId, followUp.date, followUp.note, followUp.completed],
    )
  }
}

async function resolveAssignee(
  user: UserIdentity,
  assignedTo: string | null | undefined,
  taskId?: string,
): Promise<string | null> {
  if (user.role !== 'staff') return assignedTo ?? null
  if (!taskId) {
    if (assignedTo) throw new HttpError(403, 'FORBIDDEN', 'Only managers and admins can assign tasks.')
    return null
  }
  const [rows] = await pool.execute<(RowDataPacket & { assigned_to: string | null })[]>(
    'SELECT assigned_to FROM tasks WHERE id = ? AND deleted_at IS NULL',
    [taskId],
  )
  const current = rows[0]?.assigned_to ?? null
  if (assignedTo !== undefined && assignedTo !== current) {
    throw new HttpError(403, 'FORBIDDEN', 'Only managers and admins can change task assignments.')
  }
  return current
}

export async function createTasksBatch(inputs: TaskInput[], user: UserIdentity): Promise<TaskDto[]> {
  const assignments: (string | null)[] = []
  for (const input of inputs) {
    const assignedTo = await resolveAssignee(user, input.assignedTo)
    if (assignedTo) await assertActiveUser(assignedTo)
    assignments.push(assignedTo)
  }
  const ids = inputs.map(() => randomUUID())
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    for (let index = 0; index < inputs.length; index += 1) {
      const input = inputs[index]
      const categoryId = await resolveCategoryId(input.category, user.id, connection)
      await connection.execute(
        `INSERT INTO tasks (id, title, description, status, priority, category_id, due_date, completed_at, created_by, assigned_to)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ids[index],
          input.title,
          input.description,
          input.status,
          input.priority,
          categoryId,
          input.dueDate,
          input.status === 'completed' ? new Date() : null,
          user.id,
          assignments[index],
        ],
      )
      await writeChildren(connection, ids[index], input)
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  const created = await Promise.all(ids.map((id) => getTask(id, user)))
  return created.filter((task): task is TaskDto => task !== null)
}

export async function createTask(input: TaskInput, user: UserIdentity): Promise<TaskDto> {
  const [created] = await createTasksBatch([input], user)
  if (!created) throw new HttpError(500, 'TASK_CREATE_FAILED', 'Task could not be created.')
  return created
}

export async function updateTask(taskId: string, input: TaskInput, user: UserIdentity): Promise<TaskDto> {
  await assertTaskAccess(taskId, user)
  const assignedTo = await resolveAssignee(user, input.assignedTo, taskId)
  if (assignedTo) await assertActiveUser(assignedTo)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await assertTaskAccess(taskId, user, connection)
    const categoryId = await resolveCategoryId(input.category, user.id, connection)
    await connection.execute(
      `UPDATE tasks
       SET title = ?, description = ?, status = ?, priority = ?, category_id = ?, due_date = ?,
           completed_at = ?, assigned_to = ?, updated_at = UTC_TIMESTAMP(3)
       WHERE id = ? AND deleted_at IS NULL`,
      [
        input.title,
        input.description,
        input.status,
        input.priority,
        categoryId,
        input.dueDate,
        input.status === 'completed' ? new Date() : null,
        assignedTo,
        taskId,
      ],
    )
    await connection.execute('DELETE FROM subtasks WHERE task_id = ?', [taskId])
    await connection.execute('DELETE FROM follow_ups WHERE task_id = ?', [taskId])
    await writeChildren(connection, taskId, input)
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  return (await getTask(taskId, user))!
}

async function assertActiveUser(id: string): Promise<void> {
  const [rows] = await pool.execute<(RowDataPacket & { id: string })[]>(
    'SELECT id FROM users WHERE id = ? AND is_active = TRUE LIMIT 1',
    [id],
  )
  if (!rows[0]) throw new HttpError(400, 'INVALID_ASSIGNEE', 'Assigned user is unavailable.')
}

async function detailsForRows(rows: TaskRow[]): Promise<TaskDto[]> {
  if (rows.length === 0) return []
  const ids = rows.map((row) => row.id)
  const placeholders = ids.map(() => '?').join(', ')
  const [subtaskRows] = await pool.execute<ChildRow[]>(
    `SELECT id, task_id, title, is_done, position FROM subtasks WHERE task_id IN (${placeholders}) ORDER BY position, id`,
    ids,
  )
  const [followUpRows] = await pool.execute<ChildRow[]>(
    `SELECT id, task_id, follow_up_date, note, is_done FROM follow_ups WHERE task_id IN (${placeholders}) ORDER BY follow_up_date, id`,
    ids,
  )
  const subtasks = new Map<string, TaskDto['subtasks']>()
  const followUps = new Map<string, TaskDto['followUps']>()
  for (const row of subtaskRows) {
    const children = subtasks.get(row.task_id) ?? []
    children.push({ id: row.id, title: row.title ?? '', done: Boolean(row.is_done) })
    subtasks.set(row.task_id, children)
  }
  for (const row of followUpRows) {
    const children = followUps.get(row.task_id) ?? []
    children.push({
      id: row.id,
      date: row.follow_up_date ?? '',
      note: row.note ?? '',
      completed: Boolean(row.is_done),
    })
    followUps.set(row.task_id, children)
  }
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as TaskDto['status'],
    priority: row.priority as TaskDto['priority'],
    category: row.category,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    subtasks: subtasks.get(row.id) ?? [],
    followUps: followUps.get(row.id) ?? [],
  }))
}

const taskSelect = `
  SELECT t.id, t.title, t.description, t.status, t.priority, c.name AS category, t.due_date,
         t.completed_at, t.created_by, t.assigned_to, t.created_at, t.updated_at
  FROM tasks t JOIN categories c ON c.id = t.category_id
`

export async function getTask(taskId: string, user: UserIdentity): Promise<TaskDto | null> {
  const scope = visibility(user)
  const [rows] = await pool.execute<TaskRow[]>(
    `${taskSelect} WHERE t.id = ? AND t.deleted_at IS NULL AND ${scope.clause} LIMIT 1`,
    [taskId, ...scope.values],
  )
  return (await detailsForRows(rows))[0] ?? null
}

export interface TaskQuery {
  page: number
  pageSize: number
  search?: string
  status?: TaskInput['status']
  priority?: TaskInput['priority']
  category?: string
  when?: 'overdue' | 'today' | 'upcoming'
  sort: 'newest' | 'oldest' | 'due' | 'priority' | 'alpha'
}

export async function listTasks(query: TaskQuery, user: UserIdentity) {
  const scope = visibility(user)
  const conditions = ['t.deleted_at IS NULL', scope.clause]
  const values: ExecuteValues[] = [...scope.values]
  if (query.status) {
    conditions.push('t.status = ?')
    values.push(query.status)
  }
  if (query.priority) {
    conditions.push('t.priority = ?')
    values.push(query.priority)
  }
  if (query.category) {
    conditions.push('c.name = ?')
    values.push(query.category)
  }
  if (query.when === 'overdue') conditions.push("t.status <> 'completed' AND t.due_date < UTC_DATE()")
  if (query.when === 'today') conditions.push("t.status <> 'completed' AND t.due_date = UTC_DATE()")
  if (query.when === 'upcoming') conditions.push("t.status <> 'completed' AND t.due_date > UTC_DATE()")
  if (query.search) {
    const search = query.search.trim().toLowerCase()
    conditions.push(`(
      LOCATE(?, LOWER(t.title)) > 0 OR LOCATE(?, LOWER(t.description)) > 0 OR
      LOCATE(?, LOWER(c.name)) > 0 OR
      LOCATE(?, LOWER(t.status)) > 0 OR LOCATE(?, LOWER(t.priority)) > 0 OR
      LOCATE(?, LOWER(t.due_date)) > 0 OR
      EXISTS (SELECT 1 FROM subtasks s WHERE s.task_id = t.id AND LOCATE(?, LOWER(s.title)) > 0) OR
      EXISTS (SELECT 1 FROM follow_ups f WHERE f.task_id = t.id AND
        (LOCATE(?, LOWER(f.note)) > 0 OR LOCATE(?, LOWER(f.follow_up_date)) > 0))
    )`)
    values.push(...Array.from({ length: 9 }, () => search))
  }
  const where = conditions.join(' AND ')
  const sortColumns: Record<TaskQuery['sort'], string> = {
    newest: 't.created_at DESC',
    oldest: 't.created_at ASC',
    due: 't.due_date IS NULL ASC, t.due_date ASC, t.created_at DESC',
    priority: "FIELD(t.priority, 'urgent', 'high', 'medium', 'low'), t.created_at DESC",
    alpha: 't.title ASC',
  }
  const [countRows] = await pool.execute<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM tasks t JOIN categories c ON c.id = t.category_id WHERE ${where}`,
    values,
  )
  const pageValues = [...values, query.pageSize, (query.page - 1) * query.pageSize]
  const [rows] = await pool.execute<TaskRow[]>(
    `${taskSelect} WHERE ${where} ORDER BY ${sortColumns[query.sort]} LIMIT ? OFFSET ?`,
    pageValues,
  )
  return {
    tasks: await detailsForRows(rows),
    total: Number(countRows[0]?.total ?? 0),
    page: query.page,
    pageSize: query.pageSize,
  }
}

export async function softDeleteTask(taskId: string, user: UserIdentity): Promise<void> {
  const scope = visibility(user)
  const [result] = await pool.execute(
    `UPDATE tasks t SET deleted_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3)
     WHERE t.id = ? AND t.deleted_at IS NULL AND ${scope.clause}`,
    [taskId, ...scope.values],
  )
  if ('affectedRows' in result && result.affectedRows === 0)
    throw new HttpError(404, 'TASK_NOT_FOUND', 'Task was not found.')
}

export async function setTaskComplete(taskId: string, completed: boolean, user: UserIdentity): Promise<TaskDto> {
  const scope = visibility(user)
  const [result] = await pool.execute(
    `UPDATE tasks t SET status = ?, completed_at = ?, updated_at = UTC_TIMESTAMP(3)
     WHERE t.id = ? AND t.deleted_at IS NULL AND ${scope.clause}`,
    [completed ? 'completed' : 'todo', completed ? new Date() : null, taskId, ...scope.values],
  )
  if ('affectedRows' in result && result.affectedRows === 0)
    throw new HttpError(404, 'TASK_NOT_FOUND', 'Task was not found.')
  return (await getTask(taskId, user))!
}

export async function rescheduleTask(taskId: string, dueDate: string | null, user: UserIdentity): Promise<TaskDto> {
  const scope = visibility(user)
  const [result] = await pool.execute(
    `UPDATE tasks t SET due_date = ?, updated_at = UTC_TIMESTAMP(3)
     WHERE t.id = ? AND t.deleted_at IS NULL AND ${scope.clause}`,
    [dueDate, taskId, ...scope.values],
  )
  if ('affectedRows' in result && result.affectedRows === 0)
    throw new HttpError(404, 'TASK_NOT_FOUND', 'Task was not found.')
  return (await getTask(taskId, user))!
}

export async function duplicateTask(taskId: string, user: UserIdentity): Promise<TaskDto> {
  const source = await getTask(taskId, user)
  if (!source) throw new HttpError(404, 'TASK_NOT_FOUND', 'Task was not found.')
  const input: TaskInput = {
    title: `${source.title} (copy)`.slice(0, 200),
    description: source.description,
    status: 'todo',
    priority: source.priority,
    category: source.category,
    dueDate: source.dueDate,
    assignedTo: user.role === 'staff' ? null : source.assignedTo,
    subtasks: source.subtasks.map(({ title }) => ({ title, done: false })),
    followUps: source.followUps.map(({ date, note }) => ({ date, note, completed: false })),
  }
  return createTask(input, user)
}

export async function listVisibleTaskIds(user: UserIdentity): Promise<string[]> {
  const scope = visibility(user)
  const [rows] = await pool.execute<(RowDataPacket & { id: string })[]>(
    `SELECT t.id FROM tasks t WHERE t.deleted_at IS NULL AND ${scope.clause}`,
    scope.values,
  )
  return rows.map((row) => row.id)
}

export async function getTaskForRequest(request: Request, taskId: string): Promise<TaskDto> {
  const task = await getTask(taskId, request.user!)
  if (!task) throw new HttpError(404, 'TASK_NOT_FOUND', 'Task was not found.')
  return task
}
