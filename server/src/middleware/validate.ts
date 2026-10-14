import { NextFunction, Request, Response } from 'express'
import { ZodType } from 'zod'
import { HttpError } from '../errors.js'

export function validateBody<T>(schema: ZodType<T>) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      next(new HttpError(400, 'VALIDATION_ERROR', 'Request body is invalid.', parsed.error.flatten()))
      return
    }
    request.body = parsed.data
    next()
  }
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const parsed = schema.safeParse(request.query)
    if (!parsed.success) {
      next(new HttpError(400, 'VALIDATION_ERROR', 'Query parameters are invalid.', parsed.error.flatten()))
      return
    }
    Object.assign(request.query, parsed.data)
    next()
  }
}

export function validateParams<T>(schema: ZodType<T>) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const parsed = schema.safeParse(request.params)
    if (!parsed.success) {
      next(new HttpError(400, 'VALIDATION_ERROR', 'URL parameters are invalid.', parsed.error.flatten()))
      return
    }
    Object.assign(request.params, parsed.data)
    next()
  }
}
