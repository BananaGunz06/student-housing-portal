import { describe, expect, it } from 'vitest'
import { upcomingTerms } from '../profile'
import { createDemoBackend, DEMO_EMAIL, DEMO_PASSWORD, demoStudents } from './demoData'

describe('createDemoBackend', () => {
  it('starts signed in as the demo student with an empty profile', async () => {
    const b = createDemoBackend()
    expect(await b.getSession()).toMatchObject({ email: DEMO_EMAIL })
    const p = await b.loadProfile()
    expect(p.displayName).toBe('Demo Student')
    expect(p).toMatchObject({ bio: '', program: '', year: null, moveInTerm: null, budget: null, lookingForRoommates: false, avatarUrl: null })
    expect(await b.loadState()).toEqual({ budget: null, filters: null, savedIds: [], messages: [] })
  })

  it('lists exactly the 8 visible students, newest first', async () => {
    const b = createDemoBackend()
    const { students, nextCursor } = await b.listStudents({ limit: 30 })
    const visible = demoStudents().filter((s) => s.lookingForRoommates)
    expect(students).toHaveLength(8)
    expect(nextCursor).toBeNull()
    // Defined oldest to newest, so the last defined comes first.
    expect(students.map((s) => s.displayName)).toEqual(visible.map((s) => s.name).reverse())
  })

  it('has fictional, varied sample people', () => {
    const names = demoStudents().map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).not.toContain('Demo Student')
    for (const s of demoStudents()) expect(s.email.endsWith('@example.com')).toBe(true)
    const terms = upcomingTerms(new Date()).map((t) => t.value)
    for (const s of demoStudents()) if (s.moveInTerm) expect(terms).toContain(s.moveInTerm)
    const visible = demoStudents().filter((s) => s.lookingForRoommates)
    expect(new Set(visible.map((s) => s.program)).size).toBeGreaterThanOrEqual(5)
    expect(visible.some((s) => s.year === 'grad')).toBe(true)
    expect(visible.some((s) => s.bio === '')).toBe(true)
    expect(visible.some((s) => s.bio?.length === 300)).toBe(true)
    expect(visible.filter((s) => s.avatarUrl?.startsWith('data:image/svg+xml')).length).toBe(5)
    const bands = new Set<number>(visible.map((s) => (s.budget == null ? 0 : s.budget <= 600 ? 1 : s.budget <= 800 ? 2 : s.budget <= 1000 ? 3 : 4)))
    for (const b of [1, 2, 3, 4]) expect(bands.has(b)).toBe(true)
  })

  it('hides the hidden students', async () => {
    const b = createDemoBackend()
    const all = (await b.listStudents({ limit: 30 })).students.map((s) => s.id)
    const hidden = demoStudents().filter((s) => !s.lookingForRoommates)
    expect(hidden).toHaveLength(2)
    // Hidden students have the ids right after the demo user and the visible ones; probe every id.
    for (let i = 1; i <= 11; i++) {
      const id = `user-${i}`
      if (!all.includes(id)) {
        const card = await b.getStudent(id)
        expect(card).toBeNull()
      }
    }
  })

  it('lets the visitor sign out and back in', async () => {
    const b = createDemoBackend()
    await b.signOut()
    expect(await b.getSession()).toBeNull()
    expect(await b.signIn(DEMO_EMAIL, DEMO_PASSWORD)).toMatchObject({ ok: true })
    expect(await b.getSession()).toMatchObject({ email: DEMO_EMAIL })
  })
})
