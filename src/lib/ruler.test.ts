import { describe, expect, test } from 'vitest'
import { rulerLayout } from './ruler'

const at = (id: string, total: number) => ({ id, total })

describe('rulerLayout', () => {
  test('the scale runs from half to one and a half times the budget, in $100 steps', () => {
    const r = rulerLayout([at('a', 700)], 1000)
    expect(r.lo).toBe(500)
    expect(r.hi).toBe(1500)
    expect(r.budgetX).toBeCloseTo(0.5)
    expect(r.stretchX).toBeCloseTo(0.6)
  })

  test('stretches down to the cheapest place', () => {
    expect(rulerLayout([at('a', 340)], 1000).lo).toBe(300)
  })

  test('places each dot by cost and stacks dots that land close together', () => {
    const r = rulerLayout([at('a', 1000), at('b', 1010), at('c', 1100)], 1000)
    const byId = Object.fromEntries(r.dots.map((d) => [d.id, d]))
    expect(byId.a.x).toBeCloseTo(0.5)
    expect(byId.a.stack).toBe(0)
    expect(byId.b.stack).toBe(1)
    expect(byId.c.stack).toBe(0)
  })

  test('counts places beyond the right edge instead of drawing them', () => {
    const r = rulerLayout([at('a', 900), at('b', 2000), at('c', 3100)], 1000)
    expect(r.dots.map((d) => d.id)).toEqual(['a'])
    expect(r.beyond).toBe(2)
  })

  test('caps a stack so tall piles stay inside the strip', () => {
    const r = rulerLayout(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => at(id, 800)), 1000)
    expect(Math.max(...r.dots.map((d) => d.stack))).toBe(3)
    expect(r.dots).toHaveLength(6)
  })
})
