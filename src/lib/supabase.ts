import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Acepta la URL aunque se haya copiado con /rest/v1 al final
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Sin variables de entorno la app funciona en modo demo (datos locales).
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const isDemo = !supabase
