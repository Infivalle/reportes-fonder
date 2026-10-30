/**
 * Datos del mapa (F3): cuántos beneficiarios hay en cada municipio del Valle y el detalle de uno.
 * No depende de React ni del dibujo: recibe publico.json y los filtros globales y devuelve números.
 *
 * Reglas que conviene no perder de vista:
 * - El filtro de municipio NO se aplica al mapa (siempre se ven los 42 para poder comparar); sí se
 *   aplican la convocatoria y el mes.
 * - No hay total de beneficiarios por municipio, así que el mapa muestra conteos, no cobertura.
 * - Las cifras de cada municipio salen de `calcularIndicadores`, la misma función de la pestaña
 *   Indicadores: el panel y esa pestaña (con el mismo municipio filtrado) siempre coinciden.
 * - Cifras pequeñas: se sigue la decisión de InfiValle de mostrarlas siempre. Está atada a
 *   `UMBRAL_SUPRESION` (el mismo interruptor de las gráficas): si se sube a 5, los porcentajes de
 *   municipios con menos de 5 respuestas pasan a "oculto" sin tocar nada más.
 */
import { UMBRAL_SUPRESION } from '../graficas/datos'
import { aplicarFiltros, calcularIndicadores, type IndicadorProporcion } from '../indicadores/calcular'
import { claveProyecto, etiquetaProyecto } from '../indicadores/proyectos'
import { MUNICIPIOS_VALLE, nombreMunicipio } from '../limpieza/municipios'
import type { FilaPublica, PublicoJson } from '../publico/tipos'
import { BENEFICIARIOS_POR_MUNICIPIO, type TotalesDelMunicipio, type TotalesMunicipio } from './totalesMunicipio'

/** Filtros que usa el mapa: convocatoria y mes (el municipio se elige dentro del mapa). */
export interface FiltrosMapa {
  proyecto: string | null
  mes: string | null
}

export interface ResumenMunicipio {
  codigo: string
  nombre: string
  /** Beneficiarios distintos con al menos una asesoría en el municipio. */
  beneficiarios: number
  asesorias: number
}

export interface DatosMapa {
  /** Los 42 municipios del Valle, también los que tienen 0, en orden de código DIVIPOLA. */
  municipios: ResumenMunicipio[]
  /** Mayor número de beneficiarios en un municipio (0 si no hay ninguno). */
  maximo: number
  /** Municipios con al menos un beneficiario. */
  visitados: number
  /** Beneficiarios distintos con municipio del Valle. */
  ubicados: number
  /** Beneficiarios sin municipio del Valle (vacío, de otro departamento o no reconocido). */
  sinUbicar: number
  /** Beneficiarios distintos en total (ubicados + sin ubicar). */
  total: number
  fuente: PublicoJson['fuente_municipio']
}

/** Filas que pasan convocatoria y mes (el municipio no filtra). */
function filasDelMapa(datos: PublicoJson, filtros: FiltrosMapa): FilaPublica[] {
  return aplicarFiltros(datos.asesorias, { proyecto: filtros.proyecto, mes: filtros.mes, municipio: null })
}

export function calcularMapa(datos: PublicoJson, filtros: FiltrosMapa): DatosMapa {
  const filas = filasDelMapa(datos, filtros)
  const validos = new Set(MUNICIPIOS_VALLE.map((m) => m.codigo))

  const personas = new Map<string, Set<string>>() // municipio → beneficiarios
  const asesorias = new Map<string, number>()
  const conMunicipio = new Set<string>()
  const todas = new Set<string>()
  for (const f of filas) {
    todas.add(f.beneficiario)
    const codigo = f.municipio_codigo
    if (codigo === null || !validos.has(codigo)) continue
    conMunicipio.add(f.beneficiario)
    asesorias.set(codigo, (asesorias.get(codigo) ?? 0) + 1)
    const set = personas.get(codigo) ?? new Set<string>()
    set.add(f.beneficiario)
    personas.set(codigo, set)
  }

  const municipios = [...MUNICIPIOS_VALLE]
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map((m): ResumenMunicipio => ({
      codigo: m.codigo,
      nombre: m.nombre,
      beneficiarios: personas.get(m.codigo)?.size ?? 0,
      asesorias: asesorias.get(m.codigo) ?? 0,
    }))

  return {
    municipios,
    maximo: municipios.reduce((mayor, m) => Math.max(mayor, m.beneficiarios), 0),
    visitados: municipios.filter((m) => m.beneficiarios > 0).length,
    ubicados: conMunicipio.size,
    sinUbicar: todas.size - conMunicipio.size,
    total: todas.size,
    fuente: datos.fuente_municipio,
  }
}

