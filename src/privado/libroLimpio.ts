/**
 * Libro Excel de la data limpia completa (capa privada): una fila por asesoría conservada con las
 * respuestas del formulario, más mejoras, canales, descartadas con su motivo, diccionario de
 * columnas y metadatos de la carga.
 *
 * Lleva datos personales y financieros: solo la descarga el admin y cada descarga queda en bitácora.
 * No incluye los archivos de evidencia (`evidence_file`, `evidence_visit_file`).
 */
import ExcelJS from 'exceljs'
import { MUNICIPIOS_VALLE } from '../limpieza/municipios'
import { estiloEncabezado } from './libroCruce'
import type { CargaDb } from './datosPrivados'

export interface BeneficiarioDb {
  id: number
  documento: string
  nombres: string | null
  apellidos: string | null
  email: string | null
  celular: string | null
  departamento: string | null
  ciudad: string | null
  nombre_empresa: string | null
  nit: string | null
  actividad_economica: string | null
  municipio_codigo: string | null
  municipio_origen: string
  municipio_empresa: string | null
  tipo_empresa: string | null
  anio_fundacion: number | null
  empleos_generados: string | null
  empleos_a_generar: string | null
  patrimonio: number | null
  pasivos: number | null
  dinero_solicitado: number | null
  cuotas: number | null
}

export interface AsesoriaDb {
  id: number
  beneficiario_id: number
  credit_used_as_approved: string | null
  credit_usage_description: string | null
  other_improvement: string | null
  time_to_results: string | null
  results_as_expected: string | null
  results_explanation: string | null
  financial_records: string | null
  resource_manager: string | null
  other_resource_manager: string | null
  payments_on_schedule: string | null
  payment_explanation: string | null
  satisfaction: string | null
  need_another_credit: string | null
  credit_intended_use: string | null
  monthly_income: number | null
  fixed_costs: number | null
  variable_costs: number | null
  debt_level: number | null
  credit_used_percentage: number | null
  monthly_payment: number | null
  emergency_reserve: number | null
  monthly_clients: number | null
  monthly_sales: number | null
  total_sales_value: number | null
  current_employees: string | null
  other_sales_channel: string | null
  estado: string | null
  observaciones: string | null
  creada_en: string
  actualizada_en: string | null
  conservada: boolean
  motivo_descarte: string | null
  atipica: boolean
}

export interface CodigoDb {
  asesoria_id: number
  codigo: string
}

export interface DatosLimpios {
  beneficiarios: BeneficiarioDb[]
  asesorias: AsesoriaDb[]
  mejoras: CodigoDb[]
  canales: CodigoDb[]
  /** beneficiario_id → nombres de proyecto. */
  proyectos: Map<number, string[]>
  carga: CargaDb | null
}

// Etiquetas de los códigos (iguales a src/catalogo/codigos.ts). AM, TE, VC y PT siguen por confirmar con InfiValle.
export const MEJORAS: Readonly<Record<string, string>> = {
  AI: 'Aumento de ingresos',
  AA: 'Adquisición de activos',
  AM: 'Mejora en infraestructura',
  CT: 'Capital de trabajo',
  GE: 'Generación de empleo',
  O: 'Otras',
}
export const CANALES: Readonly<Record<string, string>> = {
  TF: 'Tienda física',
  RS: 'Redes sociales',
  VC: 'Venta por catálogo',
  TE: 'Tienda en línea / e-commerce',
  PT: 'Plataformas de terceros',
  O: 'Otros',
}

type Tipo = 'texto' | 'entero' | 'moneda' | 'decimal'
interface Fila {
  a: AsesoriaDb
  b: BeneficiarioDb
  proyectos: string
  mejoras: string
  canales: string
}
interface Columna {
  titulo: string
  ancho: number
  tipo: Tipo
  /** De dónde sale, para el diccionario. */
  origen: string
  valor: (f: Fila) => string | number | null
}

