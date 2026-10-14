import { randomBytes, timingSafeEqual } from 'node:crypto'
import { NextFunction, Request, Response } from 'express'
import { config } from '../config.js'
import { HttpError } from '../errors.js'

export const csrfCookieName = 'thet_csrf'
const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function setCsrfToken(_request: Request, response: Response): string {
  const token = randomBytes(32).toString('hex')
  response.cookie(csrfCookieName, token, {
    httpOnly: false,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
  return token
}

export function csrfProtection(request: Request, _response: Response, next: NextFunction) {
  if (!unsafeMethods.has(request.method)) {
    next()
    return
  }

  const origin = request.get('origin')
  if (origin && origin !== config.clientOrigin) {
    next(new HttpError(403, 'CSRF_REJECTED', 'Request origin is not allowed.'))
    return
  }
  const cookieToken = request.cookies?.[csrfCookieName]
  const headerToken = request.get('x-csrf-token')
  if (
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    cookieToken.length !== headerToken.length ||
    !timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    next(new HttpError(403, 'CSRF_REJECTED', 'CSRF validation failed.'))
    return
  }
  next()
}
