import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { RowDataPacket } from 'mysql2'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { HttpError, asyncRoute } from '../errors.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { validateBody, validateParams } from '../middleware/validate.js'
import { uuidSchema } from '../schemas.js'
import { writeAuditLog } from '../services/audit.js'

const router = Router()
router.use(requireAuth)

const paramsSchema = z.object({ categoryId: uuidSchema }).strict()
const categorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .transform((value) => value.replace(/\u0000/g, '')),
  })
  .strict()

router.get(
  '/',
  asyncRoute(async (_request, response) => {
    const [rows] = await pool.execute<(RowDataPacket & { id: string; name: string; is_builtin: number })[]>(
      'SELECT id, name, is_builtin FROM categories ORDER BY is_builtin DESC, name ASC',
    )
    response.json({
      data: { categories: rows.map((row) => ({ id: row.id, name: row.name, isBuiltin: Boolean(row.is_builtin) })) },
    })
  }),
)

router.post(
  '/',
  validateBody(categorySchema),
  asyncRoute(async (request, response) => {
    const user = request.user!
    const name = (request.body as z.infer<typeof categorySchema>).name
    const id = randomUUID()
    try {
      await pool.execute('INSERT INTO categories (id, name, is_builtin, created_by) VALUES (?, ?, FALSE, ?)', [
        id,
        name,
        user.id,
      ])
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ER_DUP_ENTRY') {
        throw new HttpError(409, 'CATEGORY_EXISTS', 'A category with that name already exists.')
      }
      throw error
    }
    await writeAuditLog({
      userId: user.id,
      action: 'category_created',
      entityType: 'category',
      entityId: id,
      ip: request.socket.remoteAddress ?? '',
    })
    response.status(201).json({ data: { category: { id, name, isBuiltin: false } } })
  }),
)

router.put(
  '/:categoryId',
  requireRoles('admin'),
  validateParams(paramsSchema),
  validateBody(categorySchema),
  asyncRoute(async (request, response) => {
    const { categoryId } = request.params
    const { name } = request.body as z.infer<typeof categorySchema>
    const [existing] = await pool.execute<(RowDataPacket & { id: string })[]>(
      'SELECT id FROM categories WHERE id = ?',
      [categoryId],
    )
    if (!existing[0]) throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'Category was not found.')
    try {
      await pool.execute('UPDATE categories SET name = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [
        name,
        categoryId,
      ])
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ER_DUP_ENTRY') {
        throw new HttpError(409, 'CATEGORY_EXISTS', 'A category with that name already exists.')
      }
      throw error
    }
    await writeAuditLog({
      userId: request.user!.id,
      action: 'category_updated',
      entityType: 'category',
      entityId: categoryId,
      ip: request.socket.remoteAddress ?? '',
    })
    response.json({ data: { category: { id: categoryId, name } } })
  }),
)

router.delete(
  '/:categoryId',
  requireRoles('admin'),
  validateParams(paramsSchema),
  asyncRoute(async (request, response) => {
    const { categoryId } = request.params
    const [categoryRows] = await pool.execute<(RowDataPacket & { is_builtin: number })[]>(
      'SELECT is_builtin FROM categories WHERE id = ?',
      [categoryId],
    )
    const category = categoryRows[0]
    if (!category) throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'Category was not found.')
    if (category.is_builtin) throw new HttpError(409, 'BUILTIN_CATEGORY', 'Built-in categories cannot be deleted.')

    const [usageRows] = await pool.execute<(RowDataPacket & { task_count: number; setting_count: number })[]>(
      `SELECT
       (SELECT COUNT(*) FROM tasks WHERE category_id = ?) AS task_count,
       (SELECT COUNT(*) FROM user_settings WHERE default_category_id = ?) AS setting_count`,
      [categoryId, categoryId],
    )
    if (Number(usageRows[0]?.task_count ?? 0) || Number(usageRows[0]?.setting_count ?? 0)) {
      throw new HttpError(409, 'CATEGORY_IN_USE', 'This category is in use and cannot be deleted.')
    }
    await pool.execute('DELETE FROM categories WHERE id = ?', [categoryId])
    await writeAuditLog({
      userId: request.user!.id,
      action: 'category_deleted',
      entityType: 'category',
      entityId: categoryId,
      ip: request.socket.remoteAddress ?? '',
    })
    response.status(204).end()
  }),
)

export default router
