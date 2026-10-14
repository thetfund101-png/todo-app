import { Router } from 'express'
import { RowDataPacket } from 'mysql2'
import type { ExecuteValues } from 'mysql2'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { asyncRoute } from '../errors.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { validateQuery } from '../middleware/validate.js'

const router = Router()
router.use(requireAuth, requireRoles('admin'))

const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    action: z.string().trim().min(1).max(80).optional(),
    entityType: z.string().trim().min(1).max(80).optional(),
    userId: z.string().uuid().optional(),
  })
  .strict()

router.get(
  '/audit-logs',
  validateQuery(querySchema),
  asyncRoute(async (request, response) => {
    const query = request.query as unknown as z.infer<typeof querySchema>
    const conditions: string[] = []
    const values: ExecuteValues[] = []
    if (query.action) {
      conditions.push('a.action = ?')
      values.push(query.action)
    }
    if (query.entityType) {
      conditions.push('a.entity_type = ?')
      values.push(query.entityType)
    }
    if (query.userId) {
      conditions.push('a.user_id = ?')
      values.push(query.userId)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const [countRows] = await pool.execute<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM audit_logs a ${where}`,
      values,
    )
    const [rows] = await pool.execute<
      (RowDataPacket & {
        id: string
        user_id: string | null
        user_name: string | null
        action: string
        entity_type: string
        entity_id: string | null
        ip: string
        metadata: unknown
        created_at: string
      })[]
    >(
      `SELECT a.id, a.user_id, u.name AS user_name, a.action, a.entity_type,
            a.entity_id, a.ip, a.metadata, a.created_at
     FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ${where}
     ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [...values, query.pageSize, (query.page - 1) * query.pageSize],
    )
    response.json({
      data: {
        logs: rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          userName: row.user_name,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          ip: row.ip,
          metadata: row.metadata,
          createdAt: row.created_at,
        })),
        total: Number(countRows[0]?.total ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      },
    })
  }),
)

export default router
