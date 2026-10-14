import { describe, expect, it } from 'vitest'
import { legacyImportTaskSchema, taskInputSchema } from '../src/schemas.js'
import { assertStrongPassword } from '../src/security/password.js'

describe('input schemas and password policy', () => {
  it('rejects unknown task fields and invalid calendar dates', () => {
    const base = {
      title: 'Review grant report',
      category: 'Reports',
      dueDate: '2026-02-30',
    }
    expect(taskInputSchema.safeParse(base).success).toBe(false)
    expect(taskInputSchema.safeParse({ ...base, dueDate: null, owner: 'attacker' }).success).toBe(false)
  })

  it('accepts legacy imports only within the supported schema', () => {
    const parsed = legacyImportTaskSchema.safeParse({
      title: 'Imported task',
      category: 'General',
      subtasks: [{ title: 'Prepare notes', done: false }],
      followUps: [{ date: '2026-11-15', note: 'Check status', completed: false }],
    })
    expect(parsed.success).toBe(true)
    expect(legacyImportTaskSchema.safeParse({ title: 'Imported task', unexpected: true }).success).toBe(false)
  })

  it('enforces length, mixed-case, numeric, special-character, and common-password checks', () => {
    expect(() => assertStrongPassword('Safe-Report-482!')).not.toThrow()
    expect(() => assertStrongPassword('short')).toThrow()
    expect(() => assertStrongPassword('alllowercase123!')).toThrow()
    expect(() => assertStrongPassword('Password123!')).toThrow()
  })
})
