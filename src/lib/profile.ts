import type { BudgetBand, StudentDetails, StudyYear } from './backend/types'

export const BIO_MAX = 300
export const PROGRAM_MAX = 80
export const BUDGET_MIN = 300
export const BUDGET_MAX = 5000

export const YEARS: { value: StudyYear; label: string }[] = [
  { value: '1', label: '1st year' },
  { value: '2', label: '2nd year' },
  { value: '3', label: '3rd year' },
  { value: '4', label: '4th year' },
  { value: '5+', label: '5th year or later' },
  { value: 'grad', label: 'Graduate' },
]

export const BUDGET_BANDS: { value: BudgetBand; label: string }[] = [
  { value: 'any', label: 'Any budget' },
  { value: 'under600', label: 'Up to $600' },
  { value: '600-800', label: '$600–800' },
  { value: '800-1000', label: '$800–1000' },
  { value: 'over1000', label: 'Over $1000' },
]

const SEASONS = ['winter', 'summer', 'fall'] as const
const SEASON_LABEL = { winter: 'Winter', summer: 'Summer', fall: 'Fall' }

/** Winter = Jan–Apr, Summer = May–Aug, Fall = Sep–Dec. */
function seasonIndex(month: number): number {
  return month < 4 ? 0 : month < 8 ? 1 : 2
}

/** The terms after today's, starting with the next one. */
export function upcomingTerms(today: Date, count = 6): { value: string; label: string }[] {
  let year = today.getFullYear()
  let s = seasonIndex(today.getMonth())
  const out: { value: string; label: string }[] = []
  for (let i = 0; i < count; i++) {
    s++
    if (s === SEASONS.length) {
      s = 0
      year++
    }
    const value = `${year}-${SEASONS[s]}`
    out.push({ value, label: termLabel(value) })
  }
  return out
}

/** '2027-09' → '2027-fall'. Winter = Jan–Apr, Summer = May–Aug, Fall = Sep–Dec. */
export function termOfMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return `${year}-${SEASONS[seasonIndex(m - 1)]}`
}

const SEASON_START_MONTH = { winter: 'January', summer: 'May', fall: 'September' }

/** '2027-fall' → 'September'. */
export function termStartMonthName(term: string): string {
  return SEASON_START_MONTH[term.split('-')[1] as keyof typeof SEASON_START_MONTH] ?? ''
}

/** '2027-fall' → 'Fall 2027'. */
export function termLabel(value: string): string {
  const [year, season] = value.split('-')
  return `${SEASON_LABEL[season as keyof typeof SEASON_LABEL] ?? season} ${year}`
}

/** Year, then winter < summer < fall. */
function termRank(value: string): number {
  const [year, season] = value.split('-')
  return Number(year) * 3 + SEASONS.indexOf(season as (typeof SEASONS)[number])
}

/** The upcoming terms, with a stored term that isn't among them placed in date order. */
export function termOptionsWith(terms: { value: string; label: string }[], stored: string | null): { value: string; label: string }[] {
  if (!stored || terms.some((t) => t.value === stored)) return terms
  const rank = termRank(stored)
  const at = terms.findIndex((t) => termRank(t.value) > rank)
  const extra = { value: stored, label: termLabel(stored) }
  return at < 0 ? [...terms, extra] : [...terms.slice(0, at), extra, ...terms.slice(at)]
}

export function validateDetails(d: StudentDetails): Partial<Record<keyof StudentDetails, string>> {
  const errors: Partial<Record<keyof StudentDetails, string>> = {}
  if (d.bio.length > BIO_MAX) errors.bio = `Keep your bio to ${BIO_MAX} characters.`
  if (d.program.length > PROGRAM_MAX) errors.program = `Keep your program to ${PROGRAM_MAX} characters.`
  if (d.budget !== null && (!Number.isInteger(d.budget) || d.budget < BUDGET_MIN || d.budget > BUDGET_MAX)) {
    errors.budget = `Enter a whole number from $${BUDGET_MIN} to $${BUDGET_MAX}.`
  }
  return errors
}

/** 'Biology · 2nd year', either part alone, or ''. */
export function profileSummary(p: Pick<StudentDetails, 'program' | 'year'>): string {
  const year = YEARS.find((y) => y.value === p.year)?.label
  return [p.program.trim(), year].filter(Boolean).join(' · ')
}
