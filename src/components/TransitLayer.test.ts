import { describe, expect, test } from 'vitest'
import { STOPS } from '../data/transit'
import { stopLabel } from './mapShared'

describe('stopLabel', () => {
  test('names routes for students, never by the feed codes', () => {
    const labels = STOPS.map(stopLabel).join('\n')
    expect(labels).toContain('Ironwood Harvard')
    for (const code of ['IroHarv', 'WHanSco', 'EdiCol']) expect(labels).not.toContain(code)
  })
})
