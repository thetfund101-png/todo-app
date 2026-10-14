import { FormEvent, useState } from 'react'
import { ApiError } from '../api/client'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { login, error: serviceError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Sign in could not be completed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-10 dark:bg-teal-950">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-slate-400/20 bg-white p-7 shadow-card dark:border-teal-800 dark:bg-teal-900"
      >
        <img
          src="/THET Fund Logo-01.jpg"
          alt="THET Fund"
          className="mx-auto mb-6 h-32 w-48 object-cover object-[center_72%]"
        />
        <h1 className="text-center font-display text-2xl text-ink dark:text-paper">Task Tracker sign in</h1>
        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          Use the account provided by your THET Fund administrator.
        </p>
        {(error || serviceError) && (
          <p role="alert" className="mt-5 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
            {error || serviceError}
          </p>
        )}
        <label className="mt-6 block text-sm font-medium text-slate-600 dark:text-slate-300">
          Email
          <input
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-ink dark:text-paper"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-600 dark:text-slate-300">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-ink dark:text-paper"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-teal-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
