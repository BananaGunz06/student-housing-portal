import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shouldForwardAuthEvent } from './authEvents'
import { bandBounds } from './bands'
import { cloudStateToRow, createSupabaseBackend, cursorFilter, dataError, isUuid, makeCursor, parseCursor, profileUpdateRow, mapAuthError, rowToCloudState } from './supabase'

// A recording stand-in for the Supabase client: every query call is logged, and awaiting a query gives `rows`.
const h = vi.hoisted(() => ({ calls: [] as [string, unknown[]][], signed: [] as string[][], rows: [] as Record<string, unknown>[] }))
vi.mock('@supabase/supabase-js', () => {
  const query: Record<string, unknown> = {}
  const record = (name: string) => (...args: unknown[]) => (h.calls.push([name, args]), query)
  for (const n of ['select', 'eq', 'neq', 'gt', 'lte', 'or', 'order', 'limit']) query[n] = record(n)
  query.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: h.rows, error: null }).then(ok)
  return {
    createClient: () => ({
      auth: { getSession: async () => ({ data: { session: { user: { id: 'me' } } }, error: null }) },
      from: () => query,
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[]) => (h.signed.push(paths), { data: paths.map((p) => ({ path: p, signedUrl: `https://signed.example.com/${p}`, error: null })), error: null }),
        }),
      },
    }),
  }
})

describe('mapAuthError', () => {
  it('maps invalid credentials', () => {
    expect(mapAuthError({ code: 'invalid_credentials', message: 'x' })).toBe('invalid-credentials')
    expect(mapAuthError({ message: 'Invalid login credentials' })).toBe('invalid-credentials')
  })
  it('maps email taken', () => {
    expect(mapAuthError({ code: 'user_already_exists', message: 'x' })).toBe('email-taken')
    expect(mapAuthError({ message: 'User already registered' })).toBe('email-taken')
  })
  it('maps weak password', () => {
    expect(mapAuthError({ code: 'weak_password', message: 'x' })).toBe('weak-password')
    expect(mapAuthError({ message: 'Password should be at least 6 characters' })).toBe('weak-password')
  })
  it('maps network failures', () => {
    expect(mapAuthError(new TypeError('Failed to fetch'))).toBe('network')
    expect(mapAuthError({ message: 'fetch failed' })).toBe('network')
    expect(mapAuthError(new TypeError('Load failed'))).toBe('network')
    expect(mapAuthError({ name: 'AuthRetryableFetchError', message: 'x' })).toBe('network')
  })
  it('falls back to unknown', () => {
    expect(mapAuthError({ message: 'boom' })).toBe('unknown')
    expect(mapAuthError(null)).toBe('unknown')
  })
})

describe('row mapping', () => {
  it('turns a row into a CloudState', () => {
    expect(rowToCloudState({ budget: 1000, filters: null, saved_ids: ['gue-001'], messages: [] })).toEqual({
      budget: 1000,
      filters: null,
      savedIds: ['gue-001'],
      messages: [],
    })
  })
  it('treats a missing row as empty', () => {
    expect(rowToCloudState(null)).toEqual({ budget: null, filters: null, savedIds: [], messages: [] })
  })
  it('turns a CloudState into a row', () => {
    const row = cloudStateToRow('u1', { budget: 900, filters: null, savedIds: ['a'], messages: [] })
    expect(row).toMatchObject({ user_id: 'u1', budget: 900, filters: null, saved_ids: ['a'], messages: [] })
    expect(typeof row.updated_at).toBe('string')
  })
})

describe('dataError', () => {
  it('reports Safari network failures as network', () => {
    expect(dataError({ message: 'TypeError: Load failed', code: '' }).message).toBe('network')
  })
  it('keeps other messages', () => {
    expect(dataError({ message: 'permission denied' }).message).toBe('permission denied')
  })
})

describe('shouldForwardAuthEvent', () => {
  it('ignores INITIAL_SESSION, because getSession() owns the initial state', () => {
    expect(shouldForwardAuthEvent('INITIAL_SESSION')).toBe(false)
  })
  it('forwards real changes', () => {
    for (const e of ['SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED']) {
      expect(shouldForwardAuthEvent(e)).toBe(true)
    }
  })
})

describe('profileUpdateRow', () => {
  it('maps only the fields that are supplied', () => {
    const row = profileUpdateRow({ displayName: 'Sam' })
    expect(Object.keys(row)).toEqual(['display_name'])
    expect(row.display_name).toBe('Sam')
    expect(profileUpdateRow({ displayName: 'Sam', bio: 'Hi', year: null, lookingForRoommates: true, moveInTerm: '2027-fall', program: 'CS', budget: 700 })).toMatchObject({
      bio: 'Hi',
      year: null,
      looking_for_roommates: true,
      move_in_term: '2027-fall',
      program: 'CS',
      budget: 700,
    })
  })
  it('never includes the phone, which lives in its own table', () => {
    expect(profileUpdateRow({ displayName: 'Sam', phone: '555-0100' })).not.toHaveProperty('phone')
    expect(profileUpdateRow({ displayName: 'Sam', phone: null })).not.toHaveProperty('phone')
  })
})

