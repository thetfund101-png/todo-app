import './env.js'
import { z } from 'zod'

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().url(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
  WEEKLY_PLAN_EDITOR_EMAIL: z.string().email().default('infothetfund@gmail.com'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
})

const parsed = environmentSchema.safeParse(process.env)
if (!parsed.success) {
  throw new Error(
    `Invalid server configuration: ${parsed.error.issues.map((issue) => issue.path.join('.') + ' ' + issue.message).join('; ')}`,
  )
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.COOKIE_SECURE !== 'true') {
  throw new Error('COOKIE_SECURE=true is required in production.')
}
if (parsed.data.COOKIE_SAME_SITE === 'none' && parsed.data.COOKIE_SECURE !== 'true') {
  throw new Error('COOKIE_SECURE=true is required when COOKIE_SAME_SITE=none.')
}
if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.')
}
if (new URL(parsed.data.CLIENT_ORIGIN).origin !== parsed.data.CLIENT_ORIGIN.replace(/\/$/, '')) {
  throw new Error('CLIENT_ORIGIN must be a single origin without a path, query, or fragment.')
}

export const config = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  clientOrigin: parsed.data.CLIENT_ORIGIN,
  trustProxyHops: parsed.data.TRUST_PROXY_HOPS,
  weeklyPlanEditorEmail: parsed.data.WEEKLY_PLAN_EDITOR_EMAIL.toLowerCase(),
  accessSecret: parsed.data.JWT_ACCESS_SECRET,
  refreshSecret: parsed.data.JWT_REFRESH_SECRET,
  cookieSecure: parsed.data.COOKIE_SECURE === 'true',
  cookieSameSite: parsed.data.COOKIE_SAME_SITE,
  isProduction: parsed.data.NODE_ENV === 'production',
}
