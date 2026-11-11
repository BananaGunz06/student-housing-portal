import { act, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, type Location, type NavigateFunction } from 'react-router-dom'
import { AppRoutes } from '../App'
import type { Backend } from '../lib/backend/types'
import { AccountProvider } from '../state/AccountState'
import { AppStateProvider } from '../state/AppState'
import { CloudSync } from '../state/CloudSync'
import { createFakeBackend } from './fakeBackend'
import RouterProbe from './RouterProbe'

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
  const probe: { location?: Location; navigate?: NavigateFunction } = {}
  const utils = render(
    <MemoryRouter initialEntries={[url]}>
      <AccountProvider backend={backend}>
        <AppStateProvider>
          <CloudSync />
          <RouterProbe onRouter={(location, navigate) => Object.assign(probe, { location, navigate })} />
          <AppRoutes />
        </AppStateProvider>
      </AccountProvider>
    </MemoryRouter>,
  )
  return {
    user,
    backend,
    /** Where the router is now. */
    location: () => probe.location!,
    /** Navigate like a link or the browser buttons would (wrap in act()). */
    navigate: ((...args: Parameters<NavigateFunction>) => probe.navigate!(...args)) as NavigateFunction,
    ...utils,
  }
}

export function setBudget(n: number) {
  localStorage.setItem('shp.budget', JSON.stringify(n))
}

/** Let the account provider finish reading the session (signed-in tests call this before clicking). */
export async function sessionReady() {
  await act(async () => {})
}
