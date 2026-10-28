/**
 * Filtros y agregaciones genéricas sobre las asesorías públicas. Es el motor del constructor de
 * gráficas: recibe filas, un filtro y un campo, y devuelve categorías con su n.
 */
import { buscarCampo, esDiscreto, type CampoCatalogo, type Medida } from '../catalogo/campos'
import type { FilaPublica } from '../publico/tipos'

/** Mínimo de beneficiarios para mostrar una celda de un cruce. */
export const MINIMO_CELDA = 5

/** clave de campo → valores admitidos (vacío o ausente = sin filtro). */
export type Filtros = Readonly<Record<string, readonly string[]>>

/** Valores de una fila para un campo discreto o multivalor; null/vacío → []. */
export function valoresDe(fila: FilaPublica, campo: CampoCatalogo): string[] {
  if (campo.tipo === 'numerico') return []
  const v = fila[campo.clave]
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x !== '')
  return typeof v === 'string' && v !== '' ? [v] : []
}

export function aplicarFiltros(filas: readonly FilaPublica[], filtros: Filtros): FilaPublica[] {
  const activos = Object.entries(filtros).filter(([, vs]) => vs.length > 0)
  if (activos.length === 0) return [...filas]
  return filas.filter((f) =>
    activos.every(([clave, admitidos]) => {
      const campo = buscarCampo(clave)
      if (!campo) return false
      return valoresDe(f, campo).some((v) => admitidos.includes(v))
    }),
  )
}

/** Si un beneficiario tiene varias asesorías conserva la más reciente (por mes; empate: la última leída). */
export function masRecientePorBeneficiario(filas: readonly FilaPublica[]): FilaPublica[] {
  const m = new Map<string, FilaPublica>()
  for (const f of filas) {
    const previa = m.get(f.beneficiario)
    if (!previa || f.mes >= previa.mes) m.set(f.beneficiario, f)
  }
  return [...m.values()]
}

export interface Categoria {
  valor: string
  n: number
  /** % sobre quienes respondieron (null si la medida es conteo). */
  porcentaje: number | null
}

export interface Serie {
  campo: string
  /** Quienes respondieron el campo (base del porcentaje). */
  respondieron: number
  categorias: Categoria[]
  /** Cuántos beneficiarios hay en la base filtrada, hayan respondido o no. */
  total: number
}

/** Orden de las categorías: el del catálogo; las desconocidas al final por n; fecha cronológica. */
function ordenar(campo: CampoCatalogo, conteo: Map<string, number>): string[] {
  const claves = [...conteo.keys()]
  if (campo.tipo === 'fecha') return claves.sort()
  if (campo.tipo === 'multivalor') {
    return claves.sort((a, b) => (conteo.get(b) ?? 0) - (conteo.get(a) ?? 0) || a.localeCompare(b, 'es'))
  }
  const opciones = 'opciones' in campo && campo.opciones ? campo.opciones : []
  if (opciones.length === 0) {
    return claves.sort((a, b) => (conteo.get(b) ?? 0) - (conteo.get(a) ?? 0) || a.localeCompare(b, 'es'))
  }
  const conocidas = opciones.filter((o) => conteo.has(o))
  const otras = claves.filter((c) => !opciones.includes(c)).sort((a, b) => a.localeCompare(b, 'es'))
  return [...conocidas, ...otras]
}

/**
 * Cuenta beneficiarios por categoría de un campo discreto o multivalor.
 * Cada beneficiario cuenta una vez por categoría (en multivalor el % puede pasar de 100).
 */
export function distribuir(filas: readonly FilaPublica[], clave: string, medida: Medida = 'conteo'): Serie {
  const campo = buscarCampo(clave)
  if (!campo || campo.tipo === 'numerico') throw new Error(`Campo no discreto: ${clave}`)
  const base = masRecientePorBeneficiario(filas)
  const conteo = new Map<string, number>()
  let respondieron = 0
  for (const f of base) {
    const vs = new Set(valoresDe(f, campo))
    if (vs.size === 0) continue
    respondieron++
    for (const v of vs) conteo.set(v, (conteo.get(v) ?? 0) + 1)
  }
  const categorias = ordenar(campo, conteo).map((valor) => {
    const n = conteo.get(valor) ?? 0
    return { valor, n, porcentaje: medida === 'porcentaje' && respondieron > 0 ? (n / respondieron) * 100 : null }
  })
  return { campo: clave, respondieron, categorias, total: base.length }
}

export interface ResumenNumerico {
  campo: string
  n: number
  promedio: number | null
  mediana: number | null
  minimo: number | null
  maximo: number | null
}

export function resumirNumerico(filas: readonly FilaPublica[], clave: string): ResumenNumerico {
  const campo = buscarCampo(clave)
  if (!campo || campo.tipo !== 'numerico') throw new Error(`Campo no numérico: ${clave}`)
  const xs = masRecientePorBeneficiario(filas)
    .map((f) => f[campo.clave])
    .filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
    .sort((a, b) => a - b)
  if (xs.length === 0) return { campo: clave, n: 0, promedio: null, mediana: null, minimo: null, maximo: null }
  const mitad = Math.floor(xs.length / 2)
  const mediana = xs.length % 2 ? (xs[mitad] as number) : ((xs[mitad - 1] as number) + (xs[mitad] as number)) / 2
  return {
    campo: clave,
    n: xs.length,
    promedio: xs.reduce((s, x) => s + x, 0) / xs.length,
    mediana,
    minimo: xs[0] as number,
    maximo: xs[xs.length - 1] as number,
  }
}

export interface CeldaCruce {
  fila: string
  columna: string
  n: number
  /** false cuando 0 < n < MINIMO_CELDA: se muestra "<5" y no la cifra. */
  visible: boolean
}

/** Cruce de dos campos discretos con supresión de celdas pequeñas. */
export function cruzar(filas: readonly FilaPublica[], claveFila: string, claveColumna: string): CeldaCruce[] {
  const cf = buscarCampo(claveFila)
  const cc = buscarCampo(claveColumna)
  if (!cf || !cc || !esDiscreto(cf) || !esDiscreto(cc)) throw new Error('El cruce exige campos discretos')
  const conteo = new Map<string, number>()
  for (const f of masRecientePorBeneficiario(filas)) {
    for (const a of valoresDe(f, cf)) {
      for (const b of valoresDe(f, cc)) {
        const k = `${a}\u0000${b}`
        conteo.set(k, (conteo.get(k) ?? 0) + 1)
      }
    }
  }
  return [...conteo.entries()].map(([k, n]) => {
    const [fila = '', columna = ''] = k.split('\u0000')
    return { fila, columna, n, visible: n === 0 || n >= MINIMO_CELDA }
  })
}

export const textoCelda = (c: CeldaCruce): string => (c.visible ? String(c.n) : `<${MINIMO_CELDA}`)
