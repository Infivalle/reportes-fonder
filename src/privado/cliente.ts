import type { SupabaseClient } from '@supabase/supabase-js'
import { crearClienteSupabase } from '../lib/supabase'

let cliente: SupabaseClient | null | undefined

/** Un solo cliente por pestaña (varios clientes comparten el almacenamiento de la sesión y se pisan). */
export function clienteCompartido(): SupabaseClient | null {
  if (cliente === undefined) cliente = crearClienteSupabase()
  return cliente
}
