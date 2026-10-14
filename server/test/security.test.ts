import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const mocks = vi.hoisted(() => ({
  pool: {
    execute: vi.fn(),
    getConnection: vi.fn(),
  },
  connection: {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
    execute: vi.fn(),
  },
  writeAuditLog: vi.fn(),
  state: {
    user: null as null | {
      id: string
      name: string
      email: string
      role: 'admin' | 'manager' | 'staff'
      is_active: number
      password_hash: string
      failed_login_attempts: number
      locked_until: string | null
    },
    tokens: new Map<
      string,
      {
        id: string
        user_id: string
        family_id: string
        token_hash: string
        expires_at: string
        revoked_at: string | null
        replaced_by: string | null
      }
    >(),
  },
}))

vi.mock('../src/db/pool.js', () => ({ pool: mocks.pool }))
vi.mock('../src/services/audit.js', () => ({ writeAuditLog: mocks.writeAuditLog }))
vi.mock('../src/security/password.js', () => ({
  assertStrongPassword: vi.fn(),
  hashPassword: vi.fn(async () => 'new-password-hash'),
  verifyPassword: vi.fn(
    async (hash: string, password: string) => hash === 'stored-password-hash' && password === 'Valid-password-123!',
  ),
}))

process.env.NODE_ENV = 'test'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long'

const userId = '11111111-1111-4111-8111-111111111111'
const otherTaskId = '22222222-2222-4222-8222-222222222222'
const email = 'staff@example.org'
const password = 'Valid-password-123!'
const tokenSecret = process.env.JWT_ACCESS_SECRET
let app: import('express').Express

function insertToken(values: unknown[]) {
  const [id, user_id, family_id, token_hash, expiresAt] = values as [string, string, string, string, Date]
  mocks.state.tokens.set(id, {
    id,
    user_id,
    family_id,
    token_hash,
    expires_at: expiresAt.toISOString().replace('T', ' ').slice(0, 23),
    revoked_at: null,
    replaced_by: null,
  })
  return [{ affectedRows: 1 }, []]
}

function findRefreshToken(id: string) {
  const record = mocks.state.tokens.get(id)
  if (!record || !mocks.state.user) return [[], []]
  return [
    [
      {
        ...record,
        name: mocks.state.user.name,
        email: mocks.state.user.email,
        role: mocks.state.user.role,
        is_active: mocks.state.user.is_active,
      },
    ],
    [],
  ]
}

