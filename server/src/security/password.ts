import argon2 from 'argon2'
import { HttpError } from '../errors.js'

const commonPasswords = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  'password1234',
  'qwerty',
  'qwerty123',
  'qwerty123456',
  'admin',
  'admin123',
  'admin123456',
  'welcome',
  'welcome1',
  'welcome123',
  'letmein',
  'letmein123',
  'changeme',
  'changeme123',
  'iloveyou',
  'iloveyou123',
  'abc123',
  '123456789',
  '1234567890',
])

export function assertStrongPassword(password: string): void {
  const normalized = password.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (
    password.length < 12 ||
    password.length > 128 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password) ||
    commonPasswords.has(normalized) ||
    ['password', 'qwerty', 'welcome', 'letmein', 'changeme'].some((common) => normalized.startsWith(common))
  ) {
    throw new HttpError(
      400,
      'WEAK_PASSWORD',
      'Password must be 12–128 characters and include lowercase, uppercase, a number, and a special character; common passwords are not allowed.',
    )
  }
}

export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id })
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password)
