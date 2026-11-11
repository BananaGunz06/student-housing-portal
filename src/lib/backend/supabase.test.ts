import { describe, expect, it } from 'vitest'
import { cloudStateToRow, dataError, mapAuthError, rowToCloudState } from './supabase'

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