const NOMBRE_MUNICIPIO = new Map(MUNICIPIOS_VALLE.map((m) => [m.codigo, m.nombre]))
const ORIGEN_MUNICIPIO: Readonly<Record<string, string>> = { empresa: 'Empresa', residencia: 'Residencia', sin_ubicar: 'Sin ubicar' }

const vacio = (t: string | null | undefined): string | null => (t === null || t === undefined || t.trim() === '' ? null : t)
const siNo = (v: boolean): string => (v ? 'Sí' : 'No')

/** 'AAAA-MM-DD HH:mm:ss' del ISO, desplazado `horas` (0 = UTC, -5 = Colombia). */
export function fechaTexto(iso: string | null, horas: number): string | null {
  if (iso === null) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : new Date(t + horas * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

export const COLUMNAS_ASESORIA: readonly Columna[] = [
  { titulo: 'ID asesoría', ancho: 12, tipo: 'entero', origen: 'asesorias.id', valor: (f) => f.a.id },
  { titulo: 'Fecha asesoría (UTC)', ancho: 20, tipo: 'texto', origen: 'asesorias.creada_en', valor: (f) => fechaTexto(f.a.creada_en, 0) },
  { titulo: 'Fecha asesoría (hora Colombia)', ancho: 22, tipo: 'texto', origen: 'asesorias.creada_en − 5 h', valor: (f) => fechaTexto(f.a.creada_en, -5) },
  { titulo: 'Documento', ancho: 14, tipo: 'texto', origen: 'beneficiarios.documento', valor: (f) => f.b.documento },
  { titulo: 'Nombres', ancho: 22, tipo: 'texto', origen: 'beneficiarios.nombres', valor: (f) => vacio(f.b.nombres) },
  { titulo: 'Apellidos', ancho: 22, tipo: 'texto', origen: 'beneficiarios.apellidos', valor: (f) => vacio(f.b.apellidos) },
  { titulo: 'Correo', ancho: 28, tipo: 'texto', origen: 'beneficiarios.email', valor: (f) => vacio(f.b.email) },
  { titulo: 'Celular', ancho: 14, tipo: 'texto', origen: 'beneficiarios.celular', valor: (f) => vacio(f.b.celular) },
  { titulo: 'Convocatoria', ancho: 32, tipo: 'texto', origen: 'proyectos.nombre', valor: (f) => vacio(f.proyectos) },
  { titulo: 'Departamento (residencia)', ancho: 18, tipo: 'texto', origen: 'beneficiarios.departamento', valor: (f) => vacio(f.b.departamento) },
  { titulo: 'Ciudad (residencia)', ancho: 18, tipo: 'texto', origen: 'beneficiarios.ciudad', valor: (f) => vacio(f.b.ciudad) },
  { titulo: 'Código municipio (DIVIPOLA)', ancho: 14, tipo: 'texto', origen: 'beneficiarios.municipio_codigo', valor: (f) => vacio(f.b.municipio_codigo) },
  {
    titulo: 'Municipio',
    ancho: 18,
    tipo: 'texto',
    origen: 'DIVIPOLA → nombre',
    valor: (f) => (f.b.municipio_codigo === null ? 'Sin ubicar' : (NOMBRE_MUNICIPIO.get(f.b.municipio_codigo) ?? f.b.municipio_codigo)),
  },
  { titulo: 'Origen del municipio', ancho: 14, tipo: 'texto', origen: 'beneficiarios.municipio_origen', valor: (f) => ORIGEN_MUNICIPIO[f.b.municipio_origen] ?? f.b.municipio_origen },
  { titulo: 'Municipio de la empresa (original)', ancho: 22, tipo: 'texto', origen: 'beneficiarios.municipio_empresa', valor: (f) => vacio(f.b.municipio_empresa) },
  { titulo: 'Empresa', ancho: 28, tipo: 'texto', origen: 'beneficiarios.nombre_empresa', valor: (f) => vacio(f.b.nombre_empresa) },
  { titulo: 'NIT', ancho: 14, tipo: 'texto', origen: 'beneficiarios.nit', valor: (f) => vacio(f.b.nit) },
  { titulo: 'Actividad económica', ancho: 28, tipo: 'texto', origen: 'beneficiarios.actividad_economica', valor: (f) => vacio(f.b.actividad_economica) },
  { titulo: 'Tipo de empresa', ancho: 18, tipo: 'texto', origen: 'beneficiarios.tipo_empresa', valor: (f) => vacio(f.b.tipo_empresa) },
  { titulo: 'Año de fundación', ancho: 10, tipo: 'entero', origen: 'beneficiarios.anio_fundacion', valor: (f) => f.b.anio_fundacion },
  { titulo: 'Empleos generados', ancho: 18, tipo: 'texto', origen: 'beneficiarios.empleos_generados', valor: (f) => vacio(f.b.empleos_generados) },
  { titulo: 'Empleos a generar', ancho: 22, tipo: 'texto', origen: 'beneficiarios.empleos_a_generar', valor: (f) => vacio(f.b.empleos_a_generar) },
  { titulo: 'Patrimonio (COP)', ancho: 16, tipo: 'moneda', origen: 'beneficiarios.patrimonio', valor: (f) => f.b.patrimonio },
  { titulo: 'Pasivos (COP)', ancho: 16, tipo: 'moneda', origen: 'beneficiarios.pasivos', valor: (f) => f.b.pasivos },
  { titulo: 'Dinero solicitado (COP)', ancho: 18, tipo: 'moneda', origen: 'beneficiarios.dinero_solicitado', valor: (f) => f.b.dinero_solicitado },
  { titulo: 'Cuotas', ancho: 12, tipo: 'moneda', origen: 'beneficiarios.cuotas', valor: (f) => f.b.cuotas },
  { titulo: '¿Crédito usado conforme al destino?', ancho: 20, tipo: 'texto', origen: 'asesorias.credit_used_as_approved', valor: (f) => vacio(f.a.credit_used_as_approved) },
  { titulo: 'Descripción del uso del crédito', ancho: 40, tipo: 'texto', origen: 'asesorias.credit_usage_description', valor: (f) => vacio(f.a.credit_usage_description) },
  { titulo: 'Mejoras logradas', ancho: 36, tipo: 'texto', origen: 'asesoria_mejoras (códigos → etiqueta)', valor: (f) => vacio(f.mejoras) },
  { titulo: 'Otra mejora', ancho: 28, tipo: 'texto', origen: 'asesorias.other_improvement', valor: (f) => vacio(f.a.other_improvement) },
  { titulo: 'Tiempo hasta evidenciar resultados', ancho: 24, tipo: 'texto', origen: 'asesorias.time_to_results', valor: (f) => vacio(f.a.time_to_results) },
  { titulo: '¿Resultados esperados?', ancho: 20, tipo: 'texto', origen: 'asesorias.results_as_expected', valor: (f) => vacio(f.a.results_as_expected) },
  { titulo: 'Explicación de resultados', ancho: 40, tipo: 'texto', origen: 'asesorias.results_explanation', valor: (f) => vacio(f.a.results_explanation) },
  { titulo: '¿Lleva registros contables?', ancho: 16, tipo: 'texto', origen: 'asesorias.financial_records', valor: (f) => vacio(f.a.financial_records) },
  { titulo: '¿Quién administra los recursos?', ancho: 20, tipo: 'texto', origen: 'asesorias.resource_manager', valor: (f) => vacio(f.a.resource_manager) },
  { titulo: 'Otro administrador de recursos', ancho: 24, tipo: 'texto', origen: 'asesorias.other_resource_manager', valor: (f) => vacio(f.a.other_resource_manager) },
  { titulo: '¿Pagos según cronograma?', ancho: 16, tipo: 'texto', origen: 'asesorias.payments_on_schedule', valor: (f) => vacio(f.a.payments_on_schedule) },
  { titulo: 'Explicación de pagos', ancho: 36, tipo: 'texto', origen: 'asesorias.payment_explanation', valor: (f) => vacio(f.a.payment_explanation) },
  { titulo: 'Satisfacción', ancho: 16, tipo: 'texto', origen: 'asesorias.satisfaction', valor: (f) => vacio(f.a.satisfaction) },
  { titulo: '¿Necesita otro crédito?', ancho: 14, tipo: 'texto', origen: 'asesorias.need_another_credit', valor: (f) => vacio(f.a.need_another_credit) },
  { titulo: 'Uso previsto del nuevo crédito', ancho: 32, tipo: 'texto', origen: 'asesorias.credit_intended_use', valor: (f) => vacio(f.a.credit_intended_use) },
  { titulo: 'Ingresos mensuales (COP)', ancho: 18, tipo: 'moneda', origen: 'asesorias.monthly_income', valor: (f) => f.a.monthly_income },
  { titulo: 'Costos fijos (COP)', ancho: 16, tipo: 'moneda', origen: 'asesorias.fixed_costs', valor: (f) => f.a.fixed_costs },
  { titulo: 'Costos variables (COP)', ancho: 18, tipo: 'moneda', origen: 'asesorias.variable_costs', valor: (f) => f.a.variable_costs },
  { titulo: 'Nivel de endeudamiento (%)', ancho: 14, tipo: 'decimal', origen: 'asesorias.debt_level', valor: (f) => f.a.debt_level },
  { titulo: 'Crédito utilizado (%)', ancho: 14, tipo: 'decimal', origen: 'asesorias.credit_used_percentage', valor: (f) => f.a.credit_used_percentage },
  { titulo: 'Pago mensual del crédito (COP)', ancho: 18, tipo: 'moneda', origen: 'asesorias.monthly_payment', valor: (f) => f.a.monthly_payment },
  { titulo: 'Reserva para imprevistos (COP)', ancho: 18, tipo: 'moneda', origen: 'asesorias.emergency_reserve', valor: (f) => f.a.emergency_reserve },
  { titulo: 'Clientes al mes', ancho: 12, tipo: 'entero', origen: 'asesorias.monthly_clients', valor: (f) => f.a.monthly_clients },
  { titulo: 'Ventas al mes', ancho: 12, tipo: 'entero', origen: 'asesorias.monthly_sales', valor: (f) => f.a.monthly_sales },
  { titulo: 'Valor de ventas actuales al mes (COP)', ancho: 20, tipo: 'moneda', origen: 'asesorias.total_sales_value', valor: (f) => f.a.total_sales_value },
  { titulo: 'Empleados actuales', ancho: 14, tipo: 'texto', origen: 'asesorias.current_employees', valor: (f) => vacio(f.a.current_employees) },
  { titulo: 'Canales de venta', ancho: 36, tipo: 'texto', origen: 'asesoria_canales (códigos → etiqueta)', valor: (f) => vacio(f.canales) },
  { titulo: 'Otro canal de venta', ancho: 24, tipo: 'texto', origen: 'asesorias.other_sales_channel', valor: (f) => vacio(f.a.other_sales_channel) },
  { titulo: 'Estado', ancho: 12, tipo: 'texto', origen: 'asesorias.estado', valor: (f) => vacio(f.a.estado) },
  { titulo: 'Observaciones', ancho: 40, tipo: 'texto', origen: 'asesorias.observaciones', valor: (f) => vacio(f.a.observaciones) },
  { titulo: 'Monto atípico', ancho: 10, tipo: 'texto', origen: 'asesorias.atipica (marcado, no corregido)', valor: (f) => siNo(f.a.atipica) },
]

const FORMATO: Readonly<Record<Tipo, string | undefined>> = { texto: undefined, entero: '0', moneda: '#,##0', decimal: '0.00' }

function etiquetas(codigos: readonly string[], catalogo: Readonly<Record<string, string>>): string {
  return [...codigos].sort().map((c) => catalogo[c] ?? c).join(', ')
}

function agruparCodigos(filas: readonly CodigoDb[]): Map<number, string[]> {
  const m = new Map<number, string[]>()
  for (const f of filas) m.set(f.asesoria_id, [...(m.get(f.asesoria_id) ?? []), f.codigo])
  return m
}

function nombreCompleto(b: BeneficiarioDb): string {
  return `${b.nombres ?? ''} ${b.apellidos ?? ''}`.replace(/\s+/g, ' ').trim()
}

export interface MetaLimpia {
  generadoPor: string
  generadoEn: Date
}

export function construirLibroLimpio(d: DatosLimpios, meta: MetaLimpia): ExcelJS.Workbook {
  const benef = new Map(d.beneficiarios.map((b) => [b.id, b]))
  const mejorasPor = agruparCodigos(d.mejoras)
  const canalesPor = agruparCodigos(d.canales)
  const ordenadas = [...d.asesorias].sort((x, y) => x.creada_en.localeCompare(y.creada_en) || x.id - y.id)
  const conservadas = ordenadas.filter((a) => a.conservada)
  const descartadas = ordenadas.filter((a) => !a.conservada)

  const libro = new ExcelJS.Workbook()
  libro.creator = 'Dashboard de asesorías Fonder Valle'

  const hojaTabla = (nombre: string, titulos: readonly string[], anchos: readonly number[]): ExcelJS.Worksheet => {
    const h = libro.addWorksheet(nombre)
    anchos.forEach((w, i) => {
      h.getColumn(i + 1).width = w
    })
    h.addRow([...titulos])
    estiloEncabezado(h.getRow(1))
    h.views = [{ state: 'frozen', ySplit: 1 }]
    return h
  }
  const filtro = (h: ExcelJS.Worksheet, columnas: number): void => {
    h.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, h.rowCount), column: columnas } }
  }

  // 1. Asesorías conservadas
  const h1 = hojaTabla('Asesorías conservadas', COLUMNAS_ASESORIA.map((c) => c.titulo), COLUMNAS_ASESORIA.map((c) => c.ancho))
  let omitidas = 0
  for (const a of conservadas) {
    const b = benef.get(a.beneficiario_id)
    if (b === undefined) {
      omitidas += 1
      continue
    }
    const fila: Fila = {
      a,
      b,
      proyectos: (d.proyectos.get(b.id) ?? []).join(', '),
      mejoras: etiquetas(mejorasPor.get(a.id) ?? [], MEJORAS),
      canales: etiquetas(canalesPor.get(a.id) ?? [], CANALES),
    }
    h1.addRow(COLUMNAS_ASESORIA.map((c) => c.valor(fila)))
  }
  COLUMNAS_ASESORIA.forEach((c, i) => {
    const fmt = FORMATO[c.tipo]
    if (fmt !== undefined) h1.getColumn(i + 1).numFmt = fmt
  })
  filtro(h1, COLUMNAS_ASESORIA.length)

  // 2 y 3. Mejoras y canales (una fila por asesoría conservada y código)
  const idsConservadas = new Set(conservadas.map((a) => a.id))
  const docDe = (asesoriaId: number): string => {
    const a = d.asesorias.find((x) => x.id === asesoriaId)
    return a === undefined ? '' : (benef.get(a.beneficiario_id)?.documento ?? '')
  }
  const puente = (nombre: string, filas: readonly CodigoDb[], catalogo: Readonly<Record<string, string>>): number => {
    const h = hojaTabla(nombre, ['ID asesoría', 'Documento', 'Código', 'Etiqueta'], [12, 14, 10, 34])
    const indice = new Map(d.asesorias.map((a) => [a.id, a]))
    let n = 0
    for (const f of [...filas].sort((x, y) => x.asesoria_id - y.asesoria_id || x.codigo.localeCompare(y.codigo))) {
      if (!idsConservadas.has(f.asesoria_id)) continue
      const a = indice.get(f.asesoria_id)
      h.addRow([f.asesoria_id, a === undefined ? docDe(f.asesoria_id) : (benef.get(a.beneficiario_id)?.documento ?? ''), f.codigo, catalogo[f.codigo] ?? f.codigo])
      n += 1
    }
    filtro(h, 4)
    return n
  }
  const nMejoras = puente('Mejoras', d.mejoras, MEJORAS)
  const nCanales = puente('Canales de venta', d.canales, CANALES)

  // 4. Descartadas
  const h4 = hojaTabla('Descartadas', ['ID asesoría', 'Documento', 'Nombre', 'Fecha asesoría (UTC)', 'Motivo del descarte', 'Convocatoria'], [12, 14, 30, 20, 50, 32])
  for (const a of descartadas) {
    const b = benef.get(a.beneficiario_id)
    h4.addRow([a.id, b?.documento ?? '', b === undefined ? null : vacio(nombreCompleto(b)), fechaTexto(a.creada_en, 0), vacio(a.motivo_descarte), vacio((b === undefined ? [] : (d.proyectos.get(b.id) ?? [])).join(', '))])
  }
  filtro(h4, 6)

  // 5. Diccionario
  const h5 = hojaTabla('Diccionario de campos', ['Hoja', 'Columna', 'Origen en la base'], [26, 40, 46])
  for (const c of COLUMNAS_ASESORIA) h5.addRow(['Asesorías conservadas', c.titulo, c.origen])
  h5.addRow(['Mejoras / Canales de venta', 'Código y etiqueta', 'asesoria_mejoras / asesoria_canales; etiquetas del catálogo del formulario'])
  h5.addRow(['Descartadas', 'Motivo del descarte', 'asesorias.motivo_descarte (duplicado a menos de 30 días de la asesoría conservada)'])
  filtro(h5, 3)

  // 6. Metadatos
  const h6 = libro.addWorksheet('Metadatos')
  h6.getColumn(1).width = 36
  h6.getColumn(2).width = 70
  const c = d.carga
  const lineas: [string, string | number][] = [
    ['Generado el (hora Colombia)', fechaTexto(meta.generadoEn.toISOString(), -5) ?? ''],
    ['Generado por', meta.generadoPor],
    ['Última carga: id', c?.id ?? 'Sin cargas'],
    ['Última carga: archivo', c?.archivo ?? ''],
    ['Última carga: formato', c?.formato ?? ''],
    ['Última carga: fecha (hora Colombia)', c === null || c === undefined ? '' : (fechaTexto(c.creada_en, -5) ?? '')],
    ['Última carga: filas leídas', c?.filas_leidas ?? ''],
    ['Última carga: asesorías conservadas', c?.asesorias_conservadas ?? ''],
    ['Última carga: asesorías descartadas', c?.asesorias_descartadas ?? ''],
    ['Última carga: beneficiarios distintos', c?.beneficiarios_distintos ?? ''],
    ['Filas en "Asesorías conservadas"', h1.rowCount - 1],
    ['Filas en "Mejoras"', nMejoras],
    ['Filas en "Canales de venta"', nCanales],
    ['Filas en "Descartadas"', descartadas.length],
    ['Hora de las fechas', 'Las columnas "(UTC)" están en UTC; restar 5 horas da la hora de Colombia (pendiente de confirmar con una asesoría de hora conocida).'],
    ['Campos no incluidos', 'Archivos de evidencia. Nunca se almacenan usuario ni contraseña.'],
    ['Datos personales', 'Contiene cédula, nombres, contacto y datos financieros. Aplicar la política de tratamiento de datos de la entidad: no subir a repositorios ni a carpetas compartidas sin control de acceso.'],
  ]
  if (omitidas > 0) lineas.push(['Advertencia', `${omitidas} asesorías conservadas no se incluyeron porque su beneficiario no se pudo leer.`])
  for (const [k, v] of lineas) h6.addRow([k, v])
  h6.getColumn(1).font = { bold: true }
  h6.getColumn(2).alignment = { wrapText: true, vertical: 'top' }

  return libro
}
