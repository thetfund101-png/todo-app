import { useEffect, useState } from 'react'

/**
 * Persists state to localStorage under `key`. Reads the existing value (if
 * any) on first render, and writes back to localStorage on every change.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored !== null ? (JSON.parse(stored) as T) : initialValue
    } catch (err) {
      console.error(`Could not read localStorage key "${key}":`, err)
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (err) {
      console.error(`Could not write localStorage key "${key}":`, err)
    }
  }, [key, value])

  return [value, setValue] as const
}
