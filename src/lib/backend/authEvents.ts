import type { AuthChangeEvent } from '@supabase/supabase-js'

/**
 * Which supabase-js auth events reach the app.
 *
 * INITIAL_SESSION is dropped: getSession() owns the initial state. When the stored session can't
 * be read or refreshed (for example offline), supabase-js announces INITIAL_SESSION with a null
 * session before getSession() fails, and treating that as "signed out" would wipe saved places.
 */
export function shouldForwardAuthEvent(event: AuthChangeEvent | string): boolean {
  return event !== 'INITIAL_SESSION'
}
