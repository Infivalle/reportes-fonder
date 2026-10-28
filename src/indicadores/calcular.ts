import { OPCIONES_FORMULARIO } from '../catalogo/opciones'
import type { FilaPublica, PublicoJson } from '../publico/tipos'
import { MUNICIPIOS_VALLE } from '../limpieza/municipios'
import { claveProyecto } from './proyectos'

/** Filtros globales. En F2 se agregan municipio y mes; el proyecto va primero. */
export interface Filtros {
  /** Clave de proyecto (ver claveProyecto) o null para todos. */
  proyecto: string | null
}

export const SIN_FILTROS: Filtros = { proyecto: null }

export interface ItemDistribucion {
  valor: string
  conteo: number
  /** 0 a 100, o null si no hay respuestas. */
  porcentaje: number | null
}

export interface Distribucion {
  /** Respuestas no nulas: es el denominador de los porcentajes. */
  n: number
  items: ItemDistribucion[]
}

export interface IndicadorProporcion {
  /** Porcentaje principal (0 a 100) o null si n = 0. */
  valor: number | null
  n: number
  distribucion: Distribucion
}

export interface IndicadorCobertura {
  atendidos: number
  /** Denominador cargado por el admin; null = "Sin dato". */
  total: number | null
  porcentaje: number | null
  /** Hay más atendidos que el total cargado: el denominador está desactualizado. */
  inconsistente: boolean
}

export interface IndicadorMunicipios {
  /** Municipios del Valle con al menos un beneficiario atendido (según el filtro). */
  visitados: number
  /** Municipios del Valle del Cauca (42). */
  total: number
  /** 0 a 100. */
  porcentaje: number
}

export interface IndicadorCredito {
  n: number
  mediana: number | null
  distribucion: Distribucion
}

export interface ResultadoIndicadores {
  /** Asesorías conservadas que pasan el filtro (todas, no solo la última por beneficiario). */
  asesorias: number
  /** Beneficiarios distintos que pasan el filtro. */
  beneficiarios: number
  cobertura: IndicadorCobertura
  municipios: IndicadorMunicipios
  satisfaccion: IndicadorProporcion
  resultados: IndicadorProporcion & { parcialmente: number | null; sinEvidenciar: number | null }
  pagos: IndicadorProporcion
  nuevoCredito: IndicadorProporcion
  creditoUtilizado: IndicadorCredito
  empleo: Distribucion
}

export function porcentaje(conteo: number, n: number): number | null {
  return n === 0 ? null : (conteo / n) * 100
}

export function mediana(valores: readonly number[]): number | null {
  if (valores.length === 0) return null
  const orden = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(orden.length / 2)
  return orden.length % 2 === 1 ? orden[medio]! : (orden[medio - 1]! + orden[medio]!) / 2
}

/** Aplica los filtros globales. */
export function aplicarFiltros(filas: readonly FilaPublica[], filtros: Filtros): FilaPublica[] {
  return filas.filter((f) => filtros.proyecto === null || claveProyecto(f.proyecto) === filtros.proyecto)
}

/**
 * Indicadores "por beneficiario": si alguien tiene más de una asesoría conservada se usa la más
 * reciente (mes mayor; si empatan, el id mayor, solo para que el resultado sea determinista).
 */
export function ultimaPorBeneficiario(filas: readonly FilaPublica[]): FilaPublica[] {
  const mejor = new Map<string, FilaPublica>()
  for (const f of filas) {
    const actual = mejor.get(f.beneficiario)
    if (!actual || f.mes > actual.mes || (f.mes === actual.mes && f.id > actual.id)) {
      mejor.set(f.beneficiario, f)
    }
  }
  return [...mejor.values()]
}

/**
 * Cuenta las respuestas no nulas de un campo categórico en el orden del catálogo. Un valor que no
 * esté en el catálogo no se pierde: se agrega al final para que la suma siempre cuadre.
 */
export function contarCategorias(
  valores: readonly (string | null)[],
  opciones: readonly string[],
): Distribucion {
  const conteos = new Map<string, number>(opciones.map((o) => [o, 0]))
  let n = 0
  for (const v of valores) {
    if (v === null || v === '') continue
    n += 1
    conteos.set(v, (conteos.get(v) ?? 0) + 1)
  }
  const items = [...conteos.entries()].map(([valor, conteo]) => ({
    valor,
    conteo,
    porcentaje: porcentaje(conteo, n),
  }))
  return { n, items }
}

function conteoDe(d: Distribucion, valor: string): number {
  return d.items.find((i) => i.valor === valor)?.conteo ?? 0
}

function proporcion(d: Distribucion, favorables: readonly string[]): IndicadorProporcion {
  const suma = favorables.reduce((acc, v) => acc + conteoDe(d, v), 0)
  return { valor: porcentaje(suma, d.n), n: d.n, distribucion: d }
}

/** Tramos del % de crédito utilizado. El último solo aparece si hay valores sobre 100. */
const TRAMOS_CREDITO = [
  { etiqueta: '0 a 25 %', max: 25 },
  { etiqueta: '25 a 50 %', max: 50 },
  { etiqueta: '50 a 75 %', max: 75 },
  { etiqueta: '75 a 100 %', max: 100 },
] as const
const TRAMO_SOBRE_100 = 'Más de 100 %'

