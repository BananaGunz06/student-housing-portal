import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App.tsx'

test('shows the app name', () => {
  render(<App />)
  expect(
    screen.getByRole('heading', { name: 'Student Housing Portal' }),
  ).toBeInTheDocument()
})