beforeEach(async () => {
  vi.resetModules()
  mocks.state.user = {
    id: userId,
    name: 'Staff User',
    email,
    role: 'staff',
    is_active: 1,
    password_hash: 'stored-password-hash',
    failed_login_attempts: 0,
    locked_until: null,
  }
  mocks.state.tokens.clear()
  mocks.writeAuditLog.mockReset()
  mocks.connection.beginTransaction.mockReset().mockResolvedValue(undefined)
  mocks.connection.commit.mockReset().mockResolvedValue(undefined)
  mocks.connection.rollback.mockReset().mockResolvedValue(undefined)
  mocks.connection.release.mockReset()
  mocks.connection.execute.mockReset().mockImplementation(async (sql: string, values: unknown[] = []) => {
    if (sql.includes('INSERT INTO refresh_tokens')) return insertToken(values)
    if (sql.includes('SELECT rt.id, rt.user_id')) return findRefreshToken(String(values[0]))
    if (sql.includes('SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)) WHERE family_id = ?')) {
      for (const token of mocks.state.tokens.values()) {
        if (token.family_id === values[0]) token.revoked_at ??= new Date().toISOString()
      }
    }
    if (sql.includes('SET revoked_at = UTC_TIMESTAMP(3), replaced_by = ?')) {
      const token = mocks.state.tokens.get(String(values[1]))
      if (token) {
        token.revoked_at = new Date().toISOString()
        token.replaced_by = String(values[0])
      }
    }
    return [{ affectedRows: 1 }, []]
  })
  mocks.pool.getConnection.mockReset().mockResolvedValue(mocks.connection)
  mocks.pool.execute.mockReset().mockImplementation(async (sql: string, values: unknown[] = []) => {
    if (sql.includes('FROM users WHERE email = ? LIMIT 1')) {
      const matchingUser = mocks.state.user?.email === values[0] ? mocks.state.user : null
      return [matchingUser ? [{ ...matchingUser }] : [], []]
    }
    if (sql.includes('FROM users WHERE id = ? AND is_active = TRUE')) {
      const matchingUser = mocks.state.user?.id === values[0] && mocks.state.user.is_active ? mocks.state.user : null
      return [
        matchingUser
          ? [
              {
                id: matchingUser.id,
                name: matchingUser.name,
                email: matchingUser.email,
                role: matchingUser.role,
              },
            ]
          : [],
        [],
      ]
    }
    if (sql.includes('failed_login_attempts = LEAST')) {
      if (mocks.state.user) {
        mocks.state.user.failed_login_attempts += 1
        if (mocks.state.user.failed_login_attempts >= 5) {
          mocks.state.user.locked_until = new Date(Date.now() + 15 * 60_000)
            .toISOString()
            .replace('T', ' ')
            .slice(0, 23)
        }
      }
    }
    if (sql.includes('SELECT COUNT(*) AS total FROM tasks t JOIN categories')) return [[{ total: 0 }], []]
    if (sql.includes('FROM tasks t')) return [[], []]
    if (sql.includes('FROM weekly_plans')) return [[], []]
    return [{ affectedRows: 1 }, []]
  })

  const imported = await import('../src/app.js')
  app = imported.app
})

