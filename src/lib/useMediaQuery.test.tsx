import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

function Probe() {
  return <p>{useMediaQuery('(min-width: 1024px)') ? 'wide' : 'narrow'}</p>
}

afterEach(() => {
  // @ts-expect-error removing the stub
  delete window.matchMedia
})

describe('useMediaQuery', () => {
  test('is false when the browser has no matchMedia', () => {
    render(<Probe />)
    expect(screen.getByText('narrow')).toBeInTheDocument()
  })

  test('follows the query as it changes', () => {
    let matches = true
    const listeners = new Set<() => void>()
    window.matchMedia = ((q: string) => ({
      get matches() {
        return matches
      },
      media: q,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    })) as unknown as typeof window.matchMedia
    render(<Probe />)
    expect(screen.getByText('wide')).toBeInTheDocument()
    matches = false
    act(() => listeners.forEach((fn) => fn()))
    expect(screen.getByText('narrow')).toBeInTheDocument()
  })
})
