import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '../App'
import { AppStateProvider } from '../state/AppState'

/** Render the whole app at a URL, with a fresh userEvent. */
export function renderApp(url = '/') {
  const user = userEvent.setup()
  const utils = render(
    <MemoryRouter initialEntries={[url]}>
      <AppStateProvider>
        <AppRoutes />
      </AppStateProvider>
    </MemoryRouter>,
  )
  return { user, ...utils }
}

export function setBudget(n: number) {
  localStorage.setItem('shp.budget', JSON.stringify(n))
}
