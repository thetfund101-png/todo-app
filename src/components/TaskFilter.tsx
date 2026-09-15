import { TaskFilters, SortKey } from '../utils/taskUtils'
import { STATUS_LABELS, PRIORITY_LABELS, TaskStatus, TaskPriority } from '../types/task'

const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  due: 'Due date',
  priority: 'Priority',
  alpha: 'Alphabetical',
}

export function TaskFilterBar({
  filters,
  onFiltersChange,
  categories,
  sortKey,
  onSortChange,
}: {
  filters: TaskFilters
  onFiltersChange: (f: TaskFilters) => void
  categories: string[]
  sortKey: SortKey
  onSortChange: (s: SortKey) => void
}) {
  const selectClass =
    'rounded-lg border border-slate-400/25 bg-transparent px-2.5 py-1.5 text-sm text-ink focus:border-teal-700 dark:text-paper dark:[color-scheme:dark]'

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={filters.query}
          onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
          placeholder="Search tasks..."
          className="w-full rounded-lg border border-slate-400/25 bg-white py-1.5 pl-9 pr-3 text-sm text-ink placeholder:text-slate-400 focus:border-teal-700 dark:bg-teal-900/60 dark:text-paper"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.status}
          onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as TaskStatus | 'all' })}
          className={selectClass}
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          value={filters.priority}
          onChange={(e) => onFiltersChange({ ...filters, priority: e.target.value as TaskPriority | 'all' })}
          className={selectClass}
        >
          <option value="all">All priorities</option>
          {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>

        <select
          value={filters.category}
          onChange={(e) => onFiltersChange({ ...filters, category: e.target.value })}
          className={selectClass}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className={selectClass}
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