/** Un porcentaje del panel con la cantidad de respuestas en que se basa. */
export interface PorcentajeMunicipio {
  /** 0 a 100; null si no hay respuestas o si el grupo es demasiado pequeño para mostrarse. */
  valor: number | null
  /** Respuestas en que se basa. */
  n: number
  /** true si hay respuestas pero son menos que `UMBRAL_SUPRESION` (con el 0 actual nunca ocurre). */
  oculto: boolean
}

export interface ConvocatoriaMunicipio {
  clave: string
  etiqueta: string
  beneficiarios: number
}

/**
 * - `ok`: hay total y el filtro lo permite.
 * - `sin_total`: no hay total utilizable (falta, es 0, o la convocatoria elegida no es la primera ni la segunda).
 * - `con_mes`: el total es de todos los meses; con un mes filtrado el porcentaje saldría subestimado,
 *   así que no se calcula. (La convocatoria sí se puede filtrar: hay total por convocatoria.)
 */
export type EstadoCobertura = 'ok' | 'sin_total' | 'con_mes'

export interface CoberturaMunicipio {
  estado: EstadoCobertura
  /** Total de beneficiarios del municipio (solo con estado `ok`). */
  total: number | null
  /** 0 a 100 (solo con estado `ok`). */
  porcentaje: number | null
  /** Hay más beneficiarios atendidos que el total cargado: el total está desactualizado. */
  inconsistente: boolean
}

export type { TotalesMunicipio }

export interface DetalleMunicipio {
  codigo: string
  nombre: string
  beneficiarios: number
  asesorias: number
  satisfaccion: PorcentajeMunicipio
  resultados: PorcentajeMunicipio
  nuevoCredito: PorcentajeMunicipio
  cobertura: CoberturaMunicipio
  /** Beneficiarios por convocatoria, de mayor a menor (empate: orden alfabético). */
  porConvocatoria: ConvocatoriaMunicipio[]
}

function porcentajeDe(i: IndicadorProporcion): PorcentajeMunicipio {
  const oculto = i.n > 0 && i.n < UMBRAL_SUPRESION
  return { valor: oculto ? null : i.valor, n: i.n, oculto }
}

/** "fondervalleprimeraconvocatoria" → 'primera'; "…segunda…" → 'segunda'; otra cosa → null. */
export function convocatoriaDe(clave: string): 'primera' | 'segunda' | null {
  const c = clave.toLowerCase()
  if (c.includes('primera')) return 'primera'
  if (c.includes('segunda')) return 'segunda'
  return null
}

function coberturaDe(atendidos: number, totales: TotalesDelMunicipio | undefined, filtros: FiltrosMapa): CoberturaMunicipio {
  if (filtros.mes !== null) return { estado: 'con_mes', total: null, porcentaje: null, inconsistente: false }
  const conv = filtros.proyecto === null ? 'total' : convocatoriaDe(filtros.proyecto)
  const total = totales === undefined || conv === null ? undefined : totales[conv]
  if (total === undefined || !Number.isFinite(total) || total <= 0) return { estado: 'sin_total', total: null, porcentaje: null, inconsistente: false }
  return { estado: 'ok', total, porcentaje: (atendidos / total) * 100, inconsistente: atendidos > total }
}

