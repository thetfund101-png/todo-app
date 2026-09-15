export type TaskStatus = 'todo' | 'in-progress' | 'completed' | 'on-hold'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  category: string
  dueDate: string | null // ISO date string, e.g. 2026-09-18
  createdAt: string
  updatedAt: string
  subtasks: Subtask[]
}

export const DEFAULT_CATEGORIES = [
  'General',
  'Administration',
  'Finance',
  'IT',
  'Website',
  'Meetings',
  'Reports',
  'Projects',
  'Communications',
  'HR',
  'Grants',
]

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  completed: 'Completed',
  'on-hold': 'On hold',
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}
