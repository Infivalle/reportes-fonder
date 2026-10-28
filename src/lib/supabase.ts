import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase para el navegador.
 * Usa SOLO la llave "anon" (pública por diseño). La llave service_role
 * jamás debe aparecer en el frontend.
 *
 * Devuelve null si las variables no están configuradas, para que la capa
 * pública (que no depende de Supabase) siga funcionando.
 */
export function crearClienteSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const llave = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !llave) return null
  return createClient(url, llave)
}
