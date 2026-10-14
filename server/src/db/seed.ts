import '../env.js'
import argon2 from 'argon2'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from './connection.js'
import { assertStrongPassword } from '../security/password.js'

const builtinCategories = [
  'General',
  'Administration',
  'Finance',
  'IT',
  'Website',
  'Meetings',
  'Reports',
  'Projects',
  'Communications',
  'HR',
  'Grants',
]

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

async function main() {
  const name = required('ADMIN_NAME').trim()
  const email = required('ADMIN_EMAIL').trim().toLowerCase()
  const password = required('ADMIN_PASSWORD')
  assertStrongPassword(password)
  if (!name || name.length > 120) throw new Error('ADMIN_NAME must contain 1 to 120 characters.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('ADMIN_EMAIL must be a valid email address.')
  }

  const pool = createDatabasePool(true)
  try {
    const [existingAdmin] = await pool.execute('SELECT id FROM users WHERE role = ? LIMIT 1', ['admin'])
    const rows = existingAdmin as { id: string }[]
    if (rows.length > 0) throw new Error('An admin user already exists; seed will not reset or replace it.')

    const userId = randomUUID()
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id })
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.execute('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)', [
        userId,
        name,
        email,
        passwordHash,
        'admin',
      ])
      for (const category of builtinCategories) {
        await connection.execute('INSERT INTO categories (id, name, is_builtin, created_by) VALUES (?, ?, ?, ?)', [
          randomUUID(),
          category,
          true,
          null,
        ])
      }
      const [generalRows] = await connection.execute('SELECT id FROM categories WHERE name = ?', ['General'])
      const [general] = generalRows as { id: string }[]
      await connection.execute(
        'INSERT INTO user_settings (user_id, theme, default_priority, default_category_id) VALUES (?, ?, ?, ?)',
        [userId, 'system', 'medium', general.id],
      )
      await connection.commit()
      console.info(`Created initial administrator ${email} and seeded built-in categories.`)
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error('Database seed failed.')
  console.error(error instanceof Error ? error.message : 'Unknown seed error')
  process.exitCode = 1
})
