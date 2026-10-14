import mysql, { Pool } from 'mysql2/promise'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function createDatabasePool(migration = false): Pool {
  const user = migration ? required('DB_MIGRATION_USER') : required('DB_USER')
  const password = migration ? required('DB_MIGRATION_PASSWORD') : required('DB_PASSWORD')
  const port = Number(process.env.DB_PORT ?? '3306')
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be a valid TCP port')
  }

  return mysql.createPool({
    host: required('DB_HOST'),
    port,
    database: required('DB_NAME'),
    user,
    password,
    charset: 'utf8mb4',
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    timezone: 'Z',
    dateStrings: true,
  })
}
