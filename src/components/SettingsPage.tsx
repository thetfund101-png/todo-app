import { ChangeEvent, useRef, useState } from 'react'
import { Task, TaskPriority, PRIORITY_LABELS } from '../types/task'
import { Theme } from './Topbar'
import { Modal } from './Modal'

export function SettingsPage({
  theme,
  onThemeChange,
  defaultPriority,
  onDefaultPriorityChange,
  defaultCategory,
  onDefaultCategoryChange,
  categories,
  tasks,
  onImport,
  onClearAll,
}: {
  theme: Theme
  onThemeChange: (t: Theme) => void
  defaultPriority: TaskPriority
  onDefaultPriorityChange: (p: TaskPriority) => void
  defaultCategory: string
  onDefaultCategoryChange: (c: string) => void
  categories: string[]
  tasks: Task[]
  onImport: (tasks: Task[]) => void
  onClearAll: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [importError, setImportError] = useState('')

  function exportTasks() {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `thet-fund-tasks-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportCSV() {
    const header = ['title', 'description', 'status', 'priority', 'category', 'dueDate']
    const rows = tasks.map((t) =>
      header.map((h) => `"${String((t as any)[h] ?? '').replace(/"/g, '""')}"`).join(','),
    )
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `thet-fund-tasks-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        if (!Array.isArray(data)) throw new Error('Not a list of tasks')
        onImport(data as Task[])
        setImportError('')
      } catch (err) {
        setImportError('That file could not be read as a valid tasks export.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const selectClass =
    'w-full rounded-lg border border-slate-400/25 bg-transparent px-3 py-2 text-sm text-ink focus:border-teal-700 dark:text-paper dark:[color-scheme:dark]'

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <section>
        <h2 className="mb-3 font-display text-lg text-ink dark:text-paper">Appearance</h2>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => onThemeChange(t)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                theme === t
                  ? 'border-teal-700 bg-teal-900 text-white'
                  : 'border-slate-400/25 text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-teal-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink dark:text-paper">Task defaults</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400">
              Default priority
            </label>
            <select value={defaultPriority} onChange={(e) => onDefaultPriorityChange(e.target.value as TaskPriority)} className={selectClass}>
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400">
              Default category
            </label>
            <select value={defaultCategory} onChange={(e) => onDefaultCategoryChange(e.target.value)} className={selectClass}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink dark:text-paper">Data</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Tasks are stored only in this browser. Export a backup before clearing site data or switching devices.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportTasks} className="rounded-lg border border-slate-400/25 px-3.5 py-2 text-sm font-medium text-ink hover:bg-white dark:text-paper dark:hover:bg-teal-800">
            Export as JSON
          </button>
          <button onClick={exportCSV} className="rounded-lg border border-slate-400/25 px-3.5 py-2 text-sm font-medium text-ink hover:bg-white dark:text-paper dark:hover:bg-teal-800">
            Export as CSV
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-slate-400/25 px-3.5 py-2 text-sm font-medium text-ink hover:bg-white dark:text-paper dark:hover:bg-teal-800">
            Import tasks
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />
        </div>
        {importError && <p className="mt-2 text-sm text-red-500">{importError}</p>}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-red-500">Danger zone</h2>
        <button
          onClick={() => setConfirmClear(true)}
          className="rounded-lg border border-red-500/40 px-3.5 py-2 text-sm font-medium text-red-500 hover:bg-red-500/5"
        >
          Delete everything
        </button>
      </section>

      {confirmClear && (
        <Modal title="Are you sure?" onClose={() => setConfirmClear(false)}>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This will permanently remove all tasks stored on this device. This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={() => setConfirmClear(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-paper dark:text-slate-400 dark:hover:bg-teal-800"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onClearAll()
                setConfirmClear(false)
              }}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              Delete everything
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
