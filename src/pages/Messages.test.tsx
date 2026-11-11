import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { getAll } from '../lib/listingsRepo'
import { greetingName } from '../lib/messages'
import { renderApp, setBudget } from '../test/renderApp'

vi.mock('../components/MiniMap', () => ({ default: () => <div>mini map</div> }))

const privatePoster = getAll().find((l) => !l.poster.phone && !l.poster.email && l.poster.role !== 'property-manager')!
const sharesBoth = getAll().find((l) => l.poster.phone && l.poster.email)!

describe('Posted by card', () => {
  test('a poster who keeps details private can still be messaged', () => {
    setBudget(1000)
    renderApp(`/listing/${privatePoster.id}`)
    const card = screen.getByRole('region', { name: 'Posted by' })
    expect(within(card).getByText(privatePoster.poster.name)).toBeInTheDocument()
    expect(within(card).getByText(privatePoster.poster.replyTime)).toBeInTheDocument()
    expect(
      within(card).getByText(`${privatePoster.poster.name} chose not to share a phone number or email. Send a message here instead.`),
    ).toBeInTheDocument()
    expect(within(card).queryByRole('link', { name: /Call|Text|Email/ })).toBeNull()
    expect(within(card).getByRole('button', { name: `Message ${greetingName(privatePoster.poster)}` })).toBeInTheDocument()
  })

  test('a poster who shared a phone and email gets call, text and email links', () => {
    setBudget(1000)
    renderApp(`/listing/${sharesBoth.id}`)
    const card = screen.getByRole('region', { name: 'Posted by' })
    const { phone, email } = sharesBoth.poster
    const tel = `+1${phone!.replace(/\D/g, '')}`
    expect(within(card).getByRole('link', { name: `Call ${phone}` })).toHaveAttribute('href', `tel:${tel}`)
    expect(within(card).getByRole('link', { name: `Text ${phone}` })).toHaveAttribute('href', `sms:${tel}`)
    expect(within(card).getByRole('link', { name: `Email ${email}` })).toHaveAttribute('href', `mailto:${email}`)
  })
})

describe('Messaging a poster', () => {
  test('send a message sharing only some details, then find it in Messages', async () => {
    setBudget(1000)
    const l = privatePoster
    const first = greetingName(l.poster)
    const { user } = renderApp(`/listing/${l.id}`)

    await user.click(screen.getByRole('button', { name: `Message ${first}` }))
    const dialog = screen.getByRole('dialog', { name: `Message ${first}` })
    const body = within(dialog).getByLabelText('Your message')
    expect(body).toHaveFocus()
    expect((body as HTMLTextAreaElement).value).toMatch(new RegExp(`^Hi ${first}, is the`))
    expect(within(dialog).getByText(`Only what you fill in is shared with ${first}.`, { exact: false })).toBeInTheDocument()

    // Empty message and a bad phone number are caught.
    await user.clear(body)
    await user.type(within(dialog).getByLabelText('Phone'), '555')
    await user.click(within(dialog).getByRole('button', { name: 'Send message' }))
    expect(within(dialog).getByText('Write a message to send.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter a 10-digit phone number, or leave it blank.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Your message')).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(body).toHaveFocus())

    await user.type(body, 'Is it still free in January?')
    await user.clear(within(dialog).getByLabelText('Phone'))
    await user.type(within(dialog).getByLabelText('Your name'), 'Alex')
    await user.type(within(dialog).getByLabelText('Anything else you want to share'), 'Second-year student, no pets')
    await user.click(within(dialog).getByRole('button', { name: 'Send message' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Saved to Messages')
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByText(new RegExp(`^You messaged ${first} on`))).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Messages' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Messages' })).toBeInTheDocument()
    expect(screen.getByText(/aren’t sent to anyone/)).toBeInTheDocument()
    const row = screen.getByRole('link', { name: new RegExp(l.title) })
    expect(row).toHaveTextContent('Is it still free in January?')
    expect(row).toHaveTextContent('Waiting for a reply')

    await user.click(row)
    expect(screen.getByRole('heading', { level: 1, name: l.poster.name })).toBeInTheDocument()
    const sent = screen.getByRole('article')
    expect(sent).toHaveTextContent('Is it still free in January?')
    expect(sent).toHaveTextContent('Alex')
    expect(sent).toHaveTextContent('Second-year student, no pets')
    expect(sent).not.toHaveTextContent('Phone')

    // Follow-up.
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByText('Write a message to send.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Write a follow-up'), 'I can view it any weekday.')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByLabelText('Write a follow-up')).toHaveValue('')

    // Saved on the device.
    const stored = JSON.parse(localStorage.getItem('shp.messages')!)
    expect(stored).toHaveLength(2)
    expect(stored[0].shared).toEqual({ name: 'Alex', other: 'Second-year student, no pets' })
  })

  test('the next message remembers the details shared last time', async () => {
    setBudget(1000)
    localStorage.setItem(
      'shp.messages',
      JSON.stringify([
        { id: 'm1', listingId: sharesBoth.id, sentAt: '2026-11-10T10:00:00Z', body: 'Hi', shared: { name: 'Alex', phone: '519-555-0199' } },
      ]),
    )
    const { user } = renderApp(`/listing/${privatePoster.id}`)
    await user.click(screen.getAllByRole('button', { name: /^Message/ })[0])
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Your name')).toHaveValue('Alex')
    expect(within(dialog).getByLabelText('Phone')).toHaveValue('519-555-0199')
    expect(within(dialog).getByLabelText('Email')).toHaveValue('')
  })

  test('Escape closes the message sheet and returns focus', async () => {
    setBudget(1000)
    const { user } = renderApp(`/listing/${privatePoster.id}`)
    const opener = screen.getByRole('button', { name: `Message ${greetingName(privatePoster.poster)}` })
    await user.click(opener)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
    expect(localStorage.getItem('shp.messages')).toBeNull()
  })
})

describe('Messages tab', () => {
  test('explains how to start when there are no messages', () => {
    renderApp('/messages')
    expect(screen.getByText('No messages yet.')).toBeInTheDocument()
  })

  test('drops stored messages for listings that no longer exist, and junk', () => {
    localStorage.setItem(
      'shp.messages',
      JSON.stringify([
        { id: 'm1', listingId: 'gone-999', sentAt: '2026-11-10T10:00:00Z', body: 'Hi', shared: {} },
        { nonsense: true },
        { id: 'm2', listingId: sharesBoth.id, sentAt: '2026-11-10T11:00:00Z', body: 'Still there?', shared: {} },
      ]),
    )
    renderApp('/messages')
    expect(screen.getAllByRole('link', { name: /Still there\?/ })).toHaveLength(1)
    expect(screen.queryByText('No messages yet.')).toBeNull()
  })

  test('a conversation you have not started links back to the listing', () => {
    renderApp(`/messages/${sharesBoth.id}`)
    expect(screen.getByText(`You haven’t messaged ${sharesBoth.poster.name} yet.`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `Open ${sharesBoth.title}` })).toBeInTheDocument()
  })

  test('an unknown listing shows not-found', () => {
    renderApp('/messages/does-not-exist')
    expect(screen.getByRole('heading', { name: 'We couldn’t find that conversation' })).toBeInTheDocument()
  })
})
