export const CAMPUS = {
  name: 'University of Guelph',
  shortName: 'U of G',
  lat: 43.5305,
  lng: -80.2262,
  /** Stop id of the on-campus bus loop every sample route passes through. */
  stopId: 'campus',
  /**
   * Extra monthly transit cost for a student. U of G undergraduates pay the
   * Universal Bus Pass (UPass) through their student fees, so it adds nothing
   * on top of rent.
   */
  transitMonthly: 0,
  transitNote: 'Bus pass included in U of G student fees',
  /** Fallbacks when a listing has no estimate of its own. */
  defaultUtilities: 100,
  defaultInternet: 60,
} as const

export type Campus = typeof CAMPUS
