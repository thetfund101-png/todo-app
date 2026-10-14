import { FormEvent, useState } from 'react'
import { ApiError } from '../api/client'

export function ChangePasswordPage({
  onSubmit,
  onCancel,
}: {
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>
  onCancel: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    setSaving(true)
    try {
      await onSubmit(currentPassword, newPassword)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Password could not be changed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-lg rounded-xl border border-slate-400/20 bg-white p-6 dark:border-teal-800 dark:bg-teal-900/60"
    >
      <h2 className="font-display text-xl text-ink dark:text-paper">Change password</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Use at least 12 characters with uppercase, lowercase, a number, and a symbol. You will need to sign in again
        afterward.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-500">
          {error}
        </p>
      )}
      <label className="mt-4 block text-sm text-slate-600 dark:text-slate-300">
        Current password
        <input
          required
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-ink dark:text-paper"
        />
      </label>
      <label className="mt-4 block text-sm text-slate-600 dark:text-slate-300">
        New password
        <input
          required
          minLength={12}
          maxLength={128}
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-ink dark:text-paper"
        />
      </label>
      <label className="mt-4 block text-sm text-slate-600 dark:text-slate-300">
        Confirm new password
        <input
          required
          minLength={12}
          maxLength={128}
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-ink dark:text-paper"
        />
      </label>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-paper dark:hover:bg-teal-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-teal-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Update password'}
        </button>
      </div>
    </form>
  )
}
