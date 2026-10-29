/**
 * Ruta y filtros globales codificados en el `#` de la URL, p. ej.
 *   #/indicadores?conv=fondervalleprimeraconvocatoria&mun=76834&mes=2026-10
 *
 * GitHub Pages no sabe responder a rutas internas (recargar daría 404), por eso se usa el `#`.
 * Todo lo que viene de la URL es entrada no confiable: se valida el formato de cada parámetro y
 * lo que no cumple se ignora (nunca se interpreta ni se pinta sin validar).
 */
import type { PublicoJson } from '../publico/tipos'
import { MUNICIPIOS_VALLE } from '../limpieza/municipios'
import { claveProyecto, listarProyectos, type OpcionProyecto } from '../indicadores/proyectos'
import { etiquetaMes } from '../indicadores/consulta'

export type Ruta = 'indicadores' | 'mapa' | 'graficas'

export const RUTAS: readonly { ruta: Ruta; etiqueta: string }[] = [
  { ruta: 'indicadores', etiqueta: 'Indicadores' },
  { ruta: 'mapa', etiqueta: 'Mapa' },
  { ruta: 'graficas', etiqueta: 'Mis gráficas' },
]

export const RUTA_INICIAL: Ruta = 'indicadores'

/** Filtros globales completos (todos presentes; null = sin filtro). Es asignable a `Filtros`. */
export interface FiltrosGlobales {
  proyecto: string | null
  municipio: string | null
  mes: string | null
}

export const SIN_FILTROS_GLOBALES: FiltrosGlobales = { proyecto: null, municipio: null, mes: null }

export interface EstadoRuta {
  ruta: Ruta
  filtros: FiltrosGlobales
}

const RE_PROYECTO = /^[a-z0-9]{1,80}$/
const RE_MUNICIPIO = /^76\d{3}$/
const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/

function valido(valor: string | null, patron: RegExp): string | null {
  return valor !== null && patron.test(valor) ? valor : null
}

/** Lee un hash (con o sin "#") y devuelve la ruta y los filtros; lo ilegible vuelve a los valores por defecto. */
export function leerHash(hash: string): EstadoRuta {
  const texto = hash.startsWith('#') ? hash.slice(1) : hash
  const corte = texto.indexOf('?')
  const camino = corte === -1 ? texto : texto.slice(0, corte)
  const consulta = corte === -1 ? '' : texto.slice(corte + 1)

  const nombre = camino.replace(/^\/+/, '').replace(/\/+$/, '')
  const ruta = RUTAS.find((r) => r.ruta === nombre)?.ruta ?? RUTA_INICIAL

  const q = new URLSearchParams(consulta)
  return {
    ruta,
    filtros: {
      proyecto: valido(q.get('conv'), RE_PROYECTO),
      municipio: valido(q.get('mun'), RE_MUNICIPIO),
      mes: valido(q.get('mes'), RE_MES),
    },
  }
}

/** Hash canónico: solo incluye los filtros activos, en orden fijo (enlaces estables). */
export function construirHash(ruta: Ruta, filtros: FiltrosGlobales): string {
  const q = new URLSearchParams()
  if (filtros.proyecto !== null) q.set('conv', filtros.proyecto)
  if (filtros.municipio !== null) q.set('mun', filtros.municipio)
  if (filtros.mes !== null) q.set('mes', filtros.mes)
  const texto = q.toString()
  return `#/${ruta}${texto === '' ? '' : `?${texto}`}`
}

export function hayFiltros(f: FiltrosGlobales): boolean {
  return f.proyecto !== null || f.municipio !== null || f.mes !== null
}

export interface OpcionesFiltro {
  proyectos: OpcionProyecto[]
  municipios: { codigo: string; nombre: string }[]
  meses: { valor: string; etiqueta: string }[]
}

/** Opciones que realmente existen en los datos (no se ofrece un municipio o mes sin asesorías). */
export function opcionesDe(datos: PublicoJson): OpcionesFiltro {
  const proyectos = listarProyectos([...datos.asesorias.map((a) => a.proyecto), ...datos.denominadores.map((d) => d.proyecto)])

  const codigos = new Set(datos.asesorias.map((a) => a.municipio_codigo).filter((c): c is string => c !== null))
  const municipios = MUNICIPIOS_VALLE.filter((m) => codigos.has(m.codigo))
    .map((m) => ({ codigo: m.codigo, nombre: m.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const meses = [...new Set(datos.asesorias.map((a) => a.mes))]
    .filter((m) => RE_MES.test(m))
    .sort()
    .reverse()
    .map((valor) => ({ valor, etiqueta: etiquetaMes(valor) }))

  return { proyectos, municipios, meses }
}

/** Descarta del filtro lo que no existe en los datos (un enlace viejo o escrito a mano). */
export function sanearFiltros(f: FiltrosGlobales, o: OpcionesFiltro): FiltrosGlobales {
  return {
    proyecto: f.proyecto !== null && o.proyectos.some((p) => p.clave === claveProyecto(f.proyecto ?? '')) ? f.proyecto : null,
    municipio: f.municipio !== null && o.municipios.some((m) => m.codigo === f.municipio) ? f.municipio : null,
    mes: f.mes !== null && o.meses.some((m) => m.valor === f.mes) ? f.mes : null,
  }
}
