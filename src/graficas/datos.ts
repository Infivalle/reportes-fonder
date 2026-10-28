/**
 * Datos de una gráfica del constructor: filas ya filtradas + definición → categorías, series y
 * textos listos para dibujar y para la tabla alternativa. No depende de React ni de ECharts.
 *
 * Reglas de protección: con desglose, una celda de 1 a 4 beneficiarios no se muestra ("<5"), y el
 * porcentaje de un grupo con menos de 5 respuestas tampoco (revelaría el conteo). Una distribución
 * de un solo campo no se suprime: es la misma que ya muestran los indicadores.
 */
import { buscarCampo, type CampoCatalogo } from '../catalogo/campos'
import { ultimaPorBeneficiario } from '../indicadores/calcular'
import { etiquetaCategoria, MINIMO_CELDA, ordenarCategorias, valoresDe } from '../indicadores/consulta'
import { formatoEntero, formatoPorcentaje } from '../indicadores/formato'
import type { FilaPublica } from '../publico/tipos'
import type { GraficaDef } from './definicion'

export interface CeldaGrafica {
  /** null = no se dibuja (suprimida o sin dato). */
  valor: number | null
  /** Texto para la tabla y las etiquetas: "12", "34,5 %", "<5" o "Sin dato". */
  texto: string
}

export interface SerieGrafica {
  nombre: string
  celdas: CeldaGrafica[]
}

export interface DatosGrafica {
  titulo: string
  categorias: string[]
  series: SerieGrafica[]
  /** Unidad de los valores: beneficiarios (conteo) o porcentaje. */
  unidad: 'conteo' | 'porcentaje'
  /** Beneficiarios con respuesta en el campo (base de los porcentajes). */
  base: number
  /** Beneficiarios en el filtro, hayan respondido o no. */
  total: number
  /** Promedio, mediana, mínimo y máximo (solo campos numéricos sin desglose). */
  resumen: { n: number; promedio: number | null; mediana: number | null; minimo: number | null; maximo: number | null } | null
  avisos: string[]
}

const SUPRIMIDA: CeldaGrafica = { valor: null, texto: `<${MINIMO_CELDA}` }
const SIN_DATO: CeldaGrafica = { valor: null, texto: 'Sin dato' }

const celdaConteo = (n: number): CeldaGrafica => ({ valor: n, texto: formatoEntero(n) })
const celdaPct = (p: number | null): CeldaGrafica => (p === null ? SIN_DATO : { valor: p, texto: formatoPorcentaje(p) })

function titulo(campo: CampoCatalogo, desglose: CampoCatalogo | undefined): string {
  return desglose ? `${campo.etiqueta} por ${desglose.etiqueta.toLowerCase()}` : campo.etiqueta
}

/** Tramos del histograma de un campo en porcentaje: de 20 en 20, límite superior inclusivo. */
const TRAMOS = [20, 40, 60, 80, 100] as const
const ETIQUETAS_TRAMOS = ['0 a 20 %', '20 a 40 %', '40 a 60 %', '60 a 80 %', '80 a 100 %'] as const
const SOBRE_100 = 'Más de 100 %'

function resumir(xs: readonly number[]): NonNullable<DatosGrafica['resumen']> {
  if (xs.length === 0) return { n: 0, promedio: null, mediana: null, minimo: null, maximo: null }
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return {
    n: o.length,
    promedio: o.reduce((s, x) => s + x, 0) / o.length,
    mediana: o.length % 2 ? (o[m] as number) : ((o[m - 1] as number) + (o[m] as number)) / 2,
    minimo: o[0] as number,
    maximo: o[o.length - 1] as number,
  }
}

function medidaNumerica(r: ReturnType<typeof resumir>, medida: GraficaDef['medida']): number | null {
  switch (medida) {
    case 'mediana':
      return r.mediana
    case 'minimo':
      return r.minimo
    case 'maximo':
      return r.maximo
    default:
      return r.promedio
  }
}

const NOMBRE_MEDIDA: Record<string, string> = {
  promedio: 'Promedio',
  mediana: 'Mediana',
  minimo: 'Mínimo',
  maximo: 'Máximo',
}

function numerico(filas: readonly FilaPublica[], def: GraficaDef, campo: CampoCatalogo, desglose: CampoCatalogo | undefined): DatosGrafica {
  if (campo.tipo !== 'numerico') throw new Error('Campo no numérico')
  const base = ultimaPorBeneficiario(filas)
  const lectura = (f: FilaPublica): number | null => {
    const v = f[campo.clave]
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
  }
  const todos = base.map(lectura).filter((v): v is number => v !== null)
  const avisos: string[] = []

  // Histograma (o tabla sin desglose): cuántos beneficiarios hay en cada tramo.
  if (def.grafica === 'histograma' || (def.grafica === 'tabla' && !desglose)) {
    const conteos = TRAMOS.map(() => 0)
    let sobre = 0
    for (const v of todos) {
      if (v > 100) sobre += 1
      else conteos[TRAMOS.findIndex((t) => v <= t)]! += 1
    }
    const categorias: string[] = [...ETIQUETAS_TRAMOS]
    const celdas = conteos.map(celdaConteo)
    if (sobre > 0) {
      categorias.push(SOBRE_100)
      celdas.push(celdaConteo(sobre))
    }
    return {
      titulo: titulo(campo, undefined),
      categorias,
      series: [{ nombre: 'Beneficiarios', celdas }],
      unidad: 'conteo',
      base: todos.length,
      total: base.length,
      resumen: resumir(todos),
      avisos,
    }
  }

  // Medida del campo numérico por cada categoría de otro campo.
  if (!desglose) {
    avisos.push('Elija un campo para comparar: la medida se calcula por cada categoría de ese campo.')
    return { titulo: titulo(campo, undefined), categorias: [], series: [], unidad: 'porcentaje', base: todos.length, total: base.length, resumen: null, avisos }
  }
  const grupos = new Map<string, number[]>()
  for (const f of base) {
    const v = lectura(f)
    if (v === null) continue
    for (const g of valoresDe(f, desglose)) grupos.set(g, [...(grupos.get(g) ?? []), v])
  }
  const orden = ordenarCategorias(desglose, new Map([...grupos].map(([g, xs]) => [g, xs.length])))
  let suprimidos = 0
  const celdas = orden.map((g) => {
    const xs = grupos.get(g) ?? []
    if (xs.length < MINIMO_CELDA) {
      suprimidos += 1
      return SUPRIMIDA
    }
    return celdaPct(medidaNumerica(resumir(xs), def.medida))
  })
  if (suprimidos > 0) avisos.push(`Los grupos con menos de ${MINIMO_CELDA} respuestas no se muestran ("<${MINIMO_CELDA}").`)
  return {
    titulo: `${NOMBRE_MEDIDA[def.medida] ?? 'Promedio'} de ${campo.etiqueta.toLowerCase()} por ${desglose.etiqueta.toLowerCase()}`,
    categorias: orden.map((g) => etiquetaCategoria(desglose.clave, g)),
    series: [{ nombre: NOMBRE_MEDIDA[def.medida] ?? 'Promedio', celdas }],
    unidad: 'porcentaje',
    base: todos.length,
    total: base.length,
    resumen: null,
    avisos,
  }
}

