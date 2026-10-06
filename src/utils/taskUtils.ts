import { FollowUp, Subtask, Task, TaskPriority, TaskStatus } from '../types/task'
import { getDueState, nowISO, todayISO } from './dateUtils'

export function createEmptyTask(defaults: { priority?: TaskPriority; category?: string; dueDate?: string | null }): Task {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    status: 'todo',
    priority: defaults.priority ?? 'medium',
    category: defaults.category ?? 'General',
    dueDate: defaults.dueDate ?? null,
    followUps: [],
    createdAt: nowISO(),
    updatedAt: nowISO(),
    subtasks: [],
  }
}

export function normalizeTask(input: Partial<Task> | null | undefined): Task {
  const task = input ?? {}
  const createdAt = task.createdAt || nowISO()
  return {
    ...task,
    id: task.id || crypto.randomUUID(),
    title: typeof task.title === 'string' ? task.title : '',
    description: typeof task.description === 'string' ? task.description : '',
    status: task.status && ['todo', 'in-progress', 'completed', 'on-hold'].includes(task.status)
      ? task.status
      : 'todo',
    priority: task.priority && ['low', 'medium', 'high', 'urgent'].includes(task.priority)
      ? task.priority
      : 'medium',
    category: typeof task.category === 'string' ? task.category : 'General',
    dueDate: typeof task.dueDate === 'string' && task.dueDate ? task.dueDate : null,
    followUps: Array.isArray(task.followUps) ? task.followUps : [],
    createdAt,
    updatedAt: task.updatedAt || createdAt,
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.filter((subtask): subtask is Subtask =>
          Boolean(subtask && typeof subtask.id === 'string' && typeof subtask.title === 'string'),
        ).map((subtask) => ({ ...subtask, done: Boolean(subtask.done) }))
      : [],
  }
}

export function getOpenFollowUps(task: Task): FollowUp[] {
  return task.followUps.filter((followUp) => !followUp.completed)
}

export function addFollowUp(task: Task, followUp: FollowUp): Task {
  return { ...task, followUps: [...task.followUps, followUp] }
}

export function toggleFollowUp(task: Task, followUpId: string): Task {
  return {
    ...task,
    followUps: task.followUps.map((followUp) =>
      followUp.id === followUpId ? { ...followUp, completed: !followUp.completed } : followUp,
    ),
  }
}

export function deleteFollowUp(task: Task, followUpId: string): Task {
  return { ...task, followUps: task.followUps.filter((followUp) => followUp.id !== followUpId) }
}

export type SortKey = 'newest' | 'oldest' | 'due' | 'priority' | 'alpha'

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function sortTasks(tasks: Task[], sortKey: SortKey): Task[] {
  const copy = [...tasks]
  switch (sortKey) {
    case 'newest':
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'oldest':
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    case 'due':
      return copy.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      })
    case 'priority':
      return copy.sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
    case 'alpha':
      return copy.sort((a, b) => a.title.localeCompare(b.title))
    default:
      return copy
  }
}

export interface TaskFilters {
  status: TaskStatus | 'all'
  priority: TaskPriority | 'all'
  category: string | 'all'
  query: string
}

export type TaskQuickFilter = 'all' | 'active' | 'completed' | 'overdue' | 'today' | 'upcoming'

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  const q = filters.query.trim().toLowerCase()
  return tasks.filter((t) => {
    if (filters.status !== 'all' && t.status !== filters.status) return false
    if (filters.priority !== 'all' && t.priority !== filters.priority) return false
    if (filters.category !== 'all' && t.category !== filters.category) return false
    if (q) {
      const haystack = [
        t.title,
        t.description,
        t.status,
        t.priority,
        t.category,
        t.dueDate ?? '',
        ...t.subtasks.map((subtask) => subtask.title),
        ...t.followUps.map((followUp) => `${followUp.date} ${followUp.note}`),
      ].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

export function applyQuickFilter(tasks: Task[], quickFilter: TaskQuickFilter): Task[] {
  const today = todayISO()
  return tasks.filter((task) => {
    switch (quickFilter) {
      case 'active':
        return task.status !== 'completed'
      case 'completed':
        return task.status === 'completed'
      case 'overdue':
        return task.status !== 'completed' && Boolean(task.dueDate && task.dueDate < today)
      case 'today':
        return task.status !== 'completed' && task.dueDate === today
      case 'upcoming':
        return task.status !== 'completed' && Boolean(task.dueDate && task.dueDate > today)
      default:
        return true
    }
  })
}

export function computeStats(tasks: Task[]) {
  const total = tasks.length
  const todo = tasks.filter((t) => t.status === 'todo').length
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length
  const completed = tasks.filter((t) => t.status === 'completed').length
  const onHold = tasks.filter((t) => t.status === 'on-hold').length
  const overdue = tasks.filter((t) => t.status !== 'completed' && getDueState(t.dueDate) === 'overdue').length
  const dueToday = tasks.filter((t) => t.status !== 'completed' && getDueState(t.dueDate) === 'today').length
  const weekEnd = new Date(`${todayISO()}T00:00:00`)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const dueThisWeek = tasks.filter((task) => {
    if (task.status === 'completed' || !task.dueDate) return false
    const due = new Date(`${task.dueDate}T00:00:00`)
    return task.dueDate >= todayISO() && due <= weekEnd
  }).length
  const subtasksCompleted = tasks.reduce(
    (totalDone, task) => totalDone + task.subtasks.filter((subtask) => subtask.done).length,
    0,
  )
  return { total, todo, inProgress, completed, onHold, overdue, dueToday, dueThisWeek, subtasksCompleted }
}

export function subtaskProgress(task: Task) {
  if (task.subtasks.length === 0) return null
  const done = task.subtasks.filter((s) => s.done).length
  return { done, total: task.subtasks.length, pct: Math.round((done / task.subtasks.length) * 100) }
}
