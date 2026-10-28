/**
 * Etiquetas de los rangos de la capa pública, en orden de menor a mayor.
 * Deben coincidir con las funciones SQL rango_monto() y rango_conteo()
 * (supabase/migrations/20261029000000_capa_publica.sql); una prueba lo verifica.
 */
export const RANGOS_MONTO = [
  'Menos de $500 mil',
  '$500 mil a $1 millón',
  '$1 a $2 millones',
  '$2 a $5 millones',
  '$5 a $10 millones',
  '$10 a $20 millones',
  'Más de $20 millones',
] as const

export const RANGOS_CONTEO = ['0 a 10', '11 a 25', '26 a 50', '51 a 100', 'Más de 100'] as const

/** Un grupo con menos beneficiarios que esto no se publica como agregado. */
export const MINIMO_GRUPO = 5
