import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import type { StudentCard } from '../lib/backend/types'
import { formatMoney } from '../lib/cost'
import { profileSummary, termLabel } from '../lib/profile'
import { useAccount } from '../state/AccountState'

const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-6 font-bold text-white'
const linkClass = 'inline-flex min-h-11 items-center font-bold underline'

type Result = { id: string; viewer: string; retry: number; student: StudentCard | null } | { id: string; viewer: string; retry: number; error: true }

export default function StudentProfile() {
  const { id = '' } = useParams()
  const { status, session, profile, profileStatus, reloadProfile, backend } = useAccount()
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const viewer = session?.userId ?? ''
  const own = session !== null && session.userId === id
  const fetching = status === 'signed-in' && !own

  useEffect(() => {
    if (!fetching) return
    let current = true
    backend
      .getStudent(id)
      .then((student) => current && setResult({ id, viewer, retry, student }))
      .catch(() => current && setResult({ id, viewer, retry, error: true }))
    return () => {
      current = false
    }
  }, [backend, fetching, id, viewer, retry])

  if (status === 'loading') return <LoadingPage />
  if (status === 'signed-out') return <Navigate to="/account" replace />

  const back = (
    <Link to="/students" className={linkClass}>
      Back to Students
    </Link>
  )

  let student: StudentCard | null = null
  if (own && session && profile) {
    student = { ...profile, id: session.userId }
  } else if (own) {
    if (profileStatus === 'error') {
      return (
        <Page>
          {back}
          <h1 className={`mt-4 ${headingClass}`}>Student profile</h1>
          <p role="alert" className="mt-4">
            Couldn't load your profile.
          </p>
          <button type="button" className={`${buttonClass} mt-3`} onClick={reloadProfile}>
            Try again
          </button>
        </Page>
      )
    }
    return <LoadingPage />
  } else {
    const r = result && result.id === id && result.viewer === viewer && result.retry === retry ? result : null
    if (!r) return <LoadingPage />
    if ('error' in r) {
      return (
        <Page>
          {back}
          <h1 className={`mt-4 ${headingClass}`}>Student profile</h1>
          <p role="alert" className="mt-4">
            Couldn't load this profile.
          </p>
          <button type="button" className={`${buttonClass} mt-3`} onClick={() => (setResult(null), setRetry((n) => n + 1))}>
            Try again
          </button>
        </Page>
      )
    }
    if (!r.student) {
      return (
        <Page>
          {back}
          <h1 className={`mt-4 ${headingClass}`}>This profile isn't available.</h1>
        </Page>
      )
    }
    student = r.student
  }

  const summary = profileSummary(student)
  const hasDetails = student.bio.trim() !== '' || summary !== '' || student.moveInTerm !== null || student.budget !== null
  return (
    <Page>
      {!own && back}
      <div className="mt-4 flex items-center gap-4">
        <Avatar name={student.displayName} url={student.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="break-words font-display text-3xl font-bold">{student.displayName}</h1>
          {student.lookingForRoommates && (
            <p className="mt-1 inline-block rounded-full bg-highlight px-3 py-1 text-sm font-bold">Looking for roommates</p>
          )}
        </div>
      </div>
      {summary && <p className="mt-4 break-words text-lg">{summary}</p>}
      {student.moveInTerm && <p className="mt-2">{`Moving in ${termLabel(student.moveInTerm)}`}</p>}
      {student.budget !== null && <p className="mt-2">{`Budget: ${formatMoney(student.budget)} a month`}</p>}
      {student.bio.trim() !== '' && <p className="mt-4 whitespace-pre-line break-words">{student.bio}</p>}
      {!hasDetails && <p className="mt-4 text-ink-soft">This student hasn't added details yet.</p>}
      {own && (
        <Link to="/account" className={`${buttonClass} mt-6`}>
          Edit profile
        </Link>
      )}
    </Page>
  )
}

const headingClass = 'font-display text-2xl font-bold'

/** The page while the student is loading: a heading and a live "Loading…". */
function LoadingPage() {
  return (
    <Page>
      <h1 className={headingClass}>Student profile</h1>
      <p role="status" className="mt-4 text-ink-soft">
        Loading…
      </p>
    </Page>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 pt-6">{children}</div>
}
