import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import ProfileForm from '../components/ProfileForm'
import { useAccount } from '../state/AccountState'

/** Only an in-app path counts: one slash, not `//host`. */
function safeReturnTo(state: unknown): string {
  const r = (state as { returnTo?: unknown } | null)?.returnTo
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/results'
}

/** Optional profile setup, shown once after creating an account. */
export default function ProfileSetup() {
  const { status } = useAccount()
  const location = useLocation()
  const navigate = useNavigate()

  if (status === 'loading') return <p className="px-4 pt-6 text-center text-ink-soft">Loading…</p>
  if (status === 'signed-out') return <Navigate to="/account" replace />

  const done = () => navigate(safeReturnTo(location.state), { replace: true })
  return (
    <main className="min-h-full bg-paper px-4 py-8">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <h1 className="font-display text-3xl font-bold">Set up your profile</h1>
        <p className="text-ink-soft">All of this is optional. You can change it any time in Account.</p>
        <ProfileForm
          submitLabel="Save and continue"
          onSaved={done}
          secondary={
            <button type="button" onClick={done} className="min-h-11 rounded-xl border-2 border-line bg-card px-5 font-bold">
              Skip for now
            </button>
          }
        />
      </div>
    </main>
  )
}
