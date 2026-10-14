import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from './api/client'
import { ChangePasswordPage } from './auth/ChangePasswordPage'
import { useAuth } from './auth/AuthContext'
import { LoginPage } from './auth/LoginPage'
import { Task, TaskPriority } from './types/task'
import { normalizeTask } from './utils/taskUtils'
import { Sidebar, MobileNav, View } from './components/Sidebar'
import { Topbar, Theme } from './components/Topbar'
import { Dashboard, DashboardSummary } from './components/Dashboard'
import { TasksPage } from './components/TasksPage'
import { SettingsPage } from './components/SettingsPage'
import { Modal } from './components/Modal'
import { TaskForm } from './components/TaskForm'
import { ToastStack, ToastItem } from './components/Toast'
import { CalendarPage } from './components/CalendarPage'
import { UsersPage } from './components/UsersPage'
import { CategoriesPage } from './components/CategoriesPage'
import { AuditLogsPage } from './components/AuditLogsPage'
import { WeeklyPlansPage } from './components/WeeklyPlansPage'

interface Category {
  id: string
  name: string
  isBuiltin: boolean
}

interface ApiUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'staff'
  isActive: boolean
}

interface UserSettings {
  theme: Theme
  defaultPriority: TaskPriority
  defaultCategoryId: string | null
  defaultCategory: string | null
}

interface LegacyPreferences {
  categories: string[]
  theme: Theme | null
  defaultPriority: TaskPriority | null
  defaultCategory: string | null
}

const PAGE_TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  team: 'Team dashboard',
  tasks: 'My tasks',
  calendar: 'Calendar',
  'weekly-plans': 'Weekly plans',
  settings: 'Settings',
  users: 'User management',
  categories: 'Categories',
  audit: 'Audit logs',
  'change-password': 'Change password',
}

function readLegacyTasks(): Task[] {
  try {
    const stored = window.localStorage.getItem('thet-fund-tasks')
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.map((task) => normalizeTask(task)) : []
  } catch (error) {
    console.error('Could not inspect previous browser task data:', error)
    return []
  }
}

function readLegacyPreferences(): LegacyPreferences {
  const read = (key: string): unknown => {
    try {
      const value = window.localStorage.getItem(key)
      return value === null ? null : JSON.parse(value)
    } catch {
      return null
    }
  }
  const categories = read('thet-fund-categories')
  const theme = read('thet-fund-theme')
  const defaultPriority = read('thet-fund-default-priority')
  const defaultCategory = read('thet-fund-default-category')
  return {
    categories: Array.isArray(categories) ? categories.filter((item): item is string => typeof item === 'string') : [],
    theme: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : null,
    defaultPriority:
      defaultPriority === 'low' ||
      defaultPriority === 'medium' ||
      defaultPriority === 'high' ||
      defaultPriority === 'urgent'
        ? defaultPriority
        : null,
    defaultCategory: typeof defaultCategory === 'string' ? defaultCategory : null,
  }
}

async function loadEveryTask(): Promise<Task[]> {
  const tasks: Task[] = []
  let page = 1
  let total = 0
  do {
    const result = await api.get<{ tasks: Task[]; total: number }>(`/tasks?page=${page}&pageSize=100`)
    tasks.push(...result.tasks)
    total = result.total
    page += 1
  } while (tasks.length < total)
  return tasks
}

