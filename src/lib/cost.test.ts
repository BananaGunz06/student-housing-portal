import { describe, expect, test } from 'vitest'
import { makeListing } from '../test/makeListing'
import { fitStatus, formatMoney, trueMonthlyCost } from './cost'

describe('trueMonthlyCost', () => {
  test('included utilities and internet cost nothing extra', () => {
    expect(trueMonthlyCost(makeListing({ rent: 800 }))).toEqual({
      rent: 800,
      utilities: 0,
      internet: 0,
      transit: 0,
      total: 800,
    })
  })

  test('adds estimates when utilities and internet are not included', () => {
    const cost = trueMonthlyCost(
      makeListing({
        rent: 1200,
        utilitiesIncluded: false,
        utilitiesEstimate: 110,
        internetIncluded: false,
        internetEstimate: 60,
      }),
    )
    expect(cost).toEqual({ rent: 1200, utilities: 110, internet: 60, transit: 0, total: 1370 })
  })

  test('falls back to campus defaults when a listing has no estimate', () => {
    const cost = trueMonthlyCost(
      makeListing({
        rent: 1000,
        utilitiesIncluded: false,
        utilitiesEstimate: 0,
        internetIncluded: false,
        internetEstimate: 0,
      }),
    )
    expect(cost.utilities).toBe(100)
    expect(cost.internet).toBe(60)
    expect(cost.total).toBe(1160)
  })

  test('uses the campus transit cost', () => {
    const campus = { defaultUtilities: 100, defaultInternet: 60, transitMonthly: 45 }
    expect(trueMonthlyCost(makeListing({ rent: 700 }), campus).total).toBe(745)
  })
})

describe('fitStatus', () => {
  test('exactly at budget fits', () => expect(fitStatus(1000, 1000)).toBe('fits'))
  test('under budget fits', () => expect(fitStatus(650, 1000)).toBe('fits'))
  test('one dollar over is a stretch', () => expect(fitStatus(1001, 1000)).toBe('stretch'))
  test('exactly 10% over is a stretch', () => expect(fitStatus(1100, 1000)).toBe('stretch'))
  test('more than 10% over is over budget', () => expect(fitStatus(1101, 1000)).toBe('over'))
  test('10% boundary has no float error', () => expect(fitStatus(770, 700)).toBe('stretch'))
})

test('formatMoney', () => {
  expect(formatMoney(1240)).toBe('$1,240')
  expect(formatMoney(0)).toBe('$0')
})
