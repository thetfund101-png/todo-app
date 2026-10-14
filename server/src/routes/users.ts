import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { RowDataPacket } from 'mysql2'
import type { ExecuteValues } from 'mysql2'
import type { PoolConnection } from 'mysql2/promise'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { HttpError, asyncRoute } from '../errors.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js'
import { uuidSchema } from '../schemas.js'
import { assertStrongPassword, hashPassword } from '../security/password.js'
import { writeAuditLog } from '../services/audit.js'

const router = Router()
router.use(requireAuth)
const userParams = z.object({ userId: uuidSchema }).strict()
const createUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    role: z.enum(['admin', 'manager', 'staff']),
    password: z.string().min(1).max(128),
  })
  .strict()
const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    role: z.enum(['admin', 'manager', 'staff']),
  })
  .strict()
const activationSchema = z.object({ isActive: z.boolean() }).strict()
const resetPasswordSchema = z.object({ password: z.string().min(1).max(128) }).strict()
const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    search: z.string().trim().max(100).optional(),
    role: z.enum(['admin', 'manager', 'staff']).optional(),
    isActive: z.enum(['true', 'false']).optional(),
  })
  .strict()

function ip(request: import('express').Request) {
  return request.socket.remoteAddress ?? ''
}

async function protectLastAdmin(
  connection: PoolConnection,
  target: { role: string; is_active: number },
  nextRole: string,
  nextActive: boolean,
) {
  if (target.role !== 'admin' || !target.is_active || (nextRole === 'admin' && nextActive)) return
  const [admins] = await connection.execute<(RowDataPacket & { id: string })[]>(
    'SELECT id FROM users WHERE role = ? AND is_active = TRUE FOR UPDATE',
    ['admin'],
  )
  if (admins.length <= 1) {
    throw new HttpError(409, 'LAST_ADMIN', 'The last active administrator cannot be deactivated or demoted.')
  }
}

router.get(
  '/',
  requireRoles('manager', 'admin'),
  validateQuery(listSchema),
  asyncRoute(async (request, response) => {
    const query = request.query as unknown as z.infer<typeof listSchema>
    const conditions: string[] = []
    const values: ExecuteValues[] = []
    if (query.search) {
      conditions.push('(LOCATE(?, LOWER(name)) > 0 OR LOCATE(?, LOWER(email)) > 0)')
      values.push(query.search.toLowerCase(), query.search.toLowerCase())
    }
    if (query.role) {
      conditions.push('role = ?')
      values.push(query.role)
    }
    if (query.isActive) {
      conditions.push('is_active = ?')
      values.push(query.isActive === 'true')
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const [countRows] = await pool.execute<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM users ${where}`,
      values,
    )
    const [rows] = await pool.execute<
      (RowDataPacket & {
        id: string
        name: string
        email: string
        role: string
        is_active: number
        last_login_at: string | null
      })[]
    >(
      `SELECT id, name, email, role, is_active, last_login_at FROM users ${where}
     ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...values, query.pageSize, (query.page - 1) * query.pageSize],
    )
    response.json({
      data: {
        users: rows.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: Boolean(user.is_active),
          lastLoginAt: user.last_login_at,
        })),
        total: Number(countRows[0]?.total ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      },
    })
  }),
)

router.post(
  '/',
  requireRoles('admin'),
  validateBody(createUserSchema),
  asyncRoute(async (request, response) => {
    const input = request.body as z.infer<typeof createUserSchema>
    assertStrongPassword(input.password)
    const id = randomUUID()
    const passwordHash = await hashPassword(input.password)
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.execute('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)', [
        id,
        input.name,
        input.email,
        passwordHash,
        input.role,
      ])
      const [categoryRows] = await connection.execute<(RowDataPacket & { id: string })[]>(
        'SELECT id FROM categories WHERE name = ?',
        ['General'],
      )
      await connection.execute(
        'INSERT INTO user_settings (user_id, theme, default_priority, default_category_id) VALUES (?, ?, ?, ?)',
        [id, 'system', 'medium', categoryRows[0]?.id ?? null],
      )
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      if ((error as NodeJS.ErrnoException).code === 'ER_DUP_ENTRY') {
        throw new HttpError(409, 'EMAIL_EXISTS', 'A user with that email address already exists.')
      }
      throw error
    } finally {
      connection.release()
    }
    await writeAuditLog({
      userId: request.user!.id,
      action: 'user_created',
      entityType: 'user',
      entityId: id,
      ip: ip(request),
      metadata: { role: input.role },
    })
    response
      .status(201)
      .json({ data: { user: { id, name: input.name, email: input.email, role: input.role, isActive: true } } })
  }),
)

router.get(
  '/:userId',
  requireRoles('admin'),
  validateParams(userParams),
  asyncRoute(async (request, response) => {
    const [rows] = await pool.execute<
      (RowDataPacket & {
        id: string
        name: string
        email: string
        role: string
        is_active: number
        last_login_at: string | null
        created_at: string
      })[]
    >('SELECT id, name, email, role, is_active, last_login_at, created_at FROM users WHERE id = ?', [
      request.params.userId,
    ])
    const user = rows[0]
    if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User was not found.')
    response.json({
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: Boolean(user.is_active),
          lastLoginAt: user.last_login_at,
          createdAt: user.created_at,
        },
      },
    })
  }),
)

