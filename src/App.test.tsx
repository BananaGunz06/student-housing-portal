import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { renderApp, setBudget } from './test/renderApp'

test('first visit asks for a budget', () => {
  renderApp('/')
  expect(
    screen.getByRole('heading', { name: 'What can you spend per month, all-in?' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
})

test('a remembered budget goes straight to results', () => {
  setBudget(1000)
  renderApp('/')
  expect(screen.getByRole('heading', { name: /places in Guelph/i })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
})

test('unknown pages show a way back', () => {
  setBudget(1000)
  renderApp('/nowhere')
  expect(screen.getByRole('heading', { name: 'This page doesn’t exist' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to search' })).toHaveAttribute('href', '/results')
})
