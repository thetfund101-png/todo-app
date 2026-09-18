import { useEffect, useState } from 'react'
import { Task, TaskPriority, DEFAULT_CATEGORIES } from './types/task'
import { useLocalStorage } from './hooks/useLocalStorage'
import { createEmptyTask } from './utils/taskUtils'
import { nowISO } from './utils/dateUtils'
import { Sidebar, MobileNav, View } from './components/Sidebar'
import { Topbar, Theme } from './components/Topbar'
import { Dashboard } from './components/Dashboard'
import { TasksPage } from './components/TasksPage'
import { SettingsPage } from './components/SettingsPage'
import { Modal } from './components/Modal'
import { TaskForm } from './components/TaskForm'
import { ToastStack, ToastItem } from './components/Toast'

const PAGE_TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  tasks: 'My tasks',
  settings: 'Settings',
}

export default function App() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('thet-fund-tasks', [])
  const [customCategories, setCustomCategories] = useLocalStorage<string[]>('thet-fund-categories', [])
  const [theme, setTheme] = useLocalStorage<Theme>('thet-fund-theme', 'system')
  const [defaultPriority, setDefaultPriority] = useLocalStorage<TaskPriority>('thet-fund-default-priority', 'medium')
  const [defaultCategory, setDefaultCategory] = useLocalStorage<string>('thet-fund-default-category', 'General')

  const [view, setView] = useState<View>('dashboard')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...customCategories]))

  useEffect(() => {
    const needsNormalization = tasks.some((task) => !Array.isArray(task.followUps))
    if (needsNormalization) {
      setTasks((current) => current.map((task) => ({ ...task, followUps: task.followUps ?? [] })))
    }
  }, [tasks, setTasks])

  // apply theme to <html> element
  useEffect(() => {
    const root = document.documentElement
    const apply = (isDark: boolean) => root.classList.toggle('dark', isDark)
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const listener = (e: MediaQueryListEvent) => apply(e.matches)
      mq.addEventListener('change', listener)
      return () => mq.removeEventListener('change', listener)
    }
    apply(theme === 'dark')
  }, [theme])

  function pushToast(message: string, tone: ToastItem['tone'] = 'success') {
    const id = crypto.randomUUID()
    setToasts((t) => [...t, { id, message, tone }])
  }

  function dismissToast(id: string) {
    setToasts((t) => t.filter((x) => x.id !== id))
  }

  function registerCategory(name: string) {
    if (!DEFAULT_CATEGORIES.includes(name) && !customCategories.includes(name)) {
      setCustomCategories((c) => [...c, name])
    }
  }

  function handleSaveTask(task: Task) {
    registerCategory(task.category)
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === task.id)
      if (exists) return prev.map((t) => (t.id === task.id ? task : t))
      return [task, ...prev]
    })
    pushToast(isCreating ? 'Task created' : 'Task updated')
    setEditingTask(null)
    setIsCreating(false)
  }

  function handleToggleComplete(id: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: t.status === 'completed' ? 'todo' : 'completed', updatedAt: nowISO() }
          : t,
      ),
    )
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    pushToast('Task deleted', 'info')
  }

  function handleDuplicate(task: Task) {
    const copy: Task = {
      ...task,
      id: crypto.randomUUID(),
      title: `${task.title} (copy)`,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }
    setTasks((prev) => [copy, ...prev])
    pushToast('Task duplicated')
  }

  function handleImport(imported: Task[]) {
    const valid = imported.filter((t) => t && typeof t.title === 'string')
    setTasks(valid)
    valid.forEach((t) => registerCategory(t.category))
    pushToast(`Imported ${valid.length} task${valid.length === 1 ? '' : 's'}`)
  }

  function handleClearAll() {
    setTasks([])
    pushToast('All tasks deleted', 'info')
  }

  function openCreateModal() {
    setEditingTask(createEmptyTask({ priority: defaultPriority, category: defaultCategory }))
    setIsCreating(true)
  }

  function openEditModal(task: Task) {
    setEditingTask(task)
    setIsCreating(false)
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar view={view} onNavigate={setView} />

      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar title={PAGE_TITLES[view]} theme={theme} onThemeChange={setTheme} onNewTask={openCreateModal} />

        <main className="flex-1 px-5 py-6 pb-24 sm:px-8 md:pb-6">
          {view === 'dashboard' && (
            <Dashboard
              tasks={tasks}
              onToggleComplete={handleToggleComplete}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onAddFollowUp={openEditModal}
            />
          )}
          {view === 'tasks' && (
            <TasksPage
              tasks={tasks}
              categories={categories}
              onToggleComplete={handleToggleComplete}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onAddFollowUp={openEditModal}
            />
          )}
          {view === 'settings' && (
            <SettingsPage
              theme={theme}
              onThemeChange={setTheme}
              defaultPriority={defaultPriority}
              onDefaultPriorityChange={setDefaultPriority}
              defaultCategory={defaultCategory}
              onDefaultCategoryChange={setDefaultCategory}
              categories={categories}
              tasks={tasks}
              onImport={handleImport}
              onClearAll={handleClearAll}
            />
          )}
        </main>
      </div>

      <MobileNav view={view} onNavigate={setView} />

      <button
        onClick={openCreateModal}
        aria-label="New task"
        className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500 text-white shadow-lg hover:bg-gold-400 md:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {editingTask && (
        <Modal title={isCreating ? 'Create new task' : 'Edit task'} onClose={() => setEditingTask(null)}>
          <TaskForm
            initial={editingTask}
            categories={categories}
            onSave={handleSaveTask}
            onCancel={() => setEditingTask(null)}
          />
        </Modal>
      )}


      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
