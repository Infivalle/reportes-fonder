/**
 * Formato v2 del TSV: consulta de extracción ampliada (61 columnas).
 * Son las 52 columnas de v1, sin cambios y en el mismo orden, más 9 de `beneficiarios` al final.
 * Ver docs/formato-v2.md. El orden importa: el encabezado del archivo debe
 * coincidir exactamente con esta lista.
 */
import { COLUMNAS_V1 } from './v1.ts'

/** Columnas que v2 agrega al final (todas salen de `beneficiarios`). */
export const COLUMNAS_NUEVAS_V2 = [
  'municipioempresa',
  'tipoempresa',
  'aniofundacion',
  'empleosgenerado',
  'empleosagenerar',
  'patrimonio',
  'pasivos',
  'dinerosolicitado',
  'cuotas',
] as const

export const COLUMNAS_V2 = [...COLUMNAS_V1, ...COLUMNAS_NUEVAS_V2] as const

export type ColumnaV2 = (typeof COLUMNAS_V2)[number]

export const NUM_COLUMNAS_V2 = COLUMNAS_V2.length
