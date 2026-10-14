import { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../errors.js'
import { logger } from '../logger.js'

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    })
    return
  }
  if (error instanceof ZodError) {
    response
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Request is invalid.', details: error.flatten() } })
    return
  }
  if (typeof error === 'object' && error !== null && 'type' in error) {
    const parserError = error as { type?: string }
    if (parserError.type === 'entity.parse.failed') {
      response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } })
      return
    }
    if (parserError.type === 'entity.too.large') {
      response
        .status(413)
        .json({ error: { code: 'REQUEST_TOO_LARGE', message: 'Request body exceeds the allowed size.' } })
      return
    }
  }

  const requestId = response.getHeader('X-Request-ID')
  logger.error({ err: error, requestId }, 'Unhandled request error')
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' } })
}
