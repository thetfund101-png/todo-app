import { randomUUID } from 'node:crypto'
import { Router, Request } from 'express'
import { RowDataPacket } from 'mysql2'
import type { ExecuteValues } from 'mysql2'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { HttpError, asyncRoute } from '../errors.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js'
import { followUpSchema, isoDateSchema, taskInputSchema, uuidSchema } from '../schemas.js'
import { writeAuditLog } from '../services/audit.js'
import { verifyPassword } from '../security/password.js'
import {
  assertTaskAccess,
  createTask,
  duplicateTask,
  getTaskForRequest,
  listTasks,
  rescheduleTask,
  setTaskComplete,
  softDeleteTask,
  TaskDto,
  TaskQuery,
  updateTask,
} from '../services/tasks.js'

const router = Router()
router.use(requireAuth)

const taskParams = z.object({ taskId: uuidSchema }).strict()
const childParams = z.object({ taskId: uuidSchema, childId: uuidSchema }).strict()
const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    search: z.string().trim().max(100).optional(),
    status: z.enum(['todo', 'in-progress', 'completed', 'on-hold']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    when: z.enum(['overdue', 'today', 'upcoming']).optional(),
    sort: z.enum(['newest', 'oldest', 'due', 'priority', 'alpha']).default('newest'),
  })
  .strict()
const completionSchema = z.object({ completed: z.boolean() }).strict()
const rescheduleSchema = z.object({ dueDate: isoDateSchema.nullable() }).strict()
const subtaskCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    done: z.boolean().default(false),
  })
  .strict()
const subtaskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    done: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0)
const followUpCreateSchema = followUpSchema.omit({ id: true }).strict()
const followUpUpdateSchema = z
  .object({
    date: isoDateSchema.optional(),
    note: z.string().max(1000).optional(),
    completed: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0)
const bulkResetSchema = z.object({ currentPassword: z.string().min(1).max(128) }).strict()

function currentUser(request: Request) {
  if (!request.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.')
  return request.user
}

async function taskResponse(request: Request, taskId: string, task: TaskDto) {
  await writeAuditLog({
    userId: currentUser(request).id,
    action: 'task_updated',
    entityType: 'task',
    entityId: taskId,
    ip: request.socket.remoteAddress ?? '',
  })
  return task
}

router.get(
  '/',
  validateQuery(querySchema),
  asyncRoute(async (request, response) => {
    const result = await listTasks(request.query as unknown as TaskQuery, currentUser(request))
    response.json({ data: result })
  }),
)

router.post(
  '/',
  validateBody(taskInputSchema),
  asyncRoute(async (request, response) => {
    const task = await createTask(request.body as z.infer<typeof taskInputSchema>, currentUser(request))
    await writeAuditLog({
      userId: currentUser(request).id,
      action: 'task_created',
      entityType: 'task',
      entityId: task.id,
      ip: request.socket.remoteAddress ?? '',
    })
    response.status(201).json({ data: { task } })
  }),
)

router.post(
  '/bulk-reset',
  requireRoles('admin'),
  validateBody(bulkResetSchema),
  asyncRoute(async (request, response) => {
    const userId = currentUser(request).id
    const { currentPassword } = request.body as z.infer<typeof bulkResetSchema>
    const [userRows] = await pool.execute<(RowDataPacket & { password_hash: string })[]>(
      'SELECT password_hash FROM users WHERE id = ? AND is_active = TRUE',
      [userId],
    )
    if (!userRows[0] || !(await verifyPassword(userRows[0].password_hash, currentPassword))) {
      throw new HttpError(403, 'REAUTHENTICATION_FAILED', 'Password confirmation failed.')
    }

    const connection = await pool.getConnection()
    let deletedCount = 0
    try {
      await connection.beginTransaction()
      const [result] = await connection.execute(
        'UPDATE tasks SET deleted_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE deleted_at IS NULL',
      )
      if ('affectedRows' in result) deletedCount = result.affectedRows
      await connection.execute(
        'INSERT INTO audit_logs (id, user_id, action, entity_type, ip, metadata) VALUES (?, ?, ?, ?, ?, ?)',
        [
          randomUUID(),
          userId,
          'tasks_bulk_reset',
          'task',
          request.socket.remoteAddress ?? '',
          JSON.stringify({ count: deletedCount }),
        ],
      )
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
    response.json({ data: { deleted: deletedCount } })
  }),
)

router.get(
  '/:taskId',
  validateParams(taskParams),
  asyncRoute(async (request, response) => {
    const task = await getTaskForRequest(request, request.params.taskId)
    response.json({ data: { task } })
  }),
)

router.put(
  '/:taskId',
  validateParams(taskParams),
  validateBody(taskInputSchema),
  asyncRoute(async (request, response) => {
    const task = await updateTask(
      request.params.taskId,
      request.body as z.infer<typeof taskInputSchema>,
      currentUser(request),
    )
    response.json({ data: { task: await taskResponse(request, task.id, task) } })
  }),
)

router.delete(
  '/:taskId',
  validateParams(taskParams),
  asyncRoute(async (request, response) => {
    await softDeleteTask(request.params.taskId, currentUser(request))
    await writeAuditLog({
      userId: currentUser(request).id,
      action: 'task_deleted',
      entityType: 'task',
      entityId: request.params.taskId,
      ip: request.socket.remoteAddress ?? '',
    })
    response.status(204).end()
  }),
)

router.post(
  '/:taskId/duplicate',
  validateParams(taskParams),
  asyncRoute(async (request, response) => {
    const task = await duplicateTask(request.params.taskId, currentUser(request))
    await writeAuditLog({
      userId: currentUser(request).id,
      action: 'task_duplicated',
      entityType: 'task',
      entityId: task.id,
      ip: request.socket.remoteAddress ?? '',
    })
    response.status(201).json({ data: { task } })
  }),
)

router.patch(
  '/:taskId/complete',
  validateParams(taskParams),
  validateBody(completionSchema),
  asyncRoute(async (request, response) => {
    const body = request.body as z.infer<typeof completionSchema>
    const task = await setTaskComplete(request.params.taskId, body.completed, currentUser(request))
    await writeAuditLog({
      userId: currentUser(request).id,
      action: body.completed ? 'task_completed' : 'task_reopened',
      entityType: 'task',
      entityId: task.id,
      ip: request.socket.remoteAddress ?? '',
    })
    response.json({ data: { task } })
  }),
)

router.patch(
  '/:taskId/reschedule',
  validateParams(taskParams),
  validateBody(rescheduleSchema),
  asyncRoute(async (request, response) => {
    const body = request.body as z.infer<typeof rescheduleSchema>
    const task = await rescheduleTask(request.params.taskId, body.dueDate, currentUser(request))
    await writeAuditLog({
      userId: currentUser(request).id,
      action: 'task_rescheduled',
      entityType: 'task',
      entityId: task.id,
      ip: request.socket.remoteAddress ?? '',
    })
    response.json({ data: { task } })
  }),
)

router.get(
  '/:taskId/subtasks',
  validateParams(taskParams),
  asyncRoute(async (request, response) => {
    const task = await getTaskForRequest(request, request.params.taskId)
    response.json({ data: { subtasks: task.subtasks } })
  }),
)

router.post(
  '/:taskId/subtasks',
  validateParams(taskParams),
  validateBody(subtaskCreateSchema),
  asyncRoute(async (request, response) => {
    const taskId = request.params.taskId
    await assertTaskAccess(taskId, currentUser(request))
    const body = request.body as z.infer<typeof subtaskCreateSchema>
    await pool.execute(
      'INSERT INTO subtasks (id, task_id, title, is_done, position) SELECT ?, ?, ?, ?, COALESCE(MAX(position), -1) + 1 FROM subtasks WHERE task_id = ?',
      [randomUUID(), taskId, body.title, body.done, taskId],
    )
    const task = await getTaskForRequest(request, taskId)
    response.status(201).json({ data: { task, subtasks: task.subtasks } })
  }),
)

router.put(
  '/:taskId/subtasks/:childId',
  validateParams(childParams),
  validateBody(subtaskUpdateSchema),
  asyncRoute(async (request, response) => {
    const { taskId, childId } = request.params
    await assertTaskAccess(taskId, currentUser(request))
    const body = request.body as z.infer<typeof subtaskUpdateSchema>
    const fields: string[] = []
    const values: ExecuteValues[] = []
    if (body.title !== undefined) {
      fields.push('title = ?')
      values.push(body.title)
    }
    if (body.done !== undefined) {
      fields.push('is_done = ?')
      values.push(body.done)
    }
    const [existing] = await pool.execute<(import('mysql2').RowDataPacket & { id: string })[]>(
      'SELECT id FROM subtasks WHERE id = ? AND task_id = ?',
      [childId, taskId],
    )
    if (!existing[0]) throw new HttpError(404, 'SUBTASK_NOT_FOUND', 'Subtask was not found.')
    await pool.execute(`UPDATE subtasks SET ${fields.join(', ')} WHERE id = ? AND task_id = ?`, [
      ...values,
      childId,
      taskId,
    ])
    const task = await getTaskForRequest(request, taskId)
    response.json({ data: { task, subtasks: task.subtasks } })
  }),
)

router.delete(
  '/:taskId/subtasks/:childId',
  validateParams(childParams),
  asyncRoute(async (request, response) => {
    const { taskId, childId } = request.params
    await assertTaskAccess(taskId, currentUser(request))
    const [result] = await pool.execute('DELETE FROM subtasks WHERE id = ? AND task_id = ?', [childId, taskId])
    if ('affectedRows' in result && result.affectedRows === 0)
      throw new HttpError(404, 'SUBTASK_NOT_FOUND', 'Subtask was not found.')
    const task = await getTaskForRequest(request, taskId)
    response.json({ data: { task, subtasks: task.subtasks } })
  }),
)

router.get(
  '/:taskId/follow-ups',
  validateParams(taskParams),
  asyncRoute(async (request, response) => {
    const task = await getTaskForRequest(request, request.params.taskId)
    response.json({ data: { followUps: task.followUps } })
  }),
)

router.post(
  '/:taskId/follow-ups',
  validateParams(taskParams),
  validateBody(followUpCreateSchema),
  asyncRoute(async (request, response) => {
    const taskId = request.params.taskId
    await assertTaskAccess(taskId, currentUser(request))
    const body = request.body as z.infer<typeof followUpCreateSchema>
    await pool.execute('INSERT INTO follow_ups (id, task_id, follow_up_date, note, is_done) VALUES (?, ?, ?, ?, ?)', [
      randomUUID(),
      taskId,
      body.date,
      body.note,
      body.completed,
    ])
    const task = await getTaskForRequest(request, taskId)
    response.status(201).json({ data: { task, followUps: task.followUps } })
  }),
)

router.put(
  '/:taskId/follow-ups/:childId',
  validateParams(childParams),
  validateBody(followUpUpdateSchema),
  asyncRoute(async (request, response) => {
    const { taskId, childId } = request.params
    await assertTaskAccess(taskId, currentUser(request))
    const body = request.body as z.infer<typeof followUpUpdateSchema>
    const fields: string[] = []
    const values: ExecuteValues[] = []
    if (body.date !== undefined) {
      fields.push('follow_up_date = ?')
      values.push(body.date)
    }
    if (body.note !== undefined) {
      fields.push('note = ?')
      values.push(body.note)
    }
    if (body.completed !== undefined) {
      fields.push('is_done = ?')
      values.push(body.completed)
    }
    const [existing] = await pool.execute<(import('mysql2').RowDataPacket & { id: string })[]>(
      'SELECT id FROM follow_ups WHERE id = ? AND task_id = ?',
      [childId, taskId],
    )
    if (!existing[0]) throw new HttpError(404, 'FOLLOW_UP_NOT_FOUND', 'Follow-up was not found.')
    await pool.execute(`UPDATE follow_ups SET ${fields.join(', ')} WHERE id = ? AND task_id = ?`, [
      ...values,
      childId,
      taskId,
    ])
    const task = await getTaskForRequest(request, taskId)
    response.json({ data: { task, followUps: task.followUps } })
  }),
)

router.delete(
  '/:taskId/follow-ups/:childId',
  validateParams(childParams),
  asyncRoute(async (request, response) => {
    const { taskId, childId } = request.params
    await assertTaskAccess(taskId, currentUser(request))
    const [result] = await pool.execute('DELETE FROM follow_ups WHERE id = ? AND task_id = ?', [childId, taskId])
    if ('affectedRows' in result && result.affectedRows === 0)
      throw new HttpError(404, 'FOLLOW_UP_NOT_FOUND', 'Follow-up was not found.')
    const task = await getTaskForRequest(request, taskId)
    response.json({ data: { task, followUps: task.followUps } })
  }),
)

export default router