export function detalleMunicipio(
  datos: PublicoJson,
  filtros: FiltrosMapa,
  codigo: string,
  totales: TotalesMunicipio = BENEFICIARIOS_POR_MUNICIPIO,
): DetalleMunicipio {
  const r = calcularIndicadores(datos, { proyecto: filtros.proyecto, mes: filtros.mes, municipio: codigo })

  const personas = new Map<string, Set<string>>() // convocatoria → beneficiarios
  for (const f of aplicarFiltros(datos.asesorias, { proyecto: filtros.proyecto, mes: filtros.mes, municipio: codigo })) {
    const clave = claveProyecto(f.proyecto)
    const set = personas.get(clave) ?? new Set<string>()
    set.add(f.beneficiario)
    personas.set(clave, set)
  }
  const etiquetas = new Map<string, string>()
  for (const f of datos.asesorias) etiquetas.set(claveProyecto(f.proyecto), etiquetaProyecto(f.proyecto))

  const porConvocatoria = [...personas.entries()]
    .map(([clave, set]): ConvocatoriaMunicipio => ({ clave, etiqueta: etiquetas.get(clave) ?? clave, beneficiarios: set.size }))
    .sort((a, b) => b.beneficiarios - a.beneficiarios || a.etiqueta.localeCompare(b.etiqueta, 'es'))

  return {
    codigo,
    nombre: nombreMunicipio(codigo) ?? codigo,
    beneficiarios: r.beneficiarios,
    asesorias: r.asesorias,
    satisfaccion: porcentajeDe(r.satisfaccion),
    resultados: porcentajeDe(r.resultados),
    nuevoCredito: porcentajeDe(r.nuevoCredito),
    cobertura: coberturaDe(r.beneficiarios, totales[codigo], filtros),
    porConvocatoria,
  }
}

/** Tramo de la escala de color: de `desde` a `hasta` beneficiarios, ambos incluidos. */
export interface ClaseColor {
  desde: number
  hasta: number
  /** Posición en la rampa de color, de 0 (más claro) a (clases − 1). */
  indice: number
}

export const MAX_CLASES = 5

/**
 * Tramos por cuantiles de los municipios con beneficiarios (a lo sumo `MAX_CLASES`, menos si hay pocos
 * valores distintos). Con tramos iguales, un solo municipio grande (Cali) dejaría a casi todos los
 * demás en el mismo color; con cuantiles cada color agrupa una parte parecida de municipios.
 * Los tramos cubren de 1 al máximo sin huecos ni solapes. El 0 no es un tramo: se pinta aparte
 * como "sin asesorías".
 */
export function clasesDeColor(conteos: readonly number[]): ClaseColor[] {
  const positivos = conteos.filter((n) => Number.isFinite(n) && n >= 1).sort((a, b) => a - b)
  if (positivos.length === 0) return []
  const distintos = new Set(positivos).size
  const cuantas = Math.min(MAX_CLASES, distintos)
  const limites = new Set<number>()
  for (let i = 1; i <= cuantas; i++) limites.add(positivos[Math.ceil((i * positivos.length) / cuantas) - 1] ?? 0)
  const clases: ClaseColor[] = []
  let desde = 1
  for (const hasta of [...limites].sort((a, b) => a - b)) {
    clases.push({ desde, hasta, indice: clases.length })
    desde = hasta + 1
  }
  return clases
}

/** Índice de la clase a la que pertenece un conteo; null para 0 (sin asesorías). */
export function claseDe(conteo: number, clases: readonly ClaseColor[]): number | null {
  if (conteo < 1) return null
  const c = clases.find((x) => conteo >= x.desde && conteo <= x.hasta)
  return c === undefined ? null : c.indice
}

export type OrdenLista = 'nombre' | 'beneficiarios' | 'asesorias'

/** Copia ordenada de la lista de municipios. Empates: por nombre. */
export function ordenarMunicipios(lista: readonly ResumenMunicipio[], por: OrdenLista, ascendente: boolean): ResumenMunicipio[] {
  const signo = ascendente ? 1 : -1
  const nombre = (a: ResumenMunicipio, b: ResumenMunicipio) => a.nombre.localeCompare(b.nombre, 'es')
  return [...lista].sort((a, b) => {
    if (por === 'nombre') return signo * nombre(a, b)
    const d = por === 'beneficiarios' ? a.beneficiarios - b.beneficiarios : a.asesorias - b.asesorias
    return d !== 0 ? signo * d : nombre(a, b)
  })
}
