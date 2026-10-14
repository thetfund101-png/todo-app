import rateLimit from 'express-rate-limit'

function createLimit(limit: number, windowMs = 15 * 60 * 1000) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
  })
}

export const loginRateLimit = createLimit(5)
export const refreshRateLimit = createLimit(15)
export const passwordRateLimit = createLimit(5)
