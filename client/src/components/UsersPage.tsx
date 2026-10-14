import { FormEvent, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import { UserRole } from '../auth/AuthContext'

interface ManagedUser {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  lastLoginAt: string | null
}

const inputClass =
  'w-full rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-sm text-ink dark:text-paper'

export function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('staff')
  const [password, setPassword] = useState('')
  const [resetTarget, setResetTarget] = useState('')
  const [resetPassword, setResetPassword] = useState('')

  async function loadUsers() {
    setLoading(true)
    try {
      const result = await api.get<{ users: ManagedUser[] }>('/users?page=1&pageSize=100')
      setUsers(result.users)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Users could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  async function createUser(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await api.post('/users', { name, email, role, password })
      setName('')
      setEmail('')
      setRole('staff')
      setPassword('')
      await loadUsers()
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'User could not be created.')
    }
  }

  async function changeRole(user: ManagedUser, nextRole: UserRole) {
    setBusyId(user.id)
    try {
      await api.put(`/users/${user.id}`, { name: user.name, email: user.email, role: nextRole })
      await loadUsers()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'User could not be updated.')
    } finally {
      setBusyId('')
    }
  }

  async function changeActive(user: ManagedUser) {
    setBusyId(user.id)
    try {
      await api.patch(`/users/${user.id}/activation`, { isActive: !user.isActive })
      await loadUsers()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'User status could not be changed.')
    } finally {
      setBusyId('')
    }
  }

  async function resetUserPassword(event: FormEvent) {
    event.preventDefault()
    if (!resetTarget) return
    setBusyId(resetTarget)
    try {
      await api.patch(`/users/${resetTarget}/password`, { password: resetPassword })
      setResetTarget('')
      setResetPassword('')
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Password could not be reset.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <section className="rounded-xl border border-slate-400/20 bg-white p-5 dark:border-teal-800 dark:bg-teal-900/60">
        <h2 className="font-display text-lg text-ink dark:text-paper">Create an account</h2>
        <form onSubmit={createUser} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            aria-label="Name"
            required
            maxLength={120}
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
          <input
            aria-label="Email"
            required
            type="email"
            maxLength={254}
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
          <select
            aria-label="Role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            className={inputClass}
          >
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
          <input
            aria-label="Temporary password"
            required
            minLength={12}
            maxLength={128}
            type="password"
            autoComplete="new-password"
            placeholder="Temporary password (12+ characters)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
          <button className="rounded-lg bg-teal-900 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 sm:col-span-2">
            Create user
          </button>
        </form>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <section className="overflow-hidden rounded-xl border border-slate-400/20 bg-white dark:border-teal-800 dark:bg-teal-900/60">
        <h2 className="border-b border-slate-400/15 px-5 py-4 font-display text-lg text-ink dark:border-teal-800 dark:text-paper">
          Users
        </h2>
        {loading ? (
          <p className="p-5 text-sm text-slate-500">Loading users…</p>
        ) : users.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-paper/70 text-xs uppercase text-slate-500 dark:bg-teal-950/50">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last login</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-400/10 dark:border-teal-800">
                    <td className="px-4 py-3">
                      <span className="block font-medium text-ink dark:text-paper">{user.name}</span>
                      <span className="text-xs text-slate-500">{user.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        disabled={busyId === user.id}
                        aria-label={`Role for ${user.name}`}
                        value={user.role}
                        onChange={(event) => void changeRole(user, event.target.value as UserRole)}
                        className={`${inputClass} max-w-36`}
                      >
                        <option value="staff">Staff</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">{user.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {user.lastLoginAt ? new Date(user.lastLoginAt.replace(' ', 'T') + 'Z').toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={busyId === user.id}
                          onClick={() => void changeActive(user)}
                          className="rounded-md border border-slate-400/25 px-2.5 py-1.5 text-xs text-slate-600 disabled:opacity-50 dark:text-slate-300"
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => {
                            setResetTarget(user.id)
                            setResetPassword('')
                          }}
                          className="rounded-md border border-slate-400/25 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300"
                        >
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {resetTarget && (
        <form
          onSubmit={resetUserPassword}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-gold-400/30 bg-gold-400/10 p-4"
        >
          <label className="min-w-64 flex-1 text-sm text-ink dark:text-paper">
            Set a new temporary password
            <input
              required
              minLength={12}
              maxLength={128}
              type="password"
              autoComplete="new-password"
              value={resetPassword}
              onChange={(event) => setResetPassword(event.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <button
            disabled={busyId === resetTarget}
            className="rounded-lg bg-teal-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Reset password
          </button>
          <button
            type="button"
            onClick={() => setResetTarget('')}
            className="rounded-lg px-3 py-2 text-sm text-slate-500"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  )
}
