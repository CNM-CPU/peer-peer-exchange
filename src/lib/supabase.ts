import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigurationError =
  Boolean(supabaseUrl) !== Boolean(supabaseKey)
    ? 'Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to connect Supabase.'
    : null

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient<Database>(supabaseUrl, supabaseKey)
    : null