function discreto(filas: readonly FilaPublica[], def: GraficaDef, campo: CampoCatalogo, desglose: CampoCatalogo | undefined): DatosGrafica {
  const base = ultimaPorBeneficiario(filas)
  const apilada = def.grafica === 'apilada_100'
  const comoPct = def.medida === 'porcentaje' || apilada
  const avisos: string[] = []

  // Conteo por (categoría del campo, grupo del desglose). Sin desglose hay un único grupo "".
  const celdas = new Map<string, Map<string, number>>() // grupo → categoría → n
  const respondieron = new Map<string, number>() // grupo → beneficiarios con respuesta
  const totalCategoria = new Map<string, number>()
  const totalGrupo = new Map<string, number>()
  for (const f of base) {
    const vs = new Set(valoresDe(f, campo))
    const gs = desglose ? new Set(valoresDe(f, desglose)) : new Set([''])
    if (vs.size === 0 || gs.size === 0) continue
    for (const g of gs) {
      respondieron.set(g, (respondieron.get(g) ?? 0) + 1)
      totalGrupo.set(g, (totalGrupo.get(g) ?? 0) + 1)
      const fila = celdas.get(g) ?? new Map<string, number>()
      for (const v of vs) {
        fila.set(v, (fila.get(v) ?? 0) + 1)
        totalCategoria.set(v, (totalCategoria.get(v) ?? 0) + 1)
      }
      celdas.set(g, fila)
    }
  }
  const respondieronCampo = base.filter((f) => valoresDe(f, campo).length > 0).length
  const categorias = ordenarCategorias(campo, totalCategoria)
  const grupos = desglose ? ordenarCategorias(desglose, totalGrupo) : ['']

  let suprimidas = false
  const valorCelda = (g: string, v: string): CeldaGrafica => {
    const n = celdas.get(g)?.get(v) ?? 0
    const denom = respondieron.get(g) ?? 0
    if (desglose && ((n > 0 && n < MINIMO_CELDA) || (comoPct && denom < MINIMO_CELDA))) {
      suprimidas = true
      return SUPRIMIDA
    }
    return comoPct ? celdaPct(denom === 0 ? null : (n / denom) * 100) : celdaConteo(n)
  }

  let ejeX: string[]
  let series: SerieGrafica[]
  if (apilada) {
    // Una barra por grupo (o una sola), partida en las categorías del campo.
    ejeX = desglose ? grupos.map((g) => etiquetaCategoria(desglose.clave, g)) : ['Total']
    series = categorias.map((v) => ({ nombre: etiquetaCategoria(campo.clave, v), celdas: grupos.map((g) => valorCelda(g, v)) }))
  } else {
    ejeX = categorias.map((v) => etiquetaCategoria(campo.clave, v))
    series = grupos.map((g) => ({
      nombre: desglose ? etiquetaCategoria(desglose.clave, g) : comoPct ? 'Porcentaje' : 'Beneficiarios',
      celdas: categorias.map((v) => valorCelda(g, v)),
    }))
  }

  if (suprimidas) avisos.push(`Las cifras de menos de ${MINIMO_CELDA} beneficiarios no se muestran ("<${MINIMO_CELDA}").`)
  if (campo.tipo === 'multivalor' && comoPct) avisos.push('Cada beneficiario puede marcar varias opciones: los porcentajes pueden sumar más de 100 %.')

  return {
    titulo: titulo(campo, desglose),
    categorias: ejeX,
    series,
    unidad: comoPct ? 'porcentaje' : 'conteo',
    base: respondieronCampo,
    total: base.length,
    resumen: null,
    avisos,
  }
}

/** Calcula los datos de una gráfica. La definición debe estar normalizada (ver definicion.ts). */
export function calcularGrafica(filas: readonly FilaPublica[], def: GraficaDef): DatosGrafica {
  const campo = buscarCampo(def.campo)
  if (!campo) throw new Error(`Campo desconocido: ${def.campo}`)
  const desglose = def.desglose === null ? undefined : buscarCampo(def.desglose)
  return campo.tipo === 'numerico' ? numerico(filas, def, campo, desglose) : discreto(filas, def, campo, desglose)
}
