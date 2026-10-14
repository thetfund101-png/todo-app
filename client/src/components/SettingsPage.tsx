import { ChangeEvent, useRef, useState } from 'react'
import { TaskPriority, PRIORITY_LABELS } from '../types/task'
import { Theme } from './Topbar'
import { Modal } from './Modal'

interface CategoryOption {
  id: string
  name: string
}

export function SettingsPage({
  theme,
  onThemeChange,
  defaultPriority,
  onDefaultPriorityChange,
  defaultCategory,
  onDefaultCategoryChange,
  categories,
  isAdmin,
  onExport,
  onImport,
  onBulkReset,
}: {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  defaultPriority: TaskPriority
  onDefaultPriorityChange: (priority: TaskPriority) => void
  defaultCategory: string
  onDefaultCategoryChange: (categoryId: string) => void
  categories: CategoryOption[]
  isAdmin: boolean
  onExport: (format: 'json' | 'csv' | 'docx') => Promise<void>
  onImport: (file: File) => Promise<void>
  onBulkReset: (currentPassword: string) => Promise<void>
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function exportFile(format: 'json' | 'csv' | 'docx') {
    setBusy(true)
    setError('')
    try {
      await onExport(format)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await onImport(file)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The JSON file could not be imported.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmBulkReset() {
    setBusy(true)
    setError('')
    try {
      await onBulkReset(currentPassword)
      setCurrentPassword('')
      setConfirmReset(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Bulk reset failed.')
    } finally {
      setBusy(false)
    }
  }

  const selectClass =
    'w-full rounded-lg border border-slate-400/25 bg-transparent px-3 py-2 text-sm text-ink focus:border-teal-700 dark:text-paper dark:[color-scheme:dark]'

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <section>
        <h2 className="mb-3 font-display text-lg text-ink dark:text-paper">Appearance</h2>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as Theme[]).map((option) => (
            <button
              key={option}
              onClick={() => onThemeChange(option)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                theme === option
                  ? 'border-teal-700 bg-teal-900 text-white'
                  : 'border-slate-400/25 text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-teal-800'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink dark:text-paper">Task defaults</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Default priority
            <select
              value={defaultPriority}
              onChange={(event) => onDefaultPriorityChange(event.target.value as TaskPriority)}
              className={`${selectClass} mt-1`}
            >
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Default category
            <select
              value={defaultCategory}
              onChange={(event) => onDefaultCategoryChange(event.target.value)}
              className={`${selectClass} mt-1`}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink dark:text-paper">Data and backups</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Data is stored in the shared THET Fund database. Exports are scoped to the tasks you are allowed to access.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => void exportFile('json')}
            className="rounded-lg border border-slate-400/25 px-3.5 py-2 text-sm font-medium text-ink disabled:opacity-50 dark:text-paper"
          >
            Export JSON
          </button>
          <button
            disabled={busy}
            onClick={() => void exportFile('csv')}
            className="rounded-lg border border-slate-400/25 px-3.5 py-2 text-sm font-medium text-ink disabled:opacity-50 dark:text-paper"
          >
            Export CSV
          </button>
          <button
            disabled={busy}
            onClick={() => void exportFile('docx')}
            className="rounded-lg border border-slate-400/25 px-3.5 py-2 text-sm font-medium text-ink disabled:opacity-50 dark:text-paper"
          >
            Export Word (.docx)
          </button>
          <button
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-slate-400/25 px-3.5 py-2 text-sm font-medium text-ink disabled:opacity-50 dark:text-paper"
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleFileChange(event)}
          />
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {error}
          </p>
        )}
      </section>

      {isAdmin && (
        <section>
          <h2 className="mb-3 font-display text-lg text-red-500">Danger zone</h2>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Bulk reset soft-deletes every active task for the organization. You must confirm with your administrator
            password.
          </p>
          <button
            onClick={() => setConfirmReset(true)}
            className="rounded-lg border border-red-500/40 px-3.5 py-2 text-sm font-medium text-red-500 hover:bg-red-500/5"
          >
            Reset all tasks
          </button>
        </section>
      )}

      {confirmReset && (
        <Modal title="Reset all organization tasks?" onClose={() => setConfirmReset(false)}>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This will soft-delete all active tasks, including tasks belonging to other users. This cannot be undone from
            the app.
          </p>
          <label className="mt-4 block text-sm text-ink dark:text-paper">
            Confirm your password
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={`${selectClass} mt-1`}
            />
          </label>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-500">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setConfirmReset(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500">
              Cancel
            </button>
            <button
              disabled={busy || !currentPassword}
              onClick={() => void confirmBulkReset()}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Resetting…' : 'Reset all tasks'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
