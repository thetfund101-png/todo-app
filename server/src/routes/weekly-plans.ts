import { randomUUID } from 'node:crypto'
import { NextFunction, Request, Response, Router } from 'express'
import { RowDataPacket } from 'mysql2'
import { z } from 'zod'
import { config } from '../config.js'
import { pool } from '../db/pool.js'
import { HttpError, asyncRoute } from '../errors.js'
import { requireAuth } from '../middleware/auth.js'
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js'
import { isoDateSchema, uuidSchema } from '../schemas.js'
import { writeAuditLog } from '../services/audit.js'

const router = Router()
router.use(requireAuth)

const paramsSchema = z.object({ planId: uuidSchema }).strict()
const querySchema = z.object({ weekStart: isoDateSchema }).strict()
const planItemSchema = z
  .object({
    text: z.string().trim().min(1).max(1000),
    status: z.enum(['completed', 'ongoing', 'follow-up']),
  })
  .strict()
const planSchema = z
  .object({
    weekStart: isoDateSchema,
    items: z.array(planItemSchema).min(1).max(100),
    responsibleRole: z.string().trim().min(1).max(120),
    responsibleName: z.string().trim().min(1).max(120),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.items.reduce((total, item) => total + item.text.length, 0) > 5000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'Weekly plan items must not exceed 5000 characters in total.',
      })
    }
  })

const serializedItemsSchema = z.array(planItemSchema).min(1).max(100)

interface WeeklyPlanRow extends RowDataPacket {
  id: string
  week_start: string
  plans: string
  plan_items: string | unknown[] | null
  responsible_role: string
  responsible_name: string
  created_at: string
}

function canEditWeeklyPlans(user: NonNullable<import('express').Request['user']>) {
  return user.role === 'admin' || user.email.toLowerCase() === config.weeklyPlanEditorEmail
}

function requireWeeklyPlanEditor(request: Request, _response: Response, next: NextFunction) {
  if (!canEditWeeklyPlans(request.user!)) {
    next(new HttpError(403, 'FORBIDDEN', 'You do not have permission to edit weekly plans.'))
    return
  }
  next()
}

function serializePlan(row: WeeklyPlanRow) {
  const storedItems = typeof row.plan_items === 'string' ? (JSON.parse(row.plan_items) as unknown) : row.plan_items
  const items =
    storedItems === null
      ? row.plans
          .split(/\r?\n/)
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text) => ({ text, status: 'ongoing' as const }))
      : serializedItemsSchema.parse(storedItems)
  return {
    id: row.id,
    weekStart: String(row.week_start).slice(0, 10),
    items,
    responsibleRole: row.responsible_role,
    responsibleName: row.responsible_name,
    createdAt: row.created_at,
  }
}

router.get(
  '/',
  validateQuery(querySchema),
  asyncRoute(async (request, response) => {
    const { weekStart } = request.query as z.infer<typeof querySchema>
    const [rows] = await pool.execute<WeeklyPlanRow[]>(
      `SELECT id, week_start, plans, plan_items, responsible_role, responsible_name, created_at
       FROM weekly_plans
       WHERE week_start = ?
       ORDER BY created_at ASC, id ASC`,
      [weekStart],
    )
    response.json({
      data: {
        plans: rows.map(serializePlan),
        canEdit: canEditWeeklyPlans(request.user!),
      },
    })
  }),
)

router.post(
  '/',
  requireWeeklyPlanEditor,
  validateBody(planSchema),
  asyncRoute(async (request, response) => {
    const user = request.user!
    const { weekStart, items, responsibleRole, responsibleName } = request.body as z.infer<typeof planSchema>
    const plans = items.map((item) => item.text).join('\n')
    const id = randomUUID()
    await pool.execute(
      `INSERT INTO weekly_plans
        (id, week_start, plans, plan_items, responsible_role, responsible_name, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, weekStart, plans, JSON.stringify(items), responsibleRole, responsibleName, user.id],
    )
    await writeAuditLog({
      userId: user.id,
      action: 'weekly_plan_created',
      entityType: 'weekly_plan',
      entityId: id,
      ip: request.socket.remoteAddress ?? '',
    })
    response.status(201).json({
      data: {
        plan: {
          id,
          weekStart,
          items,
          responsibleRole,
          responsibleName,
        },
      },
    })
  }),
)

router.put(
  '/:planId',
  requireWeeklyPlanEditor,
  validateParams(paramsSchema),
  validateBody(planSchema),
  asyncRoute(async (request, response) => {
    const user = request.user!
    const { planId } = request.params
    const { weekStart, items, responsibleRole, responsibleName } = request.body as z.infer<typeof planSchema>
    const plans = items.map((item) => item.text).join('\n')
    const [result] = await pool.execute(
      `UPDATE weekly_plans
       SET week_start = ?, plans = ?, plan_items = ?, responsible_role = ?, responsible_name = ?
       WHERE id = ?`,
      [weekStart, plans, JSON.stringify(items), responsibleRole, responsibleName, planId],
    )
    if ((result as { affectedRows: number }).affectedRows === 0) {
      const [existing] = await pool.execute<(RowDataPacket & { id: string })[]>(
        'SELECT id FROM weekly_plans WHERE id = ?',
        [planId],
      )
      if (!existing[0]) throw new HttpError(404, 'WEEKLY_PLAN_NOT_FOUND', 'Weekly plan was not found.')
    }
    await writeAuditLog({
      userId: user.id,
      action: 'weekly_plan_updated',
      entityType: 'weekly_plan',
      entityId: planId,
      ip: request.socket.remoteAddress ?? '',
    })
    response.json({
      data: {
        plan: {
          id: planId,
          weekStart,
          items,
          responsibleRole,
          responsibleName,
        },
      },
    })
  }),
)

router.delete(
  '/:planId',
  requireWeeklyPlanEditor,
  validateParams(paramsSchema),
  asyncRoute(async (request, response) => {
    const { planId } = request.params
    const [result] = await pool.execute('DELETE FROM weekly_plans WHERE id = ?', [planId])
    if ((result as { affectedRows: number }).affectedRows === 0) {
      throw new HttpError(404, 'WEEKLY_PLAN_NOT_FOUND', 'Weekly plan was not found.')
    }
    await writeAuditLog({
      userId: request.user!.id,
      action: 'weekly_plan_deleted',
      entityType: 'weekly_plan',
      entityId: planId,
      ip: request.socket.remoteAddress ?? '',
    })
    response.status(204).end()
  }),
)

export default router