describe('bandBounds', () => {
  it('describes each band as over (exclusive) and upTo (inclusive)', () => {
    expect(bandBounds('any')).toEqual({})
    expect(bandBounds('under600')).toEqual({ upTo: 600 })
    expect(bandBounds('600-800')).toEqual({ over: 600, upTo: 800 })
    expect(bandBounds('800-1000')).toEqual({ over: 800, upTo: 1000 })
    expect(bandBounds('over1000')).toEqual({ over: 1000 })
  })
})

describe('isUuid', () => {
  it('accepts UUIDs and rejects anything else', () => {
    expect(isUuid('3f2b8c1e-9d4a-4e5b-8a6c-1d2e3f4a5b6c')).toBe(true)
    expect(isUuid('3F2B8C1E-9D4A-4E5B-8A6C-1D2E3F4A5B6C')).toBe(true)
    expect(isUuid('abc')).toBe(false)
    expect(isUuid('')).toBe(false)
    expect(isUuid('3f2b8c1e-9d4a-4e5b-8a6c-1d2e3f4a5b6c; drop')).toBe(false)
  })
})

describe('Students list cursor', () => {
  const ID_A = '11111111-1111-4111-8111-111111111111'
  const ID_B = '22222222-2222-4222-8222-222222222222'
  const TIME = '2026-11-15T10:20:30.123456+00:00'

  it('keeps the database time exactly and round-trips', () => {
    expect(makeCursor(TIME, ID_A)).toBe(`${TIME}|${ID_A}`)
    expect(parseCursor(makeCursor(TIME, ID_A))).toEqual({ updatedAt: TIME, id: ID_A })
  })
  it('builds the filter with the raw quoted time and the id', () => {
    expect(cursorFilter({ updatedAt: TIME, id: ID_A })).toBe(`updated_at.lt."${TIME}",and(updated_at.eq."${TIME}",id.lt.${ID_A})`)
  })
  it('treats a malformed cursor as none', () => {
    for (const bad of [undefined, '', 'nope', `${TIME}`, `${TIME}|not-a-uuid`, `x|${ID_A}`, `${TIME}"),id.gt.0,or(a.eq.1|${ID_A}`]) expect(parseCursor(bad)).toBeNull()
  })

  describe('listStudents', () => {
    const row = (id: string, updated_at: string, avatar_path: string | null) => ({ id, updated_at, display_name: 'N', avatar_path })
    beforeEach(() => {
      h.calls.length = 0
      h.signed.length = 0
    })
    const backend = () => createSupabaseBackend('https://x.example.com', 'publishable')

    it('asks for limit + 1 newest-first with the id tie-break, signs only the kept rows, and returns the last kept row as the cursor', async () => {
      h.rows = [row(ID_B, TIME, 'b/avatar.jpg'), row(ID_A, '2026-11-15T10:20:29+00:00', 'a/avatar.jpg')]
      const r = await backend().listStudents({ limit: 1 })
      expect(h.calls).toContainEqual(['limit', [2]])
      expect(h.calls.filter(([n]) => n === 'order').map(([, a]) => a)).toEqual([
        ['updated_at', { ascending: false }],
        ['id', { ascending: false }],
      ])
      expect(h.calls.some(([n]) => n === 'or')).toBe(false)
      expect(h.signed).toEqual([['b/avatar.jpg']])
      expect(r.students.map((s) => s.id)).toEqual([ID_B])
      expect(r.nextCursor).toBe(`${TIME}|${ID_B}`)
    })
    it('has no cursor on the last page', async () => {
      h.rows = [row(ID_B, TIME, null)]
      expect((await backend().listStudents({ limit: 1 })).nextCursor).toBeNull()
    })
    it('adds the cursor filter for `after`, and ignores a malformed one', async () => {
      h.rows = []
      await backend().listStudents({ limit: 30, after: `${TIME}|${ID_A}` })
      expect(h.calls).toContainEqual(['or', [`updated_at.lt."${TIME}",and(updated_at.eq."${TIME}",id.lt.${ID_A})`]])
      h.calls.length = 0
      await backend().listStudents({ limit: 30, after: 'garbage' })
      expect(h.calls.some(([n]) => n === 'or')).toBe(false)
    })
  })
})
