import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { RowDataPacket } from 'mysql2'
import { z } from 'zod'
import { config } from '../config.js'
import { pool } from '../db/pool.js'
import { HttpError, asyncRoute } from '../errors.js'
import { requireAuth } from '../middleware/auth.js'
import { csrfCookieName, setCsrfToken } from '../middleware/csrf.js'
import { loginRateLimit, passwordRateLimit, refreshRateLimit } from '../middleware/rateLimits.js'
import { validateBody } from '../middleware/validate.js'
import { assertStrongPassword, hashPassword, verifyPassword } from '../security/password.js'
import { writeAuditLog } from '../services/audit.js'
import { Role } from '../types.js'

const router = Router()
const ACCESS_COOKIE = 'thet_access'
const REFRESH_COOKIE = 'thet_refresh'
const ACCESS_AGE = 15 * 60 * 1000
const REFRESH_AGE = 7 * 24 * 60 * 60 * 1000
const genericLoginError = () => new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
const dummyHash = hashPassword(randomBytes(32).toString('base64url'))

interface LoginRow extends RowDataPacket {
  id: string
  name: string
  email: string
  password_hash: string
  role: Role
  is_active: number
  failed_login_attempts: number
  locked_until: string | null
}

interface RefreshRow extends RowDataPacket {
  id: string
  user_id: string
  family_id: string
  token_hash: string
  expires_at: string
  revoked_at: string | null
  name: string
  email: string
  role: Role
  is_active: number
}

const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict()

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(1).max(128),
  })
  .strict()

function clientIp(request: Request): string {
  return request.socket.remoteAddress ?? ''
}

function mysqlUtcTimestamp(value: string): number {
  return new Date(`${value.replace(' ', 'T')}Z`).getTime()
}

function tokenDigest(token: string): string {
  return createHmac('sha256', config.refreshSecret).update(token).digest('hex')
}

function parseRefreshToken(token: unknown): { id: string; raw: string } | null {
  if (typeof token !== 'string') return null
  const separator = token.indexOf('.')
  if (separator < 1 || !/^[0-9a-f-]{36}$/i.test(token.slice(0, separator))) return null
  return { id: token.slice(0, separator), raw: token }
}

function safeHashEquals(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(a) || !/^[0-9a-f]{64}$/i.test(b)) return false
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

function cookieOptions(maxAge: number, path = '/api/v1') {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path,
    maxAge,
  } as const
}

function setAuthCookies(response: Response, accessToken: string, refreshToken: string) {
  response.cookie(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_AGE))
  response.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_AGE))
}

function clearAuthCookies(response: Response) {
  response.clearCookie(ACCESS_COOKIE, cookieOptions(0))
  response.clearCookie(REFRESH_COOKIE, cookieOptions(0))
  response.clearCookie(csrfCookieName, {
    httpOnly: false,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: '/',
  })
}

function createAccessToken(user: { id: string; role: Role }): string {
  return jwt.sign({ role: user.role }, config.accessSecret, { subject: user.id, expiresIn: '15m' })
}

function createRefreshToken(): { id: string; raw: string; digest: string } {
  const id = randomUUID()
  const raw = `${id}.${randomBytes(48).toString('base64url')}`
  return { id, raw, digest: tokenDigest(raw) }
}

async function insertRefreshToken(
  connection: import('mysql2/promise').PoolConnection,
  userId: string,
  familyId: string,
  token: { id: string; raw: string; digest: string },
  request: Request,
) {
  const expiresAt = new Date(Date.now() + REFRESH_AGE)
  await connection.execute(
    'INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      token.id,
      userId,
      familyId,
      token.digest,
      expiresAt,
      (request.get('user-agent') ?? '').slice(0, 500),
      clientIp(request).slice(0, 45),
    ],
  )
}

router.get('/csrf', (_request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  response.json({ data: { csrfToken: setCsrfToken(_request, response) } })
})

router.post(
  '/login',
  loginRateLimit,
  validateBody(loginSchema),
  asyncRoute(async (request, response) => {
    const { email, password } = request.body as z.infer<typeof loginSchema>
    const [rows] = await pool.execute<LoginRow[]>(
      'SELECT id, name, email, password_hash, role, is_active, failed_login_attempts, locked_until FROM users WHERE email = ? LIMIT 1',
      [email],
    )
    const user = rows[0]
    const passwordMatches = await verifyPassword(user?.password_hash ?? (await dummyHash), password)
    const isLocked = Boolean(user?.locked_until && mysqlUtcTimestamp(user.locked_until) > Date.now())

    if (!user || !user.is_active || isLocked || !passwordMatches) {
      if (user && user.is_active && !isLocked && !passwordMatches) {
        await pool.execute(
          `UPDATE users
         SET locked_until = CASE
           WHEN failed_login_attempts >= 4 THEN DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 15 MINUTE)
           ELSE locked_until
         END,
         failed_login_attempts = LEAST(failed_login_attempts + 1, 5)
         WHERE id = ?`,
          [user.id],
        )
      }
      await writeAuditLog({
        userId: user?.id ?? null,
        action: 'login_failed',
        entityType: 'user',
        entityId: user?.id ?? null,
        ip: clientIp(request),
        metadata: {
          reason: !user
            ? 'unknown_account'
            : !user.is_active
              ? 'inactive_account'
              : isLocked
                ? 'locked_account'
                : 'invalid_password',
        },
      })
      throw genericLoginError()
    }

    const accessToken = createAccessToken(user)
    const refreshToken = createRefreshToken()
    const familyId = randomUUID()
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.execute(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP(3) WHERE id = ?',
        [user.id],
      )
      await insertRefreshToken(connection, user.id, familyId, refreshToken, request)
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
    await writeAuditLog({
      userId: user.id,
      action: 'login_success',
      entityType: 'user',
      entityId: user.id,
      ip: clientIp(request),
    })
    setAuthCookies(response, accessToken, refreshToken.raw)
    const csrfToken = setCsrfToken(request, response)
    response.json({ data: { user: { id: user.id, name: user.name, email: user.email, role: user.role }, csrfToken } })
  }),
)