export default function App() {
  const { user, loading: authLoading, error: authError, logout, changePassword } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [teamUsers, setTeamUsers] = useState<ApiUser[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [theme, setTheme] = useState<Theme>('system')
  const [defaultPriority, setDefaultPriority] = useState<TaskPriority>('medium')
  const [defaultCategoryId, setDefaultCategoryId] = useState('')
  const [view, setView] = useState<View>('dashboard')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [legacyTasks, setLegacyTasks] = useState<Task[]>([])
  const [legacyPreferences, setLegacyPreferences] = useState<LegacyPreferences | null>(null)
  const [legacyPromptOpen, setLegacyPromptOpen] = useState(false)
  const [legacyImported, setLegacyImported] = useState(false)
  const [legacyBusy, setLegacyBusy] = useState(false)
  const [legacyError, setLegacyError] = useState('')

  const isAdmin = user?.role === 'admin'
  const canAssign = user?.role === 'admin' || user?.role === 'manager'
  const userId = user?.id
  const categoryNames = useMemo(() => categories.map((category) => category.name), [categories])
  const defaultCategory = categories.find((category) => category.id === defaultCategoryId)?.name ?? 'General'
  const assignableUsers = useMemo(() => teamUsers.filter((item) => item.isActive), [teamUsers])

  const pushToast = useCallback((message: string, tone: ToastItem['tone'] = 'success') => {
    setToasts((current) => [...current, { id: crypto.randomUUID(), message, tone }])
  }, [])

  const refreshSummary = useCallback(async () => {
    const result = await api.get<DashboardSummary>('/dashboard/summary')
    setSummary(result)
  }, [])

  const refreshCategories = useCallback(async () => {
    const result = await api.get<{ categories: Category[] }>('/categories')
    setCategories(result.categories)
  }, [])

  useEffect(() => {
    if (!userId) {
      setTasks([])
      setCategories([])
      setTeamUsers([])
      setSummary(null)
      return
    }

    let active = true
    setDataLoading(true)
    setDataError('')
    setView('dashboard')
    const load = async () => {
      try {
        const requests = [
          loadEveryTask(),
          api.get<{ categories: Category[] }>('/categories'),
          api.get<{ settings: UserSettings }>('/settings'),
          api.get<DashboardSummary>('/dashboard/summary'),
          canAssign
            ? api.get<{ users: ApiUser[] }>('/users?page=1&pageSize=100')
            : Promise.resolve({ users: [] as ApiUser[] }),
        ] as const
        const [nextTasks, categoryData, settingsData, nextSummary, userData] = await Promise.all(requests)
        if (!active) return
        setTasks(nextTasks)
        setCategories(categoryData.categories)
        setTheme(settingsData.settings.theme)
        setDefaultPriority(settingsData.settings.defaultPriority)
        setDefaultCategoryId(settingsData.settings.defaultCategoryId ?? '')
        setSummary(nextSummary)
        setTeamUsers(userData.users)

        const marker = `thet-fund-imported:${userId}`
        let alreadyImported = false
        try {
          alreadyImported = window.localStorage.getItem(marker) === 'true'
        } catch (reason) {
          setDataError(reason instanceof Error ? reason.message : 'Legacy browser data could not be checked.')
        }
        if (!alreadyImported) {
          const oldTasks = readLegacyTasks()
          if (oldTasks.length > 0) {
            setLegacyTasks(oldTasks)
            setLegacyPreferences(readLegacyPreferences())
            setLegacyImported(false)
          } else {
            setLegacyTasks([])
          }
        } else {
          setLegacyTasks([])
        }
      } catch (reason) {
        if (active) setDataError(reason instanceof Error ? reason.message : 'The task data could not be loaded.')
      } finally {
        if (active) setDataLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [userId, canAssign])

  useEffect(() => {
    const root = document.documentElement
    const apply = (dark: boolean) => root.classList.toggle('dark', dark)
    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      apply(media.matches)
      const listener = (event: MediaQueryListEvent) => apply(event.matches)
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    }
    apply(theme === 'dark')
  }, [theme])

  async function updateSettings(next: Partial<UserSettings>) {
    const updated = {
      theme,
      defaultPriority,
      defaultCategoryId,
      ...next,
    }
    if (!updated.defaultCategoryId) throw new Error('Select a default category first.')
    await api.put('/settings', {
      theme: updated.theme,
      defaultPriority: updated.defaultPriority,
      defaultCategoryId: updated.defaultCategoryId,
    })
    setTheme(updated.theme)
    setDefaultPriority(updated.defaultPriority)
    setDefaultCategoryId(updated.defaultCategoryId)
  }

  async function handleSaveTask(task: Task) {
    const payload = {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      category: task.category,
      dueDate: task.dueDate,
      assignedTo: task.assignedTo ?? null,
      subtasks: task.subtasks,
      followUps: task.followUps,
    }
    try {
      const exists = tasks.some((item) => item.id === task.id)
      const result = exists
        ? await api.put<{ task: Task }>(`/tasks/${task.id}`, payload)
        : await api.post<{ task: Task }>('/tasks', payload)
      setTasks((current) =>
        exists ? current.map((item) => (item.id === result.task.id ? result.task : item)) : [result.task, ...current],
      )
      setEditingTask(null)
      setIsCreating(false)
      pushToast(exists ? 'Task updated' : 'Task created')
      void refreshCategories().catch((reason: unknown) =>
        pushToast(reason instanceof Error ? reason.message : 'Categories could not be refreshed.', 'error'),
      )
      void refreshSummary().catch((reason: unknown) =>
        pushToast(reason instanceof Error ? reason.message : 'Dashboard could not be refreshed.', 'error'),
      )
    } catch (reason) {
      pushToast(reason instanceof ApiError ? reason.message : 'Task could not be saved.', 'error')
    }
  }

  async function handleToggleComplete(id: string) {
    const current = tasks.find((task) => task.id === id)
    if (!current) return
    const completed = current.status !== 'completed'
    setTasks((items) =>
      items.map((task) => (task.id === id ? { ...task, status: completed ? 'completed' : 'todo' } : task)),
    )
    try {
      const result = await api.patch<{ task: Task }>(`/tasks/${id}/complete`, { completed })
      setTasks((items) => items.map((task) => (task.id === id ? result.task : task)))
      void refreshSummary().catch((reason: unknown) =>
        pushToast(reason instanceof Error ? reason.message : 'Dashboard could not be refreshed.', 'error'),
      )
    } catch (reason) {
      setTasks((items) => items.map((task) => (task.id === id ? current : task)))
      pushToast(reason instanceof Error ? reason.message : 'Task status could not be updated.', 'error')
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/tasks/${id}`)
      setTasks((items) => items.filter((task) => task.id !== id))
      pushToast('Task deleted', 'info')
      void refreshSummary().catch((reason: unknown) =>
        pushToast(reason instanceof Error ? reason.message : 'Dashboard could not be refreshed.', 'error'),
      )
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Task could not be deleted.', 'error')
    }
  }

  async function handleDuplicate(task: Task) {
    try {
      const result = await api.post<{ task: Task }>(`/tasks/${task.id}/duplicate`)
      setTasks((items) => [result.task, ...items])
      pushToast('Task duplicated')
      void refreshSummary().catch((reason: unknown) =>
        pushToast(reason instanceof Error ? reason.message : 'Dashboard could not be refreshed.', 'error'),
      )
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Task could not be duplicated.', 'error')
    }
  }

  async function handleMoveTask(id: string, dueDate: string) {
    const current = tasks.find((task) => task.id === id)
    if (!current) return
    setTasks((items) => items.map((task) => (task.id === id ? { ...task, dueDate } : task)))
    try {
      const result = await api.patch<{ task: Task }>(`/tasks/${id}/reschedule`, { dueDate })
      setTasks((items) => items.map((task) => (task.id === id ? result.task : task)))
      pushToast('Task date updated')
      void refreshSummary().catch((reason: unknown) =>
        pushToast(reason instanceof Error ? reason.message : 'Dashboard could not be refreshed.', 'error'),
      )
    } catch (reason) {
      setTasks((items) => items.map((task) => (task.id === id ? current : task)))
      pushToast(reason instanceof Error ? reason.message : 'Task date could not be updated.', 'error')
    }
  }

  async function handleImportFile(file: File) {
    const form = new FormData()
    form.append('file', file)
    const result = await api.post<{ imported: number; tasks: Task[] }>('/exports/tasks/import', form)
    setTasks((current) => [...result.tasks, ...current])
    await refreshCategories()
    await refreshSummary()
    pushToast(`Imported ${result.imported} task${result.imported === 1 ? '' : 's'}`)
  }

  async function exportTasks(format: 'json' | 'csv' | 'docx') {
    const blob = await api.download(`/exports/tasks?format=${format}`)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `thet-fund-tasks-${new Date().toISOString().slice(0, 10)}.${format === 'docx' ? 'docx' : format}`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function handleBulkReset(currentPassword: string) {
    const result = await api.post<{ deleted: number }>('/tasks/bulk-reset', { currentPassword })
    setTasks([])
    await refreshSummary()
    pushToast(`${result.deleted} task${result.deleted === 1 ? '' : 's'} reset`, 'info')
  }

  async function importLegacyData() {
    setLegacyBusy(true)
    setLegacyError('')
    let tasksCommitted = false
    try {
      const form = new FormData()
      const normalizedLegacyTasks = legacyTasks.map((task) => ({
        ...task,
        id: undefined,
        subtasks: task.subtasks.map(({ id: _id, ...subtask }) => subtask),
        followUps: task.followUps.map(({ id: _id, ...followUp }) => followUp),
      }))
      form.append(
        'file',
        new Blob([JSON.stringify(normalizedLegacyTasks)], { type: 'application/json' }),
        'legacy-tasks.json',
      )
      const imported = await api.post<{ imported: number; tasks: Task[] }>('/exports/tasks/import', form)
      tasksCommitted = true
      setTasks((current) => [...imported.tasks, ...current])
      setLegacyImported(true)
      setLegacyPromptOpen(false)
      pushToast(`Imported ${imported.imported} legacy task${imported.imported === 1 ? '' : 's'}`)
      try {
        window.localStorage.setItem(`thet-fund-imported:${user!.id}`, 'true')
      } catch {
        pushToast(
          'Tasks imported, but this browser could not save the import marker. Keep the old copy and avoid importing it again.',
          'error',
        )
      }

      const currentNames = new Set(categories.map((category) => category.name.toLowerCase()))
      const oldCategoryNames = new Set([
        ...(legacyPreferences?.categories ?? []),
        ...legacyTasks.map((task) => task.category),
      ])
      for (const name of oldCategoryNames) {
        if (!name.trim() || currentNames.has(name.toLowerCase())) continue
        try {
          await api.post('/categories', { name })
          currentNames.add(name.toLowerCase())
        } catch (reason) {
          if (!(reason instanceof ApiError && reason.status === 409)) throw reason
        }
      }
      const categoryResult = await api.get<{ categories: Category[] }>('/categories')
      const prefs = legacyPreferences
      const selectedCategory =
        categoryResult.categories.find((category) => category.name === prefs?.defaultCategory) ??
        categoryResult.categories.find((category) => category.name === 'General')
      const settingsResult = await api.get<{ settings: UserSettings }>('/settings')
      await api.put('/settings', {
        theme: prefs?.theme ?? settingsResult.settings.theme,
        defaultPriority: prefs?.defaultPriority ?? settingsResult.settings.defaultPriority,
        defaultCategoryId: selectedCategory?.id ?? settingsResult.settings.defaultCategoryId,
      })

      setCategories(categoryResult.categories)
      setDefaultCategoryId(selectedCategory?.id ?? '')
      setTheme(prefs?.theme ?? settingsResult.settings.theme)
      setDefaultPriority(prefs?.defaultPriority ?? settingsResult.settings.defaultPriority)
      await refreshSummary()
    } catch (reason) {
      if (tasksCommitted) {
        pushToast(
          reason instanceof Error
            ? `Tasks imported, but legacy preferences could not be migrated: ${reason.message}`
            : 'Tasks imported, but legacy preferences could not be migrated.',
          'error',
        )
      } else {
        setLegacyError(reason instanceof Error ? reason.message : 'Previous browser data could not be imported.')
      }
    } finally {
      setLegacyBusy(false)
    }
  }

  function clearLegacyData() {
    try {
      for (const key of [
        'thet-fund-tasks',
        'thet-fund-categories',
        'thet-fund-theme',
        'thet-fund-default-priority',
        'thet-fund-default-category',
      ])
        window.localStorage.removeItem(key)
      setLegacyTasks([])
      setLegacyPreferences(null)
      setLegacyImported(false)
      setLegacyPromptOpen(false)
      pushToast('Previous browser data cleared', 'info')
    } catch (reason) {
      setLegacyError(reason instanceof Error ? reason.message : 'Previous browser data could not be cleared.')
    }
  }

  function openCreateModal(dueDate?: string) {
    setEditingTask({
      id: crypto.randomUUID(),
      title: '',
      description: '',
      status: 'todo',
      priority: defaultPriority,
      category: defaultCategory,
      dueDate: dueDate ?? null,
      followUps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subtasks: [],
      assignedTo: null,
    })
    setIsCreating(true)
  }

  function openEditModal(task: Task) {
    setEditingTask(task)
    setIsCreating(false)
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Checking your session…</div>
    )
  }
  if (!user) return <LoginPage />

  if (dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading your THET Fund workspace…
      </div>
    )
  }

  const mayViewAdmin = user.role === 'admin'
  const mayViewTeam = user.role === 'manager'
  const effectiveView =
    view === 'users' || view === 'categories' || view === 'audit'
      ? mayViewAdmin
        ? view
        : 'dashboard'
      : view === 'team' && !mayViewTeam
        ? 'dashboard'
        : view

  return (
    <div className="flex min-h-screen">
      <Sidebar view={effectiveView} role={user.role} onNavigate={setView} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar
          title={PAGE_TITLES[effectiveView]}
          theme={theme}
          onThemeChange={(next) =>
            void updateSettings({ theme: next }).catch((reason: unknown) =>
              pushToast(reason instanceof Error ? reason.message : 'Theme could not be saved.', 'error'),
            )
          }
          onNewTask={() => openCreateModal()}
          userName={user.name}
          onChangePassword={() => setView('change-password')}
          onLogout={() =>
            void logout().catch((reason: unknown) =>
              pushToast(reason instanceof Error ? reason.message : 'Sign out failed.', 'error'),
            )
          }
        />
        <main className="flex-1 px-5 py-6 pb-24 sm:px-8 md:pb-6">
          {dataError && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600"
            >
              <span>{dataError}</span>
              <button onClick={() => window.location.reload()} className="font-semibold underline">
                Retry
              </button>
            </div>
          )}
          {legacyTasks.length > 0 && !legacyImported && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-400/35 bg-gold-400/10 px-4 py-3">
              <p className="text-sm text-ink dark:text-paper">
                {legacyTasks.length} task{legacyTasks.length === 1 ? '' : 's'} from the previous browser-only version
                can be imported to this account.
              </p>
              <button
                onClick={() => {
                  setLegacyError('')
                  setLegacyPromptOpen(true)
                }}
                className="rounded-lg bg-teal-900 px-3 py-2 text-sm font-medium text-white"
              >
                Preview import
              </button>
            </div>
          )}
          {legacyImported && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <p className="text-sm text-ink dark:text-paper">
                Legacy data was imported. The old browser copy is still available on this device.
              </p>
              <button
                onClick={clearLegacyData}
                className="rounded-lg border border-slate-400/25 px-3 py-2 text-sm font-medium text-ink dark:text-paper"
              >
                Clear old browser copy
              </button>
            </div>
          )}

          {(effectiveView === 'dashboard' || effectiveView === 'team') && (
            <Dashboard
              tasks={tasks}
              summary={summary}
              onToggleComplete={handleToggleComplete}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onAddFollowUp={openEditModal}
            />
          )}
          {effectiveView === 'tasks' && (
            <TasksPage
              tasks={tasks}
              categories={categoryNames}
              onToggleComplete={handleToggleComplete}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onAddFollowUp={openEditModal}
            />
          )}
          {effectiveView === 'calendar' && (
            <CalendarPage tasks={tasks} onEdit={openEditModal} onCreate={openCreateModal} onMoveTask={handleMoveTask} />
          )}
          {effectiveView === 'weekly-plans' && <WeeklyPlansPage />}
          {effectiveView === 'settings' && (
            <SettingsPage
              theme={theme}
              onThemeChange={(next) =>
                void updateSettings({ theme: next }).catch((reason: unknown) =>
                  pushToast(reason instanceof Error ? reason.message : 'Theme could not be saved.', 'error'),
                )
              }
              defaultPriority={defaultPriority}
              onDefaultPriorityChange={(next) =>
                void updateSettings({ defaultPriority: next }).catch((reason: unknown) =>
                  pushToast(reason instanceof Error ? reason.message : 'Priority could not be saved.', 'error'),
                )
              }
              defaultCategory={defaultCategoryId}
              onDefaultCategoryChange={(next) =>
                void updateSettings({ defaultCategoryId: next }).catch((reason: unknown) =>
                  pushToast(reason instanceof Error ? reason.message : 'Category could not be saved.', 'error'),
                )
              }
              categories={categories}
              isAdmin={isAdmin ?? false}
              onExport={exportTasks}
              onImport={handleImportFile}
              onBulkReset={handleBulkReset}
            />
          )}
          {effectiveView === 'users' && <UsersPage />}
          {effectiveView === 'categories' && <CategoriesPage />}
          {effectiveView === 'audit' && <AuditLogsPage />}
          {effectiveView === 'change-password' && (
            <ChangePasswordPage onSubmit={changePassword} onCancel={() => setView('dashboard')} />
          )}
          {authError && (
            <p role="status" className="mt-5 text-sm text-red-500">
              {authError}
            </p>
          )}
        </main>
      </div>
      <MobileNav view={effectiveView} role={user.role} onNavigate={setView} />
      <button
        onClick={() => openCreateModal()}
        aria-label="New task"
        className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500 text-white shadow-lg hover:bg-gold-400 md:hidden"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {editingTask && (
        <Modal title={isCreating ? 'Create new task' : 'Edit task'} onClose={() => setEditingTask(null)}>
          <TaskForm
            initial={editingTask}
            categories={categoryNames}
            assignableUsers={canAssign ? assignableUsers : []}
            onSave={handleSaveTask}
            onCancel={() => setEditingTask(null)}
          />
        </Modal>
      )}

      {legacyPromptOpen && (
        <Modal title="Import previous browser data?" onClose={() => setLegacyPromptOpen(false)}>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            These {legacyTasks.length} tasks will be appended to your account. Existing shared tasks will not be
            replaced.
          </p>
          {legacyError && (
            <p role="alert" className="mt-3 text-sm text-red-500">
              {legacyError}
            </p>
          )}
          <ul className="mt-4 max-h-48 overflow-y-auto rounded-lg bg-paper/70 p-3 text-sm text-ink dark:bg-teal-800/60 dark:text-paper">
            {legacyTasks.slice(0, 8).map((task, index) => (
              <li key={`${task.id}-${index}`} className="truncate py-1">
                {task.title || '(Untitled task)'}
              </li>
            ))}
            {legacyTasks.length > 8 && (
              <li className="pt-1 text-xs text-slate-500">And {legacyTasks.length - 8} more…</li>
            )}
          </ul>
          <div className="mt-5 flex justify-end gap-3">
            <button
              disabled={legacyBusy}
              onClick={() => setLegacyPromptOpen(false)}
              className="rounded-lg px-4 py-2 text-sm text-slate-500"
            >
              Not now
            </button>
            <button
              disabled={legacyBusy}
              onClick={() => void importLegacyData()}
              className="rounded-lg bg-teal-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {legacyBusy ? 'Importing…' : 'Append tasks'}
            </button>
          </div>
        </Modal>
      )}

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))} />
    </div>
  )
}
