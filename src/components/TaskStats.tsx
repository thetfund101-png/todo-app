export function TaskStats({
  stats,
}: {
  stats: { total: number; todo: number; inProgress: number; completed: number; onHold: number; overdue: number; dueToday: number }
}) {
  const cards = [
    { label: 'Total tasks', value: stats.total, accent: 'text-ink dark:text-paper' },
    { label: 'To do', value: stats.todo, accent: 'text-slate-500 dark:text-slate-300' },
    { label: 'In progress', value: stats.inProgress, accent: 'text-teal-800 dark:text-teal-300' },
    { label: 'Completed', value: stats.completed, accent: 'text-emerald-600 dark:text-emerald-300' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-slate-400/15 bg-white px-4 py-4 shadow-card dark:bg-teal-900/60 dark:border-teal-800"
        >
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{c.label}</p>
          <p className={`mt-1 font-display text-3xl ${c.accent}`}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}
