import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DemoBanner from './DemoBanner'

describe('DemoBanner', () => {
  it('shows both lines of copy', () => {
    render(<DemoBanner />)
    expect(screen.getByText('Demo mode: sample data, nothing is saved. Refresh to start over.')).toBeInTheDocument()
    expect(screen.getByText('Demo sign-in: demo@example.com · demo-pass1')).toBeInTheDocument()
  })
})
