export const CAMPUS = {
  name: 'University of Guelph',
  shortName: 'U of G',
  /** Centre of the 13 University Centre bus platforms (average of their stop coordinates). */
  lat: 43.52935,
  lng: -80.22424,
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
