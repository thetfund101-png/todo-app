import { FormEvent, useState } from 'react'
import { Task, TaskPriority, TaskStatus, STATUS_LABELS, PRIORITY_LABELS } from '../types/task'
import { nowISO } from '../utils/dateUtils'

export function TaskForm({
  initial,
  categories,
  onSave,
  onCancel,
}: {
  initial: Task
  categories: string[]
  onSave: (task: Task) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [priority, setPriority] = useState<TaskPriority>(initial.priority)
  const [status, setStatus] = useState<TaskStatus>(initial.status)
  const [category, setCategory] = useState(initial.category)
  const [customCategory, setCustomCategory] = useState('')
  const [dueDate, setDueDate] = useState(initial.dueDate ?? '')
  const [error, setError] = useState('')

  const isNewCategory = category === '__new__'

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Give the task a title.')
      return
    }
    const finalCategory = isNewCategory ? customCategory.trim() || 'General' : category
    onSave({
      ...initial,
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      category: finalCategory,
      dueDate: dueDate || null,
      updatedAt: nowISO(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400">
          Task title
        </label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Update THET Fund website"
          className="w-full rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-ink placeholder:text-slate-400 focus:border-teal-700 dark:text-paper"
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add the newly approved documents..."
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-ink placeholder:text-slate-400 focus:border-teal-700 dark:text-paper"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="w-full rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-ink focus:border-teal-700 dark:text-paper dark:[color-scheme:dark]"
          >
            {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className="w-full rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-ink focus:border-teal-700 dark:text-paper dark:[color-scheme:dark]"
          >
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-ink focus:border-teal-700 dark:text-paper dark:[color-scheme:dark]"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__new__">+ New category…</option>
          </select>
          {isNewCategory && (
            <input
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Category name"
              className="mt-2 w-full rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-ink placeholder:text-slate-400 focus:border-teal-700 dark:text-paper"
            />
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400">
            Due date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-ink focus:border-teal-700 dark:text-paper dark:[color-scheme:dark]"
          />
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-paper dark:text-slate-400 dark:hover:bg-teal-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-teal-900 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          {initial.title ? 'Save changes' : 'Create task'}
        </button>
      </div>
    </form>
  )
}
