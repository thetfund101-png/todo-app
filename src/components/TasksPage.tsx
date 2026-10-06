import { useMemo, useState } from 'react'
import { Task, TaskStatus, STATUS_LABELS } from '../types/task'
import { TaskCard } from './TaskCard'
import { TaskFilterBar } from './TaskFilter'
import { TaskFilters, SortKey, TaskQuickFilter, applyQuickFilter, filterTasks, sortTasks } from '../utils/taskUtils'
import { getOpenFollowUps } from '../utils/taskUtils'

const TABS: { id: TaskStatus | 'follow-up' | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: STATUS_LABELS.todo },
  { id: 'in-progress', label: STATUS_LABELS['in-progress'] },
  { id: 'completed', label: STATUS_LABELS.completed },
  { id: 'follow-up', label: 'Pending follow-up' },
]

const QUICK_FILTERS: { id: TaskQuickFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Due today' },
  { id: 'upcoming', label: 'Upcoming' },
]

export function TasksPage({
  tasks,
  categories,
  onToggleComplete,
  onEdit,
  onDelete,
  onDuplicate,
  onAddFollowUp,
}: {
  tasks: Task[]
  categories: string[]
  onToggleComplete: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onDuplicate: (task: Task) => void
  onAddFollowUp: (task: Task) => void
}) {
  const [tab, setTab] = useState<TaskStatus | 'follow-up' | 'all'>('all')
  const [quickFilter, setQuickFilter] = useState<TaskQuickFilter>('all')
  const [filters, setFilters] = useState<TaskFilters>({
    status: 'all',
    priority: 'all',
    category: 'all',
    query: '',
  })
  const [sortKey, setSortKey] = useState<SortKey>('newest')

  const visible = useMemo(() => {
    const tabFiltered = tab === 'all'
      ? tasks
      : tab === 'follow-up'
      ? tasks.filter((t) => getOpenFollowUps(t).length > 0)
      : tasks.filter((t) => t.status === tab)
    const filtered = filterTasks(applyQuickFilter(tabFiltered, quickFilter), filters)
    return sortTasks(filtered, sortKey)
  }, [tasks, tab, quickFilter, filters, sortKey])

  return (
    <div className="flex flex-col gap-4">
      <TaskFilterBar filters={filters} onFiltersChange={setFilters} categories={categories} sortKey={sortKey} onSortChange={setSortKey} />

      <div className="flex flex-wrap gap-2" aria-label="Quick task filters">
        {QUICK_FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setQuickFilter(filter.id)}
            aria-pressed={quickFilter === filter.id}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              quickFilter === filter.id
                ? 'bg-teal-900 text-white dark:bg-gold-500'
                : 'border border-slate-400/25 text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-teal-800'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1 border-b border-slate-400/15 dark:border-teal-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2 text-sm font-medium ${
              tab === t.id ? 'text-teal-800 dark:text-gold-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-teal-800 dark:bg-gold-400" />}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-400/30 px-6 py-10 text-center">
          <p className="font-display text-lg text-ink dark:text-paper">Nothing here</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Try a different filter, or create a new task.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onToggleComplete={onToggleComplete}
              onEdit={onEdit}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onAddFollowUp={onAddFollowUp}
            />
          ))}
        </div>
      )}
    </div>
  )
}
