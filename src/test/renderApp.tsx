import { act, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '../App'
import type { Backend } from '../lib/backend/types'
import { AccountProvider } from '../state/AccountState'
import { AppStateProvider } from '../state/AppState'
import { CloudSync } from '../state/CloudSync'
import { createFakeBackend } from './fakeBackend'

/** Render the whole app at a URL, with a fresh userEvent. */
export function renderApp(url = '/', opts: { backend?: Backend; signedInAs?: string } = {}) {
  const { signedInAs } = opts
  const backend =
    opts.backend ??
    createFakeBackend({
      users: signedInAs ? [{ email: signedInAs, password: 'password123', name: 'Test Student' }] : [],
      sessionEmail: signedInAs,
    })
  const user = userEvent.setup()
  const utils = render(
    <MemoryRouter initialEntries={[url]}>
      <AccountProvider backend={backend}>
        <AppStateProvider>
          <CloudSync />
          <AppRoutes />
        </AppStateProvider>
      </AccountProvider>
    </MemoryRouter>,
  )
  return { user, backend, ...utils }
}

export function setBudget(n: number) {
  localStorage.setItem('shp.budget', JSON.stringify(n))
}

/** Let the account provider finish reading the session (signed-in tests call this before clicking). */
export async function sessionReady() {
  await act(async () => {})
}