router.post(
  '/refresh',
  refreshRateLimit,
  asyncRoute(async (request, response) => {
    const parsed = parseRefreshToken(request.cookies?.[REFRESH_COOKIE])
    if (!parsed) {
      clearAuthCookies(response)
      throw new HttpError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.')
    }

    const connection = await pool.getConnection()
    let reuseDetected: { userId: string; familyId: string } | null = null
    let invalid = false
    let user: { id: string; name: string; email: string; role: Role } | null = null
    let nextRefresh: ReturnType<typeof createRefreshToken> | null = null
    let accessToken = ''
    try {
      await connection.beginTransaction()
      const [rows] = await connection.execute<RefreshRow[]>(
        `SELECT rt.id, rt.user_id, rt.family_id, rt.token_hash, rt.expires_at, rt.revoked_at,
              u.name, u.email, u.role, u.is_active
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.id = ? FOR UPDATE`,
        [parsed.id],
      )
      const record = rows[0]
      if (!record || !safeHashEquals(record.token_hash, tokenDigest(parsed.raw))) {
        invalid = true
        await connection.rollback()
      } else if (record.revoked_at) {
        await connection.execute(
          'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)) WHERE family_id = ?',
          [record.family_id],
        )
        await connection.commit()
        reuseDetected = { userId: record.user_id, familyId: record.family_id }
      } else if (mysqlUtcTimestamp(record.expires_at) <= Date.now() || !record.is_active) {
        await connection.execute(
          'UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(3) WHERE family_id = ? AND revoked_at IS NULL',
          [record.family_id],
        )
        await connection.commit()
        invalid = true
      } else {
        user = { id: record.user_id, name: record.name, email: record.email, role: record.role }
        nextRefresh = createRefreshToken()
        const nextId = nextRefresh.id
        await insertRefreshToken(connection, user.id, record.family_id, nextRefresh, request)
        await connection.execute(
          'UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(3), replaced_by = ? WHERE id = ? AND revoked_at IS NULL',
          [nextId, record.id],
        )
        await connection.commit()
        accessToken = createAccessToken(user)
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

    if (reuseDetected) {
      await writeAuditLog({
        userId: reuseDetected.userId,
        action: 'refresh_reuse_detected',
        entityType: 'refresh_token_family',
        entityId: reuseDetected.familyId,
        ip: clientIp(request),
      })
      clearAuthCookies(response)
      throw new HttpError(401, 'SESSION_REVOKED', 'Session security check failed. Please sign in again.')
    }
    if (invalid || !user || !nextRefresh) {
      clearAuthCookies(response)
      throw new HttpError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.')
    }
    setAuthCookies(response, accessToken, nextRefresh.raw)
    const csrfToken = setCsrfToken(request, response)
    response.json({ data: { user, csrfToken } })
  }),
)

router.post(
  '/logout',
  asyncRoute(async (request, response) => {
    const parsed = parseRefreshToken(request.cookies?.[REFRESH_COOKIE])
    if (parsed) {
      const [rows] = await pool.execute<(RowDataPacket & { user_id: string; token_hash: string; family_id: string })[]>(
        'SELECT user_id, token_hash, family_id FROM refresh_tokens WHERE id = ? LIMIT 1',
        [parsed.id],
      )
      const record = rows[0]
      if (record && safeHashEquals(record.token_hash, tokenDigest(parsed.raw))) {
        await pool.execute(
          'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)) WHERE family_id = ?',
          [record.family_id],
        )
        await writeAuditLog({
          userId: record.user_id,
          action: 'logout',
          entityType: 'user',
          entityId: record.user_id,
          ip: clientIp(request),
        })
      }
    }
    clearAuthCookies(response)
    response.status(204).end()
  }),
)

router.get('/me', requireAuth, (request, response) => {
  response.json({ data: { user: request.user } })
})

router.post(
  '/change-password',
  passwordRateLimit,
  requireAuth,
  validateBody(changePasswordSchema),
  asyncRoute(async (request, response) => {
    const { currentPassword, newPassword } = request.body as z.infer<typeof changePasswordSchema>
    assertStrongPassword(newPassword)
    if (currentPassword === newPassword)
      throw new HttpError(400, 'PASSWORD_UNCHANGED', 'Choose a password different from your current password.')

    const userId = request.user!.id
    const [rows] = await pool.execute<(RowDataPacket & { password_hash: string })[]>(
      'SELECT password_hash FROM users WHERE id = ? AND is_active = TRUE',
      [userId],
    )
    const row = rows[0]
    if (!row || !(await verifyPassword(row.password_hash, currentPassword))) {
      throw new HttpError(400, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.')
    }

    const passwordHash = await hashPassword(newPassword)
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.execute(
        'UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
        [passwordHash, userId],
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
      userId,
      action: 'password_changed',
      entityType: 'user',
      entityId: userId,
      ip: clientIp(request),
    })
    clearAuthCookies(response)
    response.status(204).end()
  }),
)

export default router
