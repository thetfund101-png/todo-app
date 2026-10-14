import { Router } from 'express'
import { RowDataPacket } from 'mysql2'
import { pool } from '../db/pool.js'
import { asyncRoute } from '../errors.js'
import { requireAuth } from '../middleware/auth.js'
import { getTask } from '../services/tasks.js'
import { visibility } from '../services/tasks.js'

const router = Router()
router.use(requireAuth)

router.get(
  '/summary',
  asyncRoute(async (request, response) => {
    const user = request.user!
    const scope = visibility(user)
    const [countRows] = await pool.execute<
      (RowDataPacket & {
        total: number
        todo: number
        in_progress: number
        completed: number
        on_hold: number
        overdue: number
        due_today: number
        due_this_week: number
        open_follow_ups: number
      })[]
    >(
      `SELECT COUNT(*) AS total,
       SUM(t.status = 'todo') AS todo,
       SUM(t.status = 'in-progress') AS in_progress,
       SUM(t.status = 'completed') AS completed,
       SUM(t.status = 'on-hold') AS on_hold,
       SUM(t.status <> 'completed' AND t.due_date < UTC_DATE()) AS overdue,
       SUM(t.status <> 'completed' AND t.due_date = UTC_DATE()) AS due_today,
       SUM(t.status <> 'completed' AND t.due_date >= UTC_DATE()
           AND t.due_date <= DATE_ADD(UTC_DATE(), INTERVAL 7 DAY)) AS due_this_week,
       (SELECT COUNT(*) FROM follow_ups f JOIN tasks ft ON ft.id = f.task_id
        WHERE f.is_done = FALSE AND ft.deleted_at IS NULL AND ${visibility(user, 'ft').clause}) AS open_follow_ups
     FROM tasks t WHERE t.deleted_at IS NULL AND ${scope.clause}`,
      [...visibility(user, 'ft').values, ...scope.values],
    )
    const statsRow = countRows[0]
    const [subtaskRows] = await pool.execute<(RowDataPacket & { completed: number })[]>(
      `SELECT COUNT(*) AS completed FROM subtasks s JOIN tasks t ON t.id = s.task_id
     WHERE s.is_done = TRUE AND t.deleted_at IS NULL AND ${scope.clause}`,
      scope.values,
    )

    const [attentionRows] = await pool.execute<(RowDataPacket & { id: string })[]>(
      `SELECT t.id FROM tasks t WHERE t.deleted_at IS NULL AND t.status <> 'completed'
       AND t.due_date <= UTC_DATE() AND ${scope.clause}
     ORDER BY t.due_date ASC, t.priority DESC, t.updated_at DESC LIMIT 5`,
      scope.values,
    )
    const [recentRows] = await pool.execute<(RowDataPacket & { id: string })[]>(
      `SELECT t.id FROM tasks t WHERE t.deleted_at IS NULL AND ${scope.clause}
     ORDER BY t.updated_at DESC LIMIT 5`,
      scope.values,
    )
    const [followUpRows] = await pool.execute<
      (RowDataPacket & { task_id: string; id: string; follow_up_date: string; note: string })[]
    >(
      `SELECT f.id, f.task_id, f.follow_up_date, f.note
     FROM follow_ups f JOIN tasks t ON t.id = f.task_id
     WHERE f.is_done = FALSE AND t.deleted_at IS NULL AND ${scope.clause}
     ORDER BY f.follow_up_date ASC, t.updated_at DESC LIMIT 5`,
      scope.values,
    )

    const attention = await Promise.all(attentionRows.map((row) => getTask(row.id, user)))
    const recent = await Promise.all(recentRows.map((row) => getTask(row.id, user)))
    const followUpTaskIds = Array.from(new Set(followUpRows.map((row) => row.task_id)))
    const followUpTasks = await Promise.all(followUpTaskIds.map((id) => getTask(id, user)))
    const taskById = new Map(followUpTasks.filter((task) => task !== null).map((task) => [task!.id, task!]))

    response.json({
      data: {
        stats: {
          total: Number(statsRow?.total ?? 0),
          todo: Number(statsRow?.todo ?? 0),
          inProgress: Number(statsRow?.in_progress ?? 0),
          completed: Number(statsRow?.completed ?? 0),
          onHold: Number(statsRow?.on_hold ?? 0),
          overdue: Number(statsRow?.overdue ?? 0),
          dueToday: Number(statsRow?.due_today ?? 0),
          dueThisWeek: Number(statsRow?.due_this_week ?? 0),
          subtasksCompleted: Number(subtaskRows[0]?.completed ?? 0),
          openFollowUps: Number(statsRow?.open_follow_ups ?? 0),
        },
        needsAttention: attention.filter((task) => task !== null),
        recentlyUpdated: recent.filter((task) => task !== null),
        openFollowUps: followUpRows.flatMap((row) => {
          const task = taskById.get(row.task_id)
          const followUp = task?.followUps.find((item) => item.id === row.id)
          return task && followUp ? [{ task, followUp }] : []
        }),
      },
    })
  }),
)

export default router
