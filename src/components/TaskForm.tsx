import { FormEvent, useState } from 'react'
import { Subtask, Task, TaskPriority, TaskStatus, STATUS_LABELS, PRIORITY_LABELS, FollowUp } from '../types/task'
import { formatDate, nowISO } from '../utils/dateUtils'
import { addFollowUp, deleteFollowUp, toggleFollowUp } from '../utils/taskUtils'

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
  const [subtasks, setSubtasks] = useState<Subtask[]>(initial.subtasks ?? [])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [followUps, setFollowUps] = useState<FollowUp[]>(initial.followUps)
  const [newFollowUpDate, setNewFollowUpDate] = useState('')
  const [newFollowUpNote, setNewFollowUpNote] = useState('')
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
      subtasks,
      followUps,
      updatedAt: nowISO(),
    })
  }

  function handleAddFollowUp() {
    if (!newFollowUpDate) return
    const updated = addFollowUp(initial, {
      id: crypto.randomUUID(),
      date: newFollowUpDate,
      note: newFollowUpNote.trim(),
      completed: false,
    })
    setFollowUps(updated.followUps)
    setNewFollowUpDate('')
    setNewFollowUpNote('')
  }

  function handleAddSubtask() {
    const subtaskTitle = newSubtaskTitle.trim()
    if (!subtaskTitle) return
    setSubtasks((current) => [...current, { id: crypto.randomUUID(), title: subtaskTitle, done: false }])
    setNewSubtaskTitle('')
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

      <div className="border-t border-slate-400/15 pt-4 dark:border-teal-800">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-ink dark:text-paper">Subtasks</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {subtasks.filter((subtask) => subtask.done).length} of {subtasks.length} completed
          </span>
        </div>
        {subtasks.length > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-400/15" role="progressbar"
            aria-valuenow={subtasks.filter((subtask) => subtask.done).length}
            aria-valuemin={0}
            aria-valuemax={subtasks.length}
            aria-label="Subtask completion">
            <div
              className="h-full rounded-full bg-teal-700 transition-all"
              style={{ width: `${(subtasks.filter((subtask) => subtask.done).length / subtasks.length) * 100}%` }}
            />
          </div>
        )}
        {subtasks.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-2 rounded-lg bg-paper/70 px-3 py-2 dark:bg-teal-800/60">
                <input
                  type="checkbox"
                  checked={subtask.done}
                  onChange={() => setSubtasks((current) =>
                    current.map((item) => item.id === subtask.id ? { ...item, done: !item.done } : item),
                  )}
                  aria-label={`Mark ${subtask.title} as ${subtask.done ? 'incomplete' : 'complete'}`}
                  className="accent-teal-700"
                />
                <input
                  value={subtask.title}
                  onChange={(e) => setSubtasks((current) =>
                    current.map((item) => item.id === subtask.id ? { ...item, title: e.target.value } : item),
                  )}
                  aria-label="Subtask title"
                  className={`min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none dark:text-paper ${subtask.done ? 'line-through opacity-50' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setSubtasks((current) => current.filter((item) => item.id !== subtask.id))}
                  aria-label={`Delete ${subtask.title}`}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddSubtask()
              }
            }}
            placeholder="Add a subtask"
            aria-label="New subtask title"
            className="min-w-0 flex-1 rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-teal-700 dark:text-paper"
          />
          <button
            type="button"
            onClick={handleAddSubtask}
            disabled={!newSubtaskTitle.trim()}
            className="rounded-lg bg-gold-500 px-3 py-2 text-sm font-medium text-white hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div className="border-t border-slate-400/15 pt-4 dark:border-teal-800">
        <h3 className="font-medium text-ink dark:text-paper">Follow-ups</h3>
        {followUps.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {followUps.map((followUp) => (
              <div key={followUp.id} className="flex items-start gap-2 rounded-lg bg-paper/70 px-3 py-2 dark:bg-teal-800/60">
                <input
                  type="checkbox"
                  checked={followUp.completed}
                  onChange={() => setFollowUps((current) => toggleFollowUp({ ...initial, followUps: current }, followUp.id).followUps)}
                  className="mt-1 accent-teal-700"
                  aria-label={`Mark follow-up for ${followUp.date} as complete`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium text-ink dark:text-paper ${followUp.completed ? 'line-through opacity-50' : ''}`}>
                    {followUp.date}
                  </p>
                  {followUp.note && <p className="text-xs text-slate-500 dark:text-slate-400">{followUp.note}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setFollowUps((current) => deleteFollowUp({ ...initial, followUps: current }, followUp.id).followUps)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 grid grid-cols-[auto_1fr_auto] gap-2">
          <input
            type="date"
            value={newFollowUpDate}
            onChange={(e) => setNewFollowUpDate(e.target.value)}
            aria-label="New follow-up date"
            className="rounded-lg border border-slate-400/30 bg-transparent px-2 py-2 text-sm text-ink focus:border-teal-700 dark:text-paper dark:[color-scheme:dark]"
          />
          <input
            value={newFollowUpNote}
            onChange={(e) => setNewFollowUpNote(e.target.value)}
            placeholder="Follow-up note"
            className="min-w-0 rounded-lg border border-slate-400/30 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-teal-700 dark:text-paper"
          />
          <button
            type="button"
            onClick={handleAddFollowUp}
            disabled={!newFollowUpDate}
            className="rounded-lg bg-gold-500 px-3 py-2 text-sm font-medium text-white hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span>Created {formatDate(initial.createdAt.slice(0, 10))}</span>
        <span>Updated {formatDate(initial.updatedAt.slice(0, 10))}</span>
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
