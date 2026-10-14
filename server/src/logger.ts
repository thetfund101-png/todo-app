import { pino } from 'pino'
import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'
import { config } from './config.js'

export const logger = pino({
  level: config.nodeEnv === 'test' ? 'silent' : config.isProduction ? 'info' : 'debug',
  redact: {
    paths: [
      'password',
      'password_hash',
      'token',
      'token_hash',
      'authorization',
      'cookie',
      'headers.authorization',
      'headers.cookie',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
})

export const requestLogger: RequestHandler = (request, response, next) => {
  const incomingId = request.headers['x-request-id']
  const requestId = typeof incomingId === 'string' && /^[\w.-]{1,100}$/.test(incomingId) ? incomingId : randomUUID()
  const startedAt = Date.now()
  response.setHeader('X-Request-ID', requestId)
  response.on('finish', () => {
    logger.info(
      {
        requestId,
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        remoteAddress: request.socket.remoteAddress,
      },
      'request completed',
    )
  })
  next()
}
