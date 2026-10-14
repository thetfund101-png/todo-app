import { Router } from 'express'
import { RowDataPacket } from 'mysql2'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { HttpError, asyncRoute } from '../errors.js'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { writeAuditLog } from '../services/audit.js'

const router = Router()
router.use(requireAuth)

const settingsSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']),
    defaultPriority: z.enum(['low', 'medium', 'high', 'urgent']),
    defaultCategoryId: z.string().uuid(),
  })
  .strict()

router.get(
  '/',
  asyncRoute(async (request, response) => {
    const [rows] = await pool.execute<
      (RowDataPacket & {
        theme: 'light' | 'dark' | 'system'
        default_priority: 'low' | 'medium' | 'high' | 'urgent'
        default_category_id: string | null
        default_category: string | null
      })[]
    >(
      `SELECT s.theme, s.default_priority, s.default_category_id, c.name AS default_category
     FROM user_settings s LEFT JOIN categories c ON c.id = s.default_category_id WHERE s.user_id = ?`,
      [request.user!.id],
    )
    if (!rows[0]) throw new HttpError(500, 'SETTINGS_MISSING', 'User settings are not initialized.')
    response.json({
      data: {
        settings: {
          theme: rows[0].theme,
          defaultPriority: rows[0].default_priority,
          defaultCategoryId: rows[0].default_category_id,
          defaultCategory: rows[0].default_category,
        },
      },
    })
  }),
)

router.put(
  '/',
  validateBody(settingsSchema),
  asyncRoute(async (request, response) => {
    const input = request.body as z.infer<typeof settingsSchema>
    const [categories] = await pool.execute<(RowDataPacket & { id: string })[]>(
      'SELECT id FROM categories WHERE id = ?',
      [input.defaultCategoryId],
    )
    if (!categories[0]) throw new HttpError(400, 'INVALID_CATEGORY', 'Default category was not found.')
    await pool.execute(
      `INSERT INTO user_settings (user_id, theme, default_priority, default_category_id)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE theme = VALUES(theme), default_priority = VALUES(default_priority),
       default_category_id = VALUES(default_category_id), updated_at = UTC_TIMESTAMP(3)`,
      [request.user!.id, input.theme, input.defaultPriority, input.defaultCategoryId],
    )
    await writeAuditLog({
      userId: request.user!.id,
      action: 'settings_updated',
      entityType: 'user_settings',
      entityId: request.user!.id,
      ip: request.socket.remoteAddress ?? '',
    })
    response.json({ data: { settings: input } })
  }),
)

export default router
