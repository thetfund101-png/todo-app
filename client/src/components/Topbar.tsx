export type Theme = 'light' | 'dark' | 'system'

export function Topbar({
  title,
  theme,
  onThemeChange,
  onNewTask,
  userName,
  onChangePassword,
  onLogout,
}: {
  title: string
  theme: Theme
  onThemeChange: (t: Theme) => void
  onNewTask: () => void
  userName: string
  onChangePassword: () => void
  onLogout: () => void
}) {
  function cycleTheme() {
    const order: Theme[] = ['light', 'dark', 'system']
    onThemeChange(order[(order.indexOf(theme) + 1) % order.length])
  }

  const themeIcon =
    theme === 'light' ? (
      <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.4-6.4l-1.4 1.4M6.4 17.6l-1.4 1.4m0-13.4l1.4 1.4M17.6 17.6l1.4 1.4" />
    ) : theme === 'dark' ? (
      <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
    ) : (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>
    )

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-400/15 bg-paper/90 px-5 py-4 backdrop-blur dark:bg-teal-950/90 dark:border-teal-800 sm:px-8">
      <h1 className="font-display text-2xl text-ink dark:text-paper">{title}</h1>
      <div className="flex items-center gap-1 sm:gap-2">
        <span className="hidden max-w-40 truncate text-sm text-slate-500 dark:text-slate-300 lg:block">{userName}</span>
        <button
          onClick={onChangePassword}
          className="rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-teal-800 sm:px-3 sm:text-sm"
        >
          Password
        </button>
        <button
          onClick={onLogout}
          className="rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-teal-800 sm:px-3 sm:text-sm"
        >
          Sign out
        </button>
        <button
          onClick={cycleTheme}
          aria-label={`Theme: ${theme}. Click to change.`}
          title={`Theme: ${theme}`}
          className="rounded-full p-2 text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-teal-800"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {themeIcon}
          </svg>
        </button>
        <button
          onClick={onNewTask}
          className="hidden items-center gap-1.5 rounded-lg bg-teal-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800 sm:flex"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New task
        </button>
      </div>
    </header>
  )
}
