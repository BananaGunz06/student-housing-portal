/** An in-app path from router state, or '/results'. One leading slash, no `//host`, no `\`, no control characters. */
export function safeReturnTo(state: unknown): string {
  const r = (state as { returnTo?: unknown } | null | undefined)?.returnTo
  if (typeof r !== 'string' || !r.startsWith('/')) return '/results'
  if (r[1] === '/' || r[1] === '\\' || r.includes('\\')) return '/results'
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(r)) return '/results'
  return r
}
