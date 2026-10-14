import { UserRole } from '../auth/AuthContext'

export type View =
  | 'dashboard'
  | 'team'
  | 'tasks'
  | 'calendar'
  | 'weekly-plans'
  | 'settings'
  | 'users'
  | 'categories'
  | 'audit'
  | 'change-password'

const NAV: { id: View; label: string; icon: JSX.Element; roles?: UserRole[] }[] = [
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
    id: 'team',
    label: 'Team',
    roles: ['manager'],
    icon: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-1a6 6 0 0112 0v1M16 5a3 3 0 010 6m2 3a5 5 0 013 5v1" />
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
    id: 'users',
    label: 'Users',
    roles: ['admin'],
    icon: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-1a6 6 0 0112 0v1M17 8h4m-2-2v4" />
      </>
    ),
  },
  {
    id: 'categories',
    label: 'Categories',
    roles: ['admin'],
    icon: (
      <>
        <path d="M4 5h16v4H4zM4 12h7v7H4zM14 12h6v7h-6z" />
      </>
    ),
  },
  {
    id: 'audit',
    label: 'Audit logs',
    roles: ['admin'],
    icon: (
      <>
        <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
      </>
    ),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
      </>
    ),
  },
  {
    id: 'weekly-plans',
    label: 'Weekly plans',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
        <path d="M8 17h8" />
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

export function Sidebar({ view, role, onNavigate }: { view: View; role: UserRole; onNavigate: (v: View) => void }) {
  const items = NAV.filter((item) => !item.roles || item.roles.includes(role))
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-400/15 bg-white/60 px-4 py-6 dark:bg-teal-950/60 dark:border-teal-800 md:flex">
      <div className="mb-8 px-2">
        <div className="mx-auto h-48 w-full max-w-[220px] overflow-hidden">
          <img
            src="/THET Fund Logo-01.jpg"
            alt="THET Fund"
            className="h-full w-full object-cover object-[center_72%]"
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Task manager</p>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              view === item.id
                ? 'bg-teal-900 text-white'
                : 'text-slate-500 hover:bg-paper dark:text-slate-300 dark:hover:bg-teal-800'
            }`}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {item.icon}
            </svg>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

export function MobileNav({ view, role, onNavigate }: { view: View; role: UserRole; onNavigate: (v: View) => void }) {
  const items = NAV.filter((item) => !item.roles || item.roles.includes(role))
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex overflow-x-auto border-t border-slate-400/15 bg-white/95 backdrop-blur dark:bg-teal-950/95 dark:border-teal-800 md:hidden">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`flex min-w-16 flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${
            view === item.id ? 'text-teal-800 dark:text-gold-400' : 'text-slate-400'
          }`}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {item.icon}
          </svg>
          {item.label}
        </button>
      ))}
    </nav>
  )
}
