export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function nowISO(): string {
  return new Date().toISOString()
}

function daysBetween(dateISO: string): number {
  const today = new Date(todayISO() + 'T00:00:00')
  const due = new Date(dateISO + 'T00:00:00')
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later' | 'none'

export function getDueState(dateISO: string | null): DueState {
  if (!dateISO) return 'none'
  const diff = daysBetween(dateISO)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 3) return 'soon'
  return 'later'
}

export function formatDueLabel(dateISO: string | null): string {
  if (!dateISO) return 'No due date'
  const diff = daysBetween(dateISO)
  if (diff < 0) return `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'}`
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  if (diff <= 7) return `Due in ${diff} days`
  const d = new Date(dateISO + 'T00:00:00')
  return `Due ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

export function formatDate(dateISO: string): string {
  const d = new Date(dateISO + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
