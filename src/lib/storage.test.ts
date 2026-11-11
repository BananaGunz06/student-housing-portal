import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useLocalStorage } from './storage'

afterEach(() => vi.restoreAllMocks())

describe('useLocalStorage', () => {
  test('starts with the initial value and remembers updates', () => {
    const { result } = renderHook(() => useLocalStorage('k', 5))
    expect(result.current[0]).toBe(5)
    act(() => result.current[1](7))
    expect(result.current[0]).toBe(7)
    expect(localStorage.getItem('k')).toBe('7')
  })

  test('reads a stored value', () => {
    localStorage.setItem('k', JSON.stringify({ a: 1 }))
    const { result } = renderHook(() => useLocalStorage('k', { a: 0 }))
    expect(result.current[0]).toEqual({ a: 1 })
  })

  test('supports updater functions', () => {
    const { result } = renderHook(() => useLocalStorage<string[]>('k', []))
    act(() => result.current[1]((p) => [...p, 'x']))
    act(() => result.current[1]((p) => [...p, 'y']))
    expect(result.current[0]).toEqual(['x', 'y'])
  })

  test('corrupt JSON falls back to the initial value', () => {
    localStorage.setItem('k', '{not json')
    const { result } = renderHook(() => useLocalStorage('k', 3))
    expect(result.current[0]).toBe(3)
  })

  test('still works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useLocalStorage('k', 1))
    expect(result.current[0]).toBe(1)
    act(() => result.current[1](2))
    expect(result.current[0]).toBe(2)
  })

  describe('changes from another tab', () => {
    const fromOtherTab = (key: string | null, newValue: string | null) =>
      act(() => void window.dispatchEvent(new StorageEvent('storage', { key, newValue })))

    test('follows the new value for its key', () => {
      const { result } = renderHook(() => useLocalStorage<string[]>('k', []))
      localStorage.setItem('k', JSON.stringify(['a']))
      fromOtherTab('k', JSON.stringify(['a']))
      expect(result.current[0]).toEqual(['a'])
    })

    test('ignores other keys', () => {
      const { result } = renderHook(() => useLocalStorage('k', 1))
      localStorage.setItem('other', '9')
      fromOtherTab('other', '9')
      expect(result.current[0]).toBe(1)
    })

    test('goes back to the initial value when the key is removed or storage is cleared', () => {
      localStorage.setItem('k', '5')
      const { result } = renderHook(() => useLocalStorage('k', 1))
      expect(result.current[0]).toBe(5)
      localStorage.removeItem('k')
      fromOtherTab('k', null)
      expect(result.current[0]).toBe(1)
      act(() => result.current[1](8))
      localStorage.clear()
      fromOtherTab(null, null)
      expect(result.current[0]).toBe(1)
    })

    test('a corrupt value from another tab falls back to the initial value', () => {
      const { result } = renderHook(() => useLocalStorage('k', 3))
      localStorage.setItem('k', '{nope')
      fromOtherTab('k', '{nope')
      expect(result.current[0]).toBe(3)
    })

    test('does not write the received value back', () => {
      const { result } = renderHook(() => useLocalStorage('k', 0))
      localStorage.setItem('k', '4')
      const set = vi.spyOn(Storage.prototype, 'setItem')
      fromOtherTab('k', '4')
      expect(result.current[0]).toBe(4)
      expect(set).not.toHaveBeenCalled()
    })
  })
})
