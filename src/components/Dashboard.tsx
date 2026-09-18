import { Task } from '../types/task'
import { TaskStats } from './TaskStats'
import { TaskCard } from './TaskCard'
import { computeStats, getOpenFollowUps } from '../utils/taskUtils'
import { getDueState } from '../utils/dateUtils'

export function Dashboard({
  tasks,
  onToggleComplete,
  onEdit,
  onDelete,
  onDuplicate,
  onAddFollowUp,
}: {
  tasks: Task[]
  onToggleComplete: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onDuplicate: (task: Task) => void
  onAddFollowUp: (task: Task) => void
}) {
  const stats = computeStats(tasks)

  const dueSoon = tasks
    .filter((t) => t.status !== 'completed' && (getDueState(t.dueDate) === 'today' || getDueState(t.dueDate) === 'overdue'))
    .slice(0, 5)

  const recent = [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  const openFollowUps = tasks
    .flatMap((task) => getOpenFollowUps(task).map((followUp) => ({ task, followUp })))
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Good to see you. Here's where things stand.</p>
        <TaskStats stats={stats} />
      </div>

      {dueSoon.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg text-ink dark:text-paper">Needs attention</h2>
          <div className="flex flex-col gap-2">
            {dueSoon.map((t) => (
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
        </section>
      )}

      {openFollowUps.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg text-ink dark:text-paper">Open follow-ups</h2>
          <div className="flex flex-col gap-2">
            {openFollowUps.map(({ task, followUp }) => (
              <button
                key={`${task.id}-${followUp.id}`}
                onClick={() => onEdit(task)}
                className="flex items-start justify-between gap-4 rounded-xl border border-gold-400/25 bg-gold-400/10 px-4 py-3 text-left hover:border-gold-400/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink dark:text-paper">{task.title}</span>
                  {followUp.note && <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">{followUp.note}</span>}
                </span>
                <span className="shrink-0 text-xs font-medium text-gold-500">{followUp.date}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg text-ink dark:text-paper">Recently updated</h2>
        {recent.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((t) => (
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
      </section>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-400/30 px-6 py-10 text-center">
      <p className="font-display text-lg text-ink dark:text-paper">No tasks yet</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Create your first task to see it show up here.
      </p>
    </div>
  )
}
