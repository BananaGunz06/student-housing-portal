import { useCallback, useState } from 'react'

/** localStorage that never throws (private mode, blocked cookies, quota). */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // Not remembered, but the app keeps working.
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Nothing to forget.
    }
  },
}

function read<T>(key: string, initial: T): T {
  const raw = safeStorage.get(key)
  if (raw === null) return initial
  try {
    return JSON.parse(raw) as T
  } catch {
    return initial
  }
}

/** useState that is remembered in localStorage when it can be. */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, initial))
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
        safeStorage.set(key, JSON.stringify(next))
        return next
      })
    },
    [key],
  )
  return [value, set]
}
