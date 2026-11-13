import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigurationError =
  Boolean(supabaseUrl) !== Boolean(supabaseKey)
    ? 'Account services are unavailable right now. Please try again later.'
    : null

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient<Database>(supabaseUrl, supabaseKey)
    : null
