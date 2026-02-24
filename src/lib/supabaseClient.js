// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,           // <— en producción debe estar en true
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

