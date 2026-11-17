import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DemoBanner from './DemoBanner'

describe('DemoBanner', () => {
  it('is a landmark that is not a live region', () => {
    render(<DemoBanner />)
    expect(screen.getByRole('complementary', { name: 'Demo mode' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows both lines of copy', () => {
    render(<DemoBanner />)
    const banner = screen.getByRole('complementary', { name: 'Demo mode' })
    expect(banner).toHaveTextContent('Demo mode: sample data, nothing is saved. Refresh to start over.')
    expect(banner).toHaveTextContent('Demo sign-in: email demo@example.com · , password demo-pass1')
  })

  it('reads the sign-in line with the words email and password', () => {
    render(<DemoBanner />)
    const line = screen.getByText(/Demo sign-in:/)
    const spoken = [...line.childNodes]
      .filter((n) => !(n instanceof HTMLElement && n.getAttribute('aria-hidden') === 'true'))
      .map((n) => n.textContent)
      .join('')
    expect(spoken).toBe('Demo sign-in: email demo@example.com, password demo-pass1')
  })
})
