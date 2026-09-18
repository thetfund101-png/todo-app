import { ReactNode } from 'react'
import { Task } from '../types/task'
import { formatDueLabel, getDueState } from '../utils/dateUtils'
import { getOpenFollowUps, subtaskProgress } from '../utils/taskUtils'

const PRIORITY_DOT: Record<Task['priority'], string> = {
  urgent: 'bg-red-500',
  high: 'bg-gold-500',
  medium: 'bg-amber-300',
  low: 'bg-teal-700',
}

const STATUS_STYLES: Record<Task['status'], string> = {
  todo: 'bg-slate-400/15 text-slate-500 dark:text-slate-300',
  'in-progress': 'bg-teal-700/15 text-teal-800 dark:text-teal-300',
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'on-hold': 'bg-gold-400/15 text-gold-500 dark:text-gold-400',
}

const STATUS_TEXT: Record<Task['status'], string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  completed: 'Completed',
  'on-hold': 'On hold',
}

export function TaskCard({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  onDuplicate,
  onAddFollowUp,
}: {
  task: Task
  onToggleComplete: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onDuplicate: (task: Task) => void
  onAddFollowUp: (task: Task) => void
}) {
  const dueState = getDueState(task.dueDate)
  const progress = subtaskProgress(task)
  const openFollowUps = getOpenFollowUps(task)
  const isDone = task.status === 'completed'

  const dueColor =
    dueState === 'overdue' && !isDone
      ? 'text-red-500'
      : dueState === 'today' && !isDone
      ? 'text-gold-500'
      : 'text-slate-500 dark:text-slate-400'

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-slate-400/15 bg-white px-4 py-3.5 shadow-card transition hover:border-teal-700/25 dark:bg-teal-900/60 dark:border-teal-800">
      <button
        onClick={() => onToggleComplete(task.id)}
        aria-label={isDone ? 'Mark as not completed' : 'Mark as completed'}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
          isDone
            ? 'border-teal-700 bg-teal-700 text-white'
            : 'border-slate-400/50 hover:border-teal-700'
        }`}
      >
        {isDone && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`truncate font-medium text-ink dark:text-paper ${isDone ? 'line-through opacity-50' : ''}`}>
            {task.title}
          </p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[task.status]}`}>
            {STATUS_TEXT[task.status]}
          </span>
        </div>

        {task.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{task.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority]}`} />
            {task.priority[0].toUpperCase() + task.priority.slice(1)}
          </span>
          <span>{task.category}</span>
          {task.dueDate && <span className={dueColor}>{formatDueLabel(task.dueDate)}</span>}
        </div>

        {openFollowUps.length > 0 && (
          <button
            onClick={() => onAddFollowUp(task)}
            className="mt-2 flex items-center gap-1.5 rounded-md bg-gold-400/15 px-2 py-1 text-xs font-medium text-gold-500 hover:bg-gold-400/25"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {openFollowUps.length} open follow-up{openFollowUps.length === 1 ? '' : 's'}
          </button>
        )}

        {isDone && openFollowUps.length === 0 && (
          <button
            onClick={() => onAddFollowUp(task)}
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900 dark:text-gold-400 dark:hover:text-gold-300"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add follow-up
          </button>
        )}

        {progress && (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-400/15">
              <div
                className="h-full rounded-full bg-teal-700 transition-all"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              {progress.done}/{progress.total} subtasks
            </span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <IconButton label="Edit" onClick={() => onEdit(task)}>
          <path d="M4 20h4l10-10-4-4L4 16v4z" />
          <path d="M13 7l4 4" />
        </IconButton>
        <IconButton label="Duplicate" onClick={() => onDuplicate(task)}>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 012-2h10" />
        </IconButton>
        <IconButton label="Delete" onClick={() => onDelete(task.id)} danger>
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" />
          <path d="M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
        </IconButton>
      </div>
    </div>
  )
}

function IconButton({
  children,
  onClick,
  label,
  danger,
}: {
  children: ReactNode
  onClick: () => void
  label: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-md p-1.5 text-slate-400 hover:bg-paper dark:hover:bg-teal-800 ${
        danger ? 'hover:text-red-500' : 'hover:text-teal-800 dark:hover:text-paper'
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}
