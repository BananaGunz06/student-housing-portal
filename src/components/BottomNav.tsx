import { Link, useLocation } from 'react-router-dom'
import { useAppState } from '../state/AppState'

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  people: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  saved: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  account: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  messages: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
}

export default function BottomNav() {
  const { pathname } = useLocation()
  const { savedIds } = useAppState()
  const items = [
    {
      to: '/results',
      label: 'Places',
      icon: ICONS.list,
      active: pathname === '/results' || pathname.startsWith('/listing/'),
    },
    {
      to: '/students',
      label: 'Students',
      icon: ICONS.people,
      active: pathname === '/students' || pathname.startsWith('/students/'),
    },
    {
      to: '/saved',
      label: savedIds.length ? `Saved (${savedIds.length})` : 'Saved',
      icon: ICONS.saved,
      active: pathname === '/saved' || pathname === '/compare',
    },
    { to: '/messages', label: 'Messages', icon: ICONS.messages, active: pathname.startsWith('/messages') },
    { to: '/account', label: 'Account', icon: ICONS.account, active: pathname === '/account' },
  ]
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-[1100] border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map((it) => (
          <li key={it.label} className="flex-1">
            <Link
              to={it.to}
              aria-current={it.active ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-bold ${
                it.active ? 'text-ink' : 'text-ink-soft'
              }`}
            >
              <span className={`rounded-full px-4 py-0.5 ${it.active ? 'bg-highlight' : ''}`}>
                <Icon d={it.icon} />
              </span>
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
