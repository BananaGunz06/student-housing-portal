import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test } from 'vitest'
import BudgetInput from './BudgetInput'

function Harness() {
  const [v, setV] = useState(1000)
  return (
    <>
      <label htmlFor="b">Budget</label>
      <BudgetInput id="b" value={v} onChange={setV} />
      <output>{v}</output>
    </>
  )
}

async function typeAndBlur(text: string) {
  const user = userEvent.setup()
  render(<Harness />)
  const field = screen.getByLabelText('Budget')
  await user.clear(field)
  if (text) await user.type(field, text)
  await user.tab()
  return { field, value: () => screen.getByRole('status').textContent }
}

test('an emptied field reverts to the last budget', async () => {
  const { field, value } = await typeAndBlur('')
  expect(value()).toBe('1000')
  expect(field).toHaveValue('1000')
})

test('letters are ignored', async () => {
  const { field, value } = await typeAndBlur('abc')
  expect(value()).toBe('1000')
  expect(field).toHaveValue('1000')
})

test('too small a budget is raised to $300', async () => {
  const { value } = await typeAndBlur('50')
  expect(value()).toBe('300')
})

test('a huge budget is capped at $5,000', async () => {
  const { value } = await typeAndBlur('99999')
  expect(value()).toBe('5000')
})

test('mixed input keeps the digits', async () => {
  const { value } = await typeAndBlur('$1,250')
  expect(value()).toBe('1250')
})
