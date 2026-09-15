export type View = 'dashboard' | 'tasks' | 'settings'

const NAV: { id: View; label: string; icon: JSX.Element }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09a1.7 1.7 0 001.55-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34H9a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87V9a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.55 1z" />
      </>
    ),
  },
]

export function Sidebar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-400/15 bg-white/60 px-4 py-6 dark:bg-teal-950/60 dark:border-teal-800 md:flex">
      <div className="mb-8 px-2">
        <img src="/thet-fund-logo.svg" alt="THET Fund" className="h-auto w-full max-w-[192px]" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Task manager</p>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              view === item.id
                ? 'bg-teal-900 text-white'
                : 'text-slate-500 hover:bg-paper dark:text-slate-300 dark:hover:bg-teal-800'
            }`}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {item.icon}
            </svg>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

export function MobileNav({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-400/15 bg-white/95 backdrop-blur dark:bg-teal-950/95 dark:border-teal-800 md:hidden">
      {NAV.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${
            view === item.id ? 'text-teal-800 dark:text-gold-400' : 'text-slate-400'
          }`}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {item.icon}
          </svg>
          {item.label}
        </button>
      ))}
    </nav>
  )
}
