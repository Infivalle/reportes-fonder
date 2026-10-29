/**
 * Catálogo de campos graficables de la capa pública.
 *
 * El tipo de cada campo decide qué gráficas y medidas admite (ver GRAFICAS_POR_TIPO y
 * MEDIDAS_POR_TIPO). Solo entran campos que existen en `publico.json`: nada de la capa privada.
 * Las claves son las de `FilaPublica` (snake_case), no las columnas del TSV.
 */
import type { FilaPublica } from '../publico/tipos'
import { LINEAS } from '../lineas/lineas'
import { CANALES, MEJORAS } from './codigos'
import { OPCIONES_FORMULARIO } from './opciones'

export type TipoCampo = 'categorico' | 'ordinal' | 'numerico' | 'rango' | 'multivalor' | 'fecha'

export type Capa = 'publica' | 'privada'

export type Grupo = 'general' | 'resultados' | 'credito' | 'finanzas' | 'ventas' | 'empleo'

export type Medida = 'conteo' | 'porcentaje' | 'promedio' | 'mediana' | 'minimo' | 'maximo'

export type Grafica = 'barras' | 'barras_horizontales' | 'dona' | 'apilada_100' | 'histograma' | 'tabla'

/** Rangos de monto publicados (en el orden en que deben graficarse). */
export const RANGOS_MONTO = [
  'Menos de $500 mil',
  '$500 mil a $1 millón',
  '$1 a $2 millones',
  '$2 a $5 millones',
  '$5 a $10 millones',
  '$10 a $20 millones',
  'Más de $20 millones',
] as const

/** Rangos de conteo publicados (clientes y ventas por mes). */
export const RANGOS_CONTEO = ['0 a 10', '11 a 25', '26 a 50', '51 a 100', 'Más de 100'] as const

type ClaveEscalar = {
  [K in keyof FilaPublica]: FilaPublica[K] extends string | null ? K : never
}[keyof FilaPublica]

type ClaveNumerica = {
  [K in keyof FilaPublica]: FilaPublica[K] extends number | null ? K : never
}[keyof FilaPublica]

interface Base {
  etiqueta: string
  grupo: Grupo
  capa: 'publica'
}

export type CampoCatalogo =
  | (Base & { clave: ClaveEscalar; tipo: 'categorico' | 'ordinal' | 'rango' | 'fecha'; opciones?: readonly string[] })
  | (Base & { clave: ClaveNumerica; tipo: 'numerico'; unidad: '%' })
  | (Base & { clave: 'mejoras' | 'canales'; tipo: 'multivalor'; etiquetas: Readonly<Record<string, string>> })

const op = (k: keyof typeof OPCIONES_FORMULARIO): readonly string[] => OPCIONES_FORMULARIO[k] ?? []

