import { NextFunction, Request, Response } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { RowDataPacket } from 'mysql2'
import { config } from '../config.js'
import { pool } from '../db/pool.js'
import { HttpError } from '../errors.js'
import { Role } from '../types.js'

interface UserRow extends RowDataPacket {
  id: string
  name: string
  email: string
  role: Role
}

export async function requireAuth(request: Request, _response: Response, next: NextFunction) {
  const token = request.cookies?.thet_access
  if (typeof token !== 'string') {
    next(new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.'))
    return
  }

  let payload: string | JwtPayload
  try {
    payload = jwt.verify(token, config.accessSecret)
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.'))
    } else {
      next(error)
    }
    return
  }
  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    next(new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.'))
    return
  }

  try {
    const [rows] = await pool.execute<UserRow[]>(
      'SELECT id, name, email, role FROM users WHERE id = ? AND is_active = TRUE',
      [payload.sub],
    )
    const user = rows[0]
    if (!user) {
      next(new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.'))
      return
    }
    request.user = { id: user.id, name: user.name, email: user.email, role: user.role }
    next()
  } catch (error) {
    next(error)
  }
}

export function requireRoles(...roles: Role[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.user) {
      next(new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.'))
      return
    }
    if (!roles.includes(request.user.role)) {
      next(new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'))
      return
    }
    next()
  }
}

export function taskVisibilitySql(user: NonNullable<Request['user']>): { clause: string; values: string[] } {
  if (user.role === 'admin' || user.role === 'manager') return { clause: '1 = 1', values: [] }
  return { clause: '(t.created_by = ? OR t.assigned_to = ?)', values: [user.id, user.id] }
}
