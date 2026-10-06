import { DragEvent, useMemo, useState } from 'react'
import { Task } from '../types/task'
import { todayISO } from '../utils/dateUtils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function CalendarPage({
  tasks,
  onEdit,
  onCreate,
  onMoveTask,
}: {
  tasks: Task[]
  onEdit: (task: Task) => void
  onCreate: (date: string) => void
  onMoveTask: (taskId: string, date: string) => void
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const today = todayISO()

  const days = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
    const start = new Date(firstDay.getFullYear(), firstDay.getMonth(), -firstDay.getDay() + 1)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
  }, [month])

  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, Task[]>()
    tasks.forEach((task) => {
      if (!task.dueDate) return
      const dayTasks = grouped.get(task.dueDate) ?? []
      dayTasks.push(task)
      grouped.set(task.dueDate, dayTasks)
    })
    return grouped
  }, [tasks])

  function changeMonth(amount: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, date: string) {
    event.preventDefault()
    const taskId = event.dataTransfer.getData('text/task-id')
    if (taskId) onMoveTask(taskId, date)
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg border border-slate-400/25 p-2 text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-teal-800"
          >
            <span aria-hidden="true">←</span>
          </button>
          <h2 className="min-w-40 text-center font-display text-xl text-ink dark:text-paper">
            {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={() => changeMonth(1)}
            aria-label="Next month"
            className="rounded-lg border border-slate-400/25 p-2 text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-teal-800"
          >
            <span aria-hidden="true">→</span>
          </button>
          <button
            onClick={() => {
              const now = new Date()
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
            }}
            className="rounded-lg border border-slate-400/25 px-3 py-2 text-sm font-medium text-ink hover:bg-white dark:text-paper dark:hover:bg-teal-800"
          >
            Today
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-500" />Overdue</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-gold-500" />Today</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-teal-700" />Upcoming</span>
          <span className="hidden sm:inline">Drag a task to reschedule</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-400/20 bg-white shadow-card dark:border-teal-800 dark:bg-teal-900/50">
        <div className="grid grid-cols-7 border-b border-slate-400/15 dark:border-teal-800">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="px-1 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 sm:px-3 sm:py-3">
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date) => {
            const key = dateKey(date)
            const dayTasks = tasksByDate.get(key) ?? []
            const isToday = key === today
            const isCurrentMonth = date.getMonth() === month.getMonth()
            return (
              <div
                key={key}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, key)}
                className={`min-h-24 min-w-0 border-b border-r border-slate-400/15 p-1 transition-colors hover:bg-paper/70 sm:min-h-32 sm:p-2 dark:border-teal-800 dark:hover:bg-teal-800/40 ${
                  !isCurrentMonth ? 'bg-slate-50/70 dark:bg-teal-950/40' : ''
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-1">
                  <button
                    onClick={() => onCreate(key)}
                    aria-label={`Create a task for ${date.toLocaleDateString()}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                      isToday
                        ? 'bg-gold-500 text-white'
                        : isCurrentMonth
                        ? 'text-ink hover:bg-slate-400/15 dark:text-paper'
                        : 'text-slate-400 hover:bg-slate-400/15'
                    }`}
                  >
                    {date.getDate()}
                  </button>
                  <button
                    onClick={() => onCreate(key)}
                    aria-label={`Add task on ${date.toLocaleDateString()}`}
                    className="rounded px-1 text-slate-400 hover:text-teal-700"
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {dayTasks.slice(0, 3).map((task) => {
                    const overdue = task.status !== 'completed' && key < today
                    const tone = task.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : overdue
                      ? 'bg-red-500/10 text-red-600 dark:text-red-300'
                      : isToday
                      ? 'bg-gold-500/15 text-gold-600 dark:text-gold-300'
                      : 'bg-teal-700/10 text-teal-800 dark:text-teal-300'
                    return (
                      <button
                        key={task.id}
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData('text/task-id', task.id)}
                        onClick={() => onEdit(task)}
                        title={`${task.title}${overdue ? ' · Overdue' : isToday ? ' · Due today' : ' · Upcoming'}`}
                        className={`w-full truncate rounded px-1.5 py-1 text-left text-[10px] font-medium sm:text-xs ${tone}`}
                      >
                        {task.title}
                      </button>
                    )
                  })}
                  {dayTasks.length > 3 && (
                    <span className="px-1 text-[10px] text-slate-500 dark:text-slate-400">+{dayTasks.length - 3} more</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
