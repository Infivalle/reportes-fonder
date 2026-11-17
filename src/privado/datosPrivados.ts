/**
 * Lectura de las tablas privadas con la sesión del usuario (RLS decide qué se ve).
 * PostgREST entrega como máximo 1.000 filas por consulta: se lee por páginas y con orden estable.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

const PAGINA = 1000
const MAX_PAGINAS = 200 // tope de seguridad: 200.000 filas

export async function leerTabla<T>(cliente: SupabaseClient, tabla: string, columnas: string, orden: string): Promise<T[]> {
  const todas: T[] = []
  for (let p = 0; p < MAX_PAGINAS; p += 1) {
    const desde = p * PAGINA
    const { data, error } = await cliente
      .from(tabla)
      .select(columnas)
      .order(orden, { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (error !== null) throw new Error(`No se pudo leer "${tabla}": ${error.message}`)
    const filas = (data ?? []) as unknown as T[]
    todas.push(...filas)
    if (filas.length < PAGINA) return todas
  }
  throw new Error(`La tabla "${tabla}" supera el tope de lectura (${MAX_PAGINAS * PAGINA} filas).`)
}

export interface CargaDb {
  id: number
  archivo: string
  formato: string
  filas_leidas: number
  asesorias_conservadas: number
  asesorias_descartadas: number
  beneficiarios_distintos: number
  creada_en: string
}

/** Última carga de datos (solo la ve el admin). null si todavía no hay cargas. */
export async function leerUltimaCarga(cliente: SupabaseClient): Promise<CargaDb | null> {
  const { data, error } = await cliente
    .from('cargas')
    .select('id,archivo,formato,filas_leidas,asesorias_conservadas,asesorias_descartadas,beneficiarios_distintos,creada_en')
    .order('id', { ascending: false })
    .limit(1)
  if (error !== null) throw new Error(`No se pudo leer la última carga: ${error.message}`)
  const filas = (data ?? []) as unknown as CargaDb[]
  return filas[0] ?? null
}

/** Fecha de una carga en hora de Colombia (UTC-5), 'AAAA-MM-DD'. */
export function diaColombia(iso: string): string {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? '' : new Date(t - 5 * 3600 * 1000).toISOString().slice(0, 10)
}