describe('authentication and authorization safeguards', () => {
  it('rejects unauthenticated task requests and malformed login fields', async () => {
    await request(app).get('/api/v1/tasks').expect(401)

    const agent = request.agent(app)
    const csrf = await agent.get('/api/v1/auth/csrf')
    const response = await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrf.body.data.csrfToken)
      .send({ email, password, unexpected: 'field' })
      .expect(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rotates refresh tokens and revokes the token family when a revoked token is reused', async () => {
    const agent = request.agent(app)
    const csrf = await agent.get('/api/v1/auth/csrf')
    const login = await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrf.body.data.csrfToken)
      .send({ email, password })
      .expect(200)
    const originalCookie = (login.headers['set-cookie'] as string[]).find((value) => value.startsWith('thet_refresh='))
    const originalToken = originalCookie!.split(';', 1)[0].slice('thet_refresh='.length)

    const rotated = await agent.post('/api/v1/auth/refresh').set('X-CSRF-Token', login.body.data.csrfToken).expect(200)
    const rotatedCookie = (rotated.headers['set-cookie'] as string[]).find((value) => value.startsWith('thet_refresh='))
    const rotatedToken = rotatedCookie!.split(';', 1)[0].slice('thet_refresh='.length)
    expect(rotatedToken).not.toBe(originalToken)

    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `thet_refresh=${originalToken}; thet_csrf=${rotated.body.data.csrfToken}`)
      .set('X-CSRF-Token', rotated.body.data.csrfToken)
      .expect(401)
    expect(replay.body.error.code).toBe('SESSION_REVOKED')
    expect([...mocks.state.tokens.values()].every((token) => token.revoked_at !== null)).toBe(true)
  })

  it('uses a generic credential error, locks the account after five failures, and rate-limits login', async () => {
    const agent = request.agent(app)
    const csrf = await agent.get('/api/v1/auth/csrf')
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await agent
        .post('/api/v1/auth/login')
        .set('X-CSRF-Token', csrf.body.data.csrfToken)
        .send({ email, password: 'incorrect-password' })
        .expect(401)
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS')
      expect(response.body.error.message).toBe('Email or password is incorrect.')
    }
    expect(mocks.state.user?.failed_login_attempts).toBe(5)
    expect(mocks.state.user?.locked_until).not.toBeNull()
    await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrf.body.data.csrfToken)
      .send({ email, password: 'incorrect-password' })
      .expect(429)
  })

  it('returns not found for another user’s task and binds search text as a SQL value', async () => {
    const accessToken = jwt.sign({ role: 'staff' }, tokenSecret, { subject: userId, expiresIn: '15m' })
    const cookie = `thet_access=${accessToken}`
    const denied = await request(app).get(`/api/v1/tasks/${otherTaskId}`).set('Cookie', cookie).expect(404)
    expect(denied.body.error.code).toBe('TASK_NOT_FOUND')
    await request(app).get('/api/v1/users').set('Cookie', cookie).expect(403)

    const attack = "' OR 1=1 --"
    await request(app)
      .get(`/api/v1/tasks?search=${encodeURIComponent(attack)}`)
      .set('Cookie', cookie)
      .expect(200)
    const countCall = mocks.pool.execute.mock.calls.find(([sql]) =>
      String(sql).includes('SELECT COUNT(*) AS total FROM tasks t JOIN categories'),
    )
    expect(countCall).toBeDefined()
    expect(String(countCall?.[0])).not.toContain(attack)
    expect(countCall?.[1]).toContain(attack.toLowerCase())
    expect(String(countCall?.[0])).toContain('t.created_by = ? OR t.assigned_to = ?')
    expect(countCall?.[1]?.slice(0, 2)).toEqual([userId, userId])
  })

  it('lets signed-in users view weekly plans but restricts edits to admins and the designated editor', async () => {
    const agent = request.agent(app)
    const csrf = await agent.get('/api/v1/auth/csrf')
    const login = await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrf.body.data.csrfToken)
      .send({ email, password })
      .expect(200)
    const plan = {
      weekStart: '2026-10-12',
      items: [{ text: 'Review the weekly workplan', status: 'ongoing' }],
      responsibleRole: 'Programme officer',
      responsibleName: 'Staff User',
    }

    const visiblePlans = await agent.get(`/api/v1/weekly-plans?weekStart=${plan.weekStart}`).expect(200)
    expect(visiblePlans.body.data.canEdit).toBe(false)

    await agent.post('/api/v1/weekly-plans').set('X-CSRF-Token', login.body.data.csrfToken).send(plan).expect(403)

    mocks.state.user!.email = 'infothetfund@gmail.com'
    const editorPlans = await agent.get(`/api/v1/weekly-plans?weekStart=${plan.weekStart}`).expect(200)
    expect(editorPlans.body.data.canEdit).toBe(true)

    const created = await agent
      .post('/api/v1/weekly-plans')
      .set('X-CSRF-Token', login.body.data.csrfToken)
      .send(plan)
      .expect(201)
    expect(created.body.data.plan).toMatchObject(plan)
    expect(mocks.pool.execute.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO weekly_plans'))).toBe(true)

    mocks.state.user!.email = email
    await agent
      .put(`/api/v1/weekly-plans/${created.body.data.plan.id}`)
      .set('X-CSRF-Token', login.body.data.csrfToken)
      .send({ ...plan, items: [{ ...plan.items[0], status: 'completed' }] })
      .expect(403)

    mocks.state.user!.email = 'infothetfund@gmail.com'
    await agent
      .put(`/api/v1/weekly-plans/${created.body.data.plan.id}`)
      .set('X-CSRF-Token', login.body.data.csrfToken)
      .send({ ...plan, items: [{ ...plan.items[0], status: 'completed' }] })
      .expect(200)
    const updateCall = mocks.pool.execute.mock.calls.find(([sql]) => String(sql).includes('UPDATE weekly_plans'))
    expect(updateCall?.[1]).toContain(JSON.stringify([{ text: plan.items[0].text, status: 'completed' }]))
  })
})
