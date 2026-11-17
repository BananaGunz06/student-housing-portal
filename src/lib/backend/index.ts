import type { Backend } from './types'
import { createDemoBackend } from './demoData'
import { createSupabaseBackend } from './supabase'

/** True under `npm run demo`. A build-time constant, so a normal build drops the demo branch and its sample data. */
export const isDemo = import.meta.env.MODE === 'demo'

export const defaultBackend: Backend = isDemo
  ? createDemoBackend()
  : createSupabaseBackend(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
