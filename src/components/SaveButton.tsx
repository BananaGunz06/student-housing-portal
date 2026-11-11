import { useAccount } from '../state/AccountState'
import { useAppState } from '../state/AppState'

export default function SaveButton({
  id,
  title,
  className = '',
}: {
  id: string
  title: string
  className?: string
}) {
  const { isSaved, toggleSaved } = useAppState()
  const { requireAccount } = useAccount()
  const saved = isSaved(id)
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={`Save ${title}`}
      onClick={() => (saved ? toggleSaved(id) : requireAccount('save', () => toggleSaved(id)))}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 font-bold ${
        saved ? 'border-ink bg-ink text-white' : 'border-ink bg-card text-ink'
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      {saved ? 'Saved' : 'Save'}
    </button>
  )
}