export const CATALOGO: readonly CampoCatalogo[] = [
  // General
  { clave: 'proyecto', etiqueta: 'Convocatoria', grupo: 'general', tipo: 'categorico', capa: 'publica' },
  { clave: 'municipio_codigo', etiqueta: 'Municipio', grupo: 'general', tipo: 'categorico', capa: 'publica' },
  { clave: 'mes', etiqueta: 'Mes de la asesoría', grupo: 'general', tipo: 'fecha', capa: 'publica' },
  { clave: 'linea', etiqueta: 'Línea de crédito', grupo: 'general', tipo: 'categorico', opciones: LINEAS, capa: 'publica' },

  // Resultados
  { clave: 'satisfaction', etiqueta: 'Satisfacción', grupo: 'resultados', tipo: 'ordinal', opciones: op('satisfaction'), capa: 'publica' },
  { clave: 'results_as_expected', etiqueta: 'Resultados esperados', grupo: 'resultados', tipo: 'ordinal', opciones: op('resultsasexpected'), capa: 'publica' },
  { clave: 'time_to_results', etiqueta: 'Tiempo hasta ver resultados', grupo: 'resultados', tipo: 'ordinal', opciones: op('timetoresults'), capa: 'publica' },
  { clave: 'mejoras', etiqueta: 'Destino del crédito (mejoras logradas)', grupo: 'resultados', tipo: 'multivalor', etiquetas: MEJORAS, capa: 'publica' },

  // Crédito
  { clave: 'credit_used_as_approved', etiqueta: '¿Usó el crédito según lo aprobado?', grupo: 'credito', tipo: 'categorico', opciones: op('creditusedasapproved'), capa: 'publica' },
  { clave: 'payments_on_schedule', etiqueta: 'Pagos según cronograma', grupo: 'credito', tipo: 'categorico', opciones: op('paymentsonschedule'), capa: 'publica' },
  { clave: 'need_another_credit', etiqueta: '¿Necesita otro crédito?', grupo: 'credito', tipo: 'categorico', opciones: op('needanothercredit'), capa: 'publica' },
  { clave: 'credit_used_percentage', etiqueta: 'Crédito utilizado (%)', grupo: 'credito', tipo: 'numerico', unidad: '%', capa: 'publica' },
  { clave: 'debt_level', etiqueta: 'Nivel de endeudamiento (%)', grupo: 'credito', tipo: 'numerico', unidad: '%', capa: 'publica' },
  { clave: 'resource_manager', etiqueta: 'Quién administra los recursos', grupo: 'credito', tipo: 'categorico', opciones: op('resourcemanager'), capa: 'publica' },
  { clave: 'financial_records', etiqueta: '¿Lleva registros contables?', grupo: 'credito', tipo: 'categorico', opciones: op('financialRecords'), capa: 'publica' },

  // Finanzas (rangos: nunca montos exactos)
  { clave: 'rango_ingreso_mensual', etiqueta: 'Ingresos mensuales', grupo: 'finanzas', tipo: 'rango', opciones: RANGOS_MONTO, capa: 'publica' },
  { clave: 'rango_costos_fijos', etiqueta: 'Costos fijos', grupo: 'finanzas', tipo: 'rango', opciones: RANGOS_MONTO, capa: 'publica' },
  { clave: 'rango_costos_variables', etiqueta: 'Costos variables', grupo: 'finanzas', tipo: 'rango', opciones: RANGOS_MONTO, capa: 'publica' },
  { clave: 'rango_cuota_mensual', etiqueta: 'Cuota mensual del crédito', grupo: 'finanzas', tipo: 'rango', opciones: RANGOS_MONTO, capa: 'publica' },
  { clave: 'rango_reserva_emergencia', etiqueta: 'Reserva para imprevistos', grupo: 'finanzas', tipo: 'rango', opciones: RANGOS_MONTO, capa: 'publica' },

  // Ventas
  { clave: 'rango_ventas_total', etiqueta: 'Valor de las ventas por mes', grupo: 'ventas', tipo: 'rango', opciones: RANGOS_MONTO, capa: 'publica' },
  { clave: 'rango_clientes_mes', etiqueta: 'Clientes por mes', grupo: 'ventas', tipo: 'rango', opciones: RANGOS_CONTEO, capa: 'publica' },
  { clave: 'rango_ventas_mes', etiqueta: 'Ventas por mes (cantidad)', grupo: 'ventas', tipo: 'rango', opciones: RANGOS_CONTEO, capa: 'publica' },
  { clave: 'canales', etiqueta: 'Canales de venta', grupo: 'ventas', tipo: 'multivalor', etiquetas: CANALES, capa: 'publica' },

  // Empleo
  { clave: 'current_employees', etiqueta: 'Empleados actuales', grupo: 'empleo', tipo: 'ordinal', opciones: op('currentemployees'), capa: 'publica' },
]

export const GRUPOS: Readonly<Record<Grupo, string>> = {
  general: 'General',
  resultados: 'Resultados',
  credito: 'Crédito',
  finanzas: 'Finanzas',
  ventas: 'Ventas',
  empleo: 'Empleo',
}

export const GRAFICAS_POR_TIPO: Readonly<Record<TipoCampo, readonly Grafica[]>> = {
  categorico: ['barras', 'barras_horizontales', 'dona', 'tabla'],
  ordinal: ['barras', 'apilada_100', 'tabla'],
  rango: ['barras', 'tabla'],
  multivalor: ['barras_horizontales', 'tabla'],
  fecha: ['barras', 'tabla'],
  // histograma: distribución del campo; barras: medida (promedio, mediana…) por categoría de otro campo.
  numerico: ['histograma', 'barras', 'tabla'],
}

export const MEDIDAS_POR_TIPO: Readonly<Record<TipoCampo, readonly Medida[]>> = {
  categorico: ['conteo', 'porcentaje'],
  ordinal: ['conteo', 'porcentaje'],
  rango: ['conteo', 'porcentaje'],
  multivalor: ['conteo', 'porcentaje'],
  fecha: ['conteo'],
  numerico: ['promedio', 'mediana', 'minimo', 'maximo'],
}

export function buscarCampo(clave: string): CampoCatalogo | undefined {
  return CATALOGO.find((c) => c.clave === clave)
}

/** Campos por los que se puede desglosar o filtrar: los que tienen un conjunto finito de valores. */
export function esDiscreto(c: CampoCatalogo): boolean {
  return c.tipo !== 'numerico' && c.tipo !== 'multivalor'
}
