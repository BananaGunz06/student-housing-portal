import { createSupabaseBackend } from './supabase'

export const defaultBackend = createSupabaseBackend(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
