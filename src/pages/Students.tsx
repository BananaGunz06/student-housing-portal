import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import StudentCard from '../components/StudentCard'
import type { BudgetBand, StudentCard as Student } from '../lib/backend/types'
import { BUDGET_BANDS, upcomingTerms } from '../lib/profile'
import { useAccount } from '../state/AccountState'

const PAGE = 30
const EMPTY_COPY = "No students are looking for roommates yet. Switch on 'Looking for roommates' in your profile to be the first."
const selectClass = 'min-h-11 w-full rounded-xl border-2 border-line bg-card px-3 py-2'
const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-6 font-bold text-white'

type Result = { key: string; students: Student[]; hasMore: boolean } | { key: string; error: true }

export default function Students() {
  const { status, backend, profile, session } = useAccount()
  const [params, setParams] = useSearchParams()
  const [terms] = useState(() => upcomingTerms(new Date()))
  const termParam = params.get('term')
  const bandParam = params.get('band')
  const term = terms.some((t) => t.value === termParam) ? termParam! : ''
  const band = (BUDGET_BANDS.find((b) => b.value === bandParam && b.value !== 'any')?.value ?? 'any') as BudgetBand
  const filtered = term !== '' || band !== 'any'

  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [more, setMore] = useState<'idle' | 'loading' | 'error'>('idle')
  const viewer = session?.userId ?? ''
  const key = `${viewer}|${term}|${band}|${retry}`
  const keyRef = useRef(key)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    keyRef.current = key
  }, [key])
  const signedIn = status === 'signed-in'

  useEffect(() => {
    if (!signedIn) return
    let current = true
    backend
      .listStudents({ moveInTerm: term || undefined, band, offset: 0, limit: PAGE })
      .then((r) => current && (setResult({ key, ...r }), setMore('idle')))
      .catch(() => current && setResult({ key, error: true }))
    return () => {
      current = false
    }
  }, [backend, signedIn, term, band, key])

  async function showMore(r: Extract<Result, { students: Student[] }>) {
    const asked = keyRef.current
    setMore('loading')
    try {
      const next = await backend.listStudents({ moveInTerm: term || undefined, band, offset: r.students.length, limit: PAGE })
      if (!mounted.current || keyRef.current !== asked) return
      const seen = new Set(r.students.map((x) => x.id))
      setResult({ key: asked, students: [...r.students, ...next.students.filter((x) => !seen.has(x.id))], hasMore: next.hasMore })
      setMore('idle')
    } catch {
      if (mounted.current && keyRef.current === asked) setMore('error')
    }
  }

  function setFilter(name: 'term' | 'band', value: string) {
    const next = new URLSearchParams(params)
    if (value && value !== 'any') next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: true })
  }

  let body
  if (status === 'loading') {
    body = <p className="mt-6 text-ink-soft">Loading…</p>
  } else if (status === 'signed-out') {
    body = (
      <div className="mt-6 flex flex-col items-start gap-4">
        <p>Sign in to see students looking for roommates.</p>
        <Link to="/account" className={buttonClass}>
          Sign in
        </Link>
      </div>
    )
  } else {
    const r = result && result.key === key ? result : null
    let list
    if (!r) list = <p className="mt-6 text-ink-soft">Loading students…</p>
    else if ('error' in r) {
      list = (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p>Couldn't load students.</p>
          <button type="button" className={buttonClass} onClick={() => (setResult(null), setRetry((n) => n + 1))}>
            Try again
          </button>
        </div>
      )
    } else if (r.students.length === 0) {
      list = filtered ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p>No students match these filters.</p>
          <button type="button" className={buttonClass} onClick={() => setParams({}, { replace: true })}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p>{EMPTY_COPY}</p>
          {profile && !profile.lookingForRoommates && (
            <Link to="/account" className="inline-flex min-h-11 items-center font-bold underline">
              Edit your profile
            </Link>
          )}
        </div>
      )
    } else {
      list = (
        <>
          <ul className="mt-6 flex flex-col gap-3">
            {r.students.map((s) => (
              <li key={s.id} className="min-w-0">
                <StudentCard student={s} />
              </li>
            ))}
          </ul>
          {more === 'error' && <p className="mt-3 text-sm">Couldn't load more students.</p>}
          {r.hasMore && (
            <button type="button" className={`${buttonClass} mt-4`} disabled={more === 'loading'} onClick={() => void showMore(r)}>
              {more === 'loading' ? 'Loading…' : 'Show more'}
            </button>
          )}
        </>
      )
    }
    body = (
      <>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-bold">
            Move-in term
            <select className={selectClass} value={term} onChange={(e) => setFilter('term', e.target.value)}>
              <option value="">Any term</option>
              {terms.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            Budget
            <select className={selectClass} value={band} onChange={(e) => setFilter('band', e.target.value)}>
              {BUDGET_BANDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {list}
      </>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <h1 className="font-display text-3xl font-bold">Students</h1>
      <p className="mt-1 text-ink-soft">Students looking for roommates.</p>
      {body}
    </div>
  )
}