export function indicadorCredito(valores: readonly (number | null)[]): IndicadorCredito {
  const validos = valores.filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0)
  const conteos = TRAMOS_CREDITO.map(() => 0)
  let sobre100 = 0
  for (const v of validos) {
    if (v > 100) {
      sobre100 += 1
      continue
    }
    // Límite superior inclusivo salvo el primero que arranca en 0: 25 cae en "0 a 25 %".
    const i = TRAMOS_CREDITO.findIndex((t) => v <= t.max)
    conteos[i] = (conteos[i] ?? 0) + 1
  }
  const n = validos.length
  const items: ItemDistribucion[] = TRAMOS_CREDITO.map((t, i) => ({
    valor: t.etiqueta,
    conteo: conteos[i] ?? 0,
    porcentaje: porcentaje(conteos[i] ?? 0, n),
  }))
  if (sobre100 > 0) items.push({ valor: TRAMO_SOBRE_100, conteo: sobre100, porcentaje: porcentaje(sobre100, n) })
  return { n, mediana: mediana(validos), distribucion: { n, items } }
}

/**
 * Denominador de cobertura para el filtro actual.
 * - Con un proyecto: su total cargado, o null si no hay.
 * - Sin filtro: la suma de los totales, pero solo si todos los proyectos con asesorías tienen uno;
 *   si falta alguno, null (mejor "Sin dato" que un porcentaje inflado).
 */
export function denominadorCobertura(
  denominadores: PublicoJson['denominadores'],
  proyectosPresentes: readonly string[],
): number | null {
  const porClave = new Map<string, number>()
  for (const d of denominadores) porClave.set(claveProyecto(d.proyecto), d.total_beneficiarios)
  const claves = [...new Set(proyectosPresentes.map(claveProyecto))]
  if (claves.length === 0) return null
  let total = 0
  for (const c of claves) {
    const t = porClave.get(c)
    if (t === undefined) return null
    total += t
  }
  return total > 0 ? total : null
}

/** Cuenta municipios distintos del Valle presentes en las filas; los códigos nulos o ajenos no cuentan. */
export function indicadorMunicipios(filas: readonly FilaPublica[]): IndicadorMunicipios {
  const validos = new Set(MUNICIPIOS_VALLE.map((m) => m.codigo))
  const vistos = new Set<string>()
  for (const f of filas) {
    if (f.municipio_codigo !== null && validos.has(f.municipio_codigo)) vistos.add(f.municipio_codigo)
  }
  const total = validos.size
  return { visitados: vistos.size, total, porcentaje: (vistos.size / total) * 100 }
}

export function calcularIndicadores(publico: PublicoJson, filtros: Filtros): ResultadoIndicadores {
  const filas = aplicarFiltros(publico.asesorias, filtros)
  const porBeneficiario = ultimaPorBeneficiario(filas)

  const atendidos = porBeneficiario.length
  const total = denominadorCobertura(
    publico.denominadores,
    // Con filtro se busca su denominador aunque aún no tenga asesorías ("0 de 1.300").
    filtros.proyecto === null ? filas.map((f) => f.proyecto) : [filtros.proyecto],
  )
  const cobertura: IndicadorCobertura = {
    atendidos,
    total,
    porcentaje: total === null ? null : porcentaje(atendidos, total),
    inconsistente: total !== null && atendidos > total,
  }

  const satisfaccion = proporcion(
    contarCategorias(
      porBeneficiario.map((f) => f.satisfaction),
      OPCIONES_FORMULARIO.satisfaction!,
    ),
    ['Muy satisfecho', 'Satisfecho'],
  )

  const distResultados = contarCategorias(
    porBeneficiario.map((f) => f.results_as_expected),
    OPCIONES_FORMULARIO.resultsasexpected!,
  )
  const resultados = {
    ...proporcion(distResultados, ['Sí']),
    parcialmente: porcentaje(conteoDe(distResultados, 'Parcialmente'), distResultados.n),
    sinEvidenciar: porcentaje(conteoDe(distResultados, 'Todavía no se ha evidenciado'), distResultados.n),
  }

  const pagos = proporcion(
    contarCategorias(
      porBeneficiario.map((f) => f.payments_on_schedule),
      OPCIONES_FORMULARIO.paymentsonschedule!,
    ),
    ['Sí'],
  )

  const nuevoCredito = proporcion(
    contarCategorias(
      porBeneficiario.map((f) => f.need_another_credit),
      OPCIONES_FORMULARIO.needanothercredit!,
    ),
    ['Sí'],
  )

  const creditoUtilizado = indicadorCredito(porBeneficiario.map((f) => f.credit_used_percentage))

  const empleo = contarCategorias(
    porBeneficiario.map((f) => f.current_employees),
    OPCIONES_FORMULARIO.currentemployees!,
  )

  return {
    asesorias: filas.length,
    beneficiarios: atendidos,
    cobertura,
    municipios: indicadorMunicipios(filas),
    satisfaccion,
    resultados,
    pagos,
    nuevoCredito,
    creditoUtilizado,
    empleo,
  }
}