router.put(
  '/:userId',
  requireRoles('admin'),
  validateParams(userParams),
  validateBody(updateUserSchema),
  asyncRoute(async (request, response) => {
    const userId = request.params.userId
    const input = request.body as z.infer<typeof updateUserSchema>
    const connection = await pool.getConnection()
    let isActive = false
    try {
      await connection.beginTransaction()
      const [existing] = await connection.execute<(RowDataPacket & { role: string; is_active: number })[]>(
        'SELECT role, is_active FROM users WHERE id = ? FOR UPDATE',
        [userId],
      )
      const target = existing[0]
      if (!target) throw new HttpError(404, 'USER_NOT_FOUND', 'User was not found.')
      isActive = Boolean(target.is_active)
      await protectLastAdmin(connection, target, input.role, isActive)
      await connection.execute(
        'UPDATE users SET name = ?, email = ?, role = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?',
        [input.name, input.email, input.role, userId],
      )
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      if ((error as NodeJS.ErrnoException).code === 'ER_DUP_ENTRY') {
        throw new HttpError(409, 'EMAIL_EXISTS', 'A user with that email address already exists.')
      }
      throw error
    } finally {
      connection.release()
    }
    await writeAuditLog({
      userId: request.user!.id,
      action: 'user_updated',
      entityType: 'user',
      entityId: userId,
      ip: ip(request),
      metadata: { role: input.role },
    })
    response.json({ data: { user: { id: userId, ...input, isActive } } })
  }),
)

router.patch(
  '/:userId/activation',
  requireRoles('admin'),
  validateParams(userParams),
  validateBody(activationSchema),
  asyncRoute(async (request, response) => {
    const userId = request.params.userId
    const { isActive } = request.body as z.infer<typeof activationSchema>
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.execute<(RowDataPacket & { role: string; is_active: number })[]>(
        'SELECT role, is_active FROM users WHERE id = ? FOR UPDATE',
        [userId],
      )
      const target = rows[0]
      if (!target) throw new HttpError(404, 'USER_NOT_FOUND', 'User was not found.')
      if (!isActive && request.user!.id === userId)
        throw new HttpError(409, 'SELF_DEACTIVATION', 'You cannot deactivate your own account.')
      await protectLastAdmin(connection, target, target.role, isActive)
      await connection.execute(
        'UPDATE users SET is_active = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = UTC_TIMESTAMP(3) WHERE id = ?',
        [isActive, userId],
      )
      if (!isActive) {
        await connection.execute(
          'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)) WHERE user_id = ?',
          [userId],
        )
      }
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
    await writeAuditLog({
      userId: request.user!.id,
      action: isActive ? 'user_activated' : 'user_deactivated',
      entityType: 'user',
      entityId: userId,
      ip: ip(request),
    })
    response.json({ data: { user: { id: userId, isActive } } })
  }),
)

router.patch(
  '/:userId/password',
  requireRoles('admin'),
  validateParams(userParams),
  validateBody(resetPasswordSchema),
  asyncRoute(async (request, response) => {
    const userId = request.params.userId
    const { password } = request.body as z.infer<typeof resetPasswordSchema>
    assertStrongPassword(password)
    const passwordHash = await hashPassword(password)
    const [result] = await pool.execute(
      'UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = UTC_TIMESTAMP(3) WHERE id = ?',
      [passwordHash, userId],
    )
    if ('affectedRows' in result && result.affectedRows === 0)
      throw new HttpError(404, 'USER_NOT_FOUND', 'User was not found.')
    await pool.execute(
      'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)) WHERE user_id = ?',
      [userId],
    )
    await writeAuditLog({
      userId: request.user!.id,
      action: 'user_password_reset',
      entityType: 'user',
      entityId: userId,
      ip: ip(request),
    })
    response.status(204).end()
  }),
)

router.delete(
  '/:userId',
  requireRoles('admin'),
  validateParams(userParams),
  asyncRoute(async (request, response) => {
    const userId = request.params.userId
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.execute<(RowDataPacket & { role: string; is_active: number })[]>(
        'SELECT role, is_active FROM users WHERE id = ? FOR UPDATE',
        [userId],
      )
      const target = rows[0]
      if (!target) throw new HttpError(404, 'USER_NOT_FOUND', 'User was not found.')
      if (request.user!.id === userId)
        throw new HttpError(409, 'SELF_DEACTIVATION', 'You cannot deactivate your own account.')
      await protectLastAdmin(connection, target, target.role, false)
      await connection.execute(
        'UPDATE users SET is_active = FALSE, failed_login_attempts = 0, locked_until = NULL, updated_at = UTC_TIMESTAMP(3) WHERE id = ?',
        [userId],
      )
      await connection.execute(
        'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)) WHERE user_id = ?',
        [userId],
      )
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
    await writeAuditLog({
      userId: request.user!.id,
      action: 'user_deactivated',
      entityType: 'user',
      entityId: userId,
      ip: ip(request),
    })
    response.status(204).end()
  }),
)

export default router
