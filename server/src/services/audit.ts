import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'

export async function writeAuditLog(input: {
  userId: string | null
  action: string
  entityType: string
  entityId?: string | null
  ip: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  await pool.execute(
    'INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, ip, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      randomUUID(),
      input.userId,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.ip.slice(0, 45),
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  )
}
