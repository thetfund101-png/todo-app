import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, ApiError, setSessionExpiredHandler } from '../api/client'

export type UserRole = 'admin' | 'manager' | 'staff'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  error: string
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null)
      setLoading(false)
    })
    let active = true
    api
      .get<{ csrfToken: string }>('/auth/csrf')
      .then(() => api.get<{ user: User }>('/auth/me'))
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser)
      })
      .catch((reason: unknown) => {
        if (!active) return
        if (!(reason instanceof ApiError && reason.status === 401)) {
          setError(reason instanceof Error ? reason.message : 'Could not connect to the task service.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      setSessionExpiredHandler(null)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setError('')
    const result = await api.post<{ user: User; csrfToken: string }>('/auth/login', { email, password })
    api.setCsrfToken(result.csrfToken)
    setUser(result.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      api.resetCsrfToken()
      setUser(null)
    }
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post('/auth/change-password', { currentPassword, newPassword })
    api.resetCsrfToken()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, error, login, logout, changePassword }),
    [user, loading, error, login, logout, changePassword],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider.')
  return context
}
