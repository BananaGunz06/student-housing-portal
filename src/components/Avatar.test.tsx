import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Avatar from './Avatar'

test('shows the initial with no url', () => {
  render(<Avatar name="  maya" url={null} size="md" />)
  expect(screen.getByText('M')).toBeInTheDocument()
  expect(document.querySelector('img')).toBeNull()
})

test('shows ? for a blank name', () => {
  render(<Avatar name=" " url={null} size="sm" />)
  expect(screen.getByText('?')).toBeInTheDocument()
})

test('falls back to the initial when the image fails', () => {
  const { container } = render(<Avatar name="Maya" url="https://avatars.example.com/a.jpg" size="lg" />)
  const img = container.querySelector('img')!
  expect(img).toHaveAttribute('alt', '')
  fireEvent.error(img)
  expect(container.querySelector('img')).toBeNull()
  expect(screen.getByText('M')).toBeInTheDocument()
})

test('is hidden from assistive tech so the name is not read twice', () => {
  const { container } = render(<Avatar name="Maya" url={null} size="sm" />)
  expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
})

test('sizes the circle', () => {
  const { container } = render(<Avatar name="Maya" url={null} size="lg" muted />)
  expect(container.firstElementChild).toHaveStyle({ width: '112px', height: '112px' })
})
