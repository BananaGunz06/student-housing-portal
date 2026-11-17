import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryBackend } from './memory'

afterEach(() => vi.useRealTimers())

const base = {
  users: [{ email: 'me@example.com', password: 'password1', name: 'Me' }],
  sessionEmail: 'me@example.com',
}

describe('createMemoryBackend', () => {
  it('waits delayMs before a call resolves', async () => {
    vi.useFakeTimers()
    const b = createMemoryBackend({ ...base, delayMs: 50 })
    let done = false
    const p = b.listStudents({ limit: 10 }).then((r) => {
      done = true
      return r
    })
    await vi.advanceTimersByTimeAsync(49)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await p
    expect(done).toBe(true)
  })

  it('uses a custom photoUrl for an uploaded photo', async () => {
    const photoUrl = vi.fn(() => 'blob:custom-link')
    const b = createMemoryBackend({ ...base, photoUrl })
    const photo = new Blob(['x'])
    expect(await b.uploadAvatar(photo)).toBe('blob:custom-link')
    expect(photoUrl).toHaveBeenCalledWith(photo, b.idOf('me@example.com'), expect.any(Number))
    expect((await b.loadProfile()).avatarUrl).toBe('blob:custom-link')
  })

  it('keeps the default avatars.example.com link', async () => {
    const b = createMemoryBackend(base)
    expect(await b.uploadAvatar(new Blob(['x']))).toMatch(/^https:\/\/avatars\.example\.com\/.+\/avatar\.jpg\?v=\d+$/)
  })

  it('shows a seeded avatarUrl until the student uploads a photo, then the upload wins', async () => {
    const b = createMemoryBackend({
      ...base,
      photoUrl: () => 'blob:upload',
      students: [{ email: 'sam@example.com', name: 'Sam', lookingForRoommates: true, avatarUrl: 'data:image/svg+xml,seed' }],
    })
    const id = (await b.listStudents({ limit: 10 })).students[0].id
    expect((await b.listStudents({ limit: 10 })).students[0].avatarUrl).toBe('data:image/svg+xml,seed')
    expect((await b.getStudent(id))?.avatarUrl).toBe('data:image/svg+xml,seed')
    await b.signIn('sam@example.com', 'password1')
    await b.uploadAvatar(new Blob(['x']))
    expect((await b.loadProfile()).avatarUrl).toBe('blob:upload')
    await b.signIn('me@example.com', 'password1')
    expect((await b.getStudent(id))?.avatarUrl).toBe('blob:upload')
  })
})
