/** Fila tal como la devuelve vista_publica_asesorias (node-pg entrega bigint y numeric como texto). */
export interface FilaVista {
  asesoria_ref: string | number
  beneficiario_ref: string | number
  proyecto: string
  municipio_codigo: string | null
  mes: string
  credit_used_as_approved: string | null
  time_to_results: string | null
  results_as_expected: string | null
  financial_records: string | null
  resource_manager: string | null
  payments_on_schedule: string | null
  satisfaction: string | null
  need_another_credit: string | null
  current_employees: string | null
  rango_ingreso_mensual: string | null
  rango_costos_fijos: string | null
  rango_costos_variables: string | null
  rango_cuota_mensual: string | null
  rango_reserva_emergencia: string | null
  rango_ventas_total: string | null
  rango_clientes_mes: string | null
  rango_ventas_mes: string | null
  credit_used_percentage: string | number | null
  debt_level: string | number | null
  mejoras: string[]
  canales: string[]
  atipica: boolean
  /** 'Línea 1' | 'Línea 2'; null si la persona no está en el Excel de beneficiarios netos. */
  linea: string | null
}

export const METRICAS_AGREGADO = [
  'ingreso_mensual',
  'ventas_total',
  'costos_fijos',
  'costos_variables',
  'cuota_mensual',
  'reserva_emergencia',
] as const

export type Metrica = (typeof METRICAS_AGREGADO)[number]

/** Fila de vista_publica_agregados. */
export type FilaAgregadoVista = {
  proyecto: string
  municipio_codigo: string | null
  nivel: 'proyecto' | 'municipio'
  n_beneficiarios: string | number
  n_asesorias: string | number
} & Record<`promedio_${Metrica}` | `mediana_${Metrica}`, string | number | null>

export interface FilaDenominadorVista {
  proyecto: string
  total_beneficiarios: string | number
}

export interface FilaMetaVista {
  ultima_carga: Date | string | null
  asesorias_conservadas: string | number
  asesorias_descartadas: string | number
  beneficiarios_con_asesoria: string | number
  /** Formato del último TSV cargado ('v1' | 'v2'). Opcional por compatibilidad con cargas y pruebas anteriores. */
  ultimo_formato?: string | null
}

/** Fila pública: sin ids de base; id y beneficiario son aleatorios y cambian en cada generación. */
export type FilaPublica = Omit<FilaVista, 'asesoria_ref' | 'beneficiario_ref' | 'credit_used_percentage' | 'debt_level'> & {
  id: string
  beneficiario: string
  credit_used_percentage: number | null
  debt_level: number | null
}

export type AgregadoPublico = {
  proyecto: string
  municipio_codigo: string | null
  nivel: 'proyecto' | 'municipio'
  n_beneficiarios: number
  n_asesorias: number
} & Record<`promedio_${Metrica}` | `mediana_${Metrica}`, number | null>

export interface PublicoJson {
  version: 1
  generado_en: string
  /** Fecha de la última carga de datos (fecha de corte de los reportes). */
  fecha_corte: string | null
  /** De dónde sale el municipio: v1 usa la ciudad de residencia. */
  fuente_municipio: 'residencia' | 'empresa'
  totales: {
    asesorias_conservadas: number
    asesorias_descartadas: number
    beneficiarios_con_asesoria: number
  }
  denominadores: { proyecto: string; total_beneficiarios: number }[]
  asesorias: FilaPublica[]
  agregados: AgregadoPublico[]
}

/** Contenido cuando todavía no hay datos o la conexión no está configurada. */
export interface PublicoVacio {
  version: 1
  vacio: true
  motivo: string
  generado_en: string
}
