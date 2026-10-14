import '../env.js'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDatabasePool } from './connection.js'

const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations')

async function main() {
  const pool = createDatabasePool(true)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    const [appliedRows] = await pool.query('SELECT version FROM schema_migrations')
    const applied = new Set((appliedRows as { version: string }[]).map((row) => row.version))
    const files = (await readdir(migrationsDirectory)).filter((file) => /^\d+_[\w-]+\.sql$/.test(file)).sort()

    for (const file of files) {
      if (applied.has(file)) continue
      const sql = await readFile(path.join(migrationsDirectory, file), 'utf8')
      const statements = sql
        .split(/;\s*(?:\r?\n|$)/)
        .map((statement) => statement.trim())
        .filter(Boolean)
      for (const statement of statements) await pool.query(statement)
      await pool.execute('INSERT INTO schema_migrations (version) VALUES (?)', [file])
      console.info(`Applied migration ${file}`)
    }
    if (files.length === 0) console.info('No database migrations found.')
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error('Database migration failed.')
  console.error(error instanceof Error ? error.message : 'Unknown migration error')
  process.exitCode = 1
})
