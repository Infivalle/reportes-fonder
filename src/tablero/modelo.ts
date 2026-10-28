/**
 * Modelo del tablero de "Mis gráficas": varias gráficas guardadas, cada una con su definición y sus
 * filtros propios. Todo es JSON plano: se guarda en localStorage y se exporta/importa como archivo.
 *
 * Lo que entra desde fuera (localStorage o un archivo importado) no es de fiar: `leerTablero`
 * valida campo por campo y descarta lo desconocido en vez de romper la pantalla.
 */
import { buscarCampo } from '../catalogo/campos'
import type { FiltrosCampo } from '../indicadores/consulta'
import { CAMPO_INICIAL, normalizar, nuevaDef, type GraficaDef } from '../graficas/definicion'

/** Versión del formato guardado/exportado. Si cambia, `leerTablero` debe saber migrar la anterior. */
export const VERSION_TABLERO = 1
export const MAX_TARJETAS = 24
/** Un tablero legítimo pesa unos pocos KB: más de esto es otra cosa. */
export const MAX_BYTES_ARCHIVO = 256 * 1024

const MAX_VALORES_POR_FILTRO = 60
const MAX_LARGO_VALOR = 120

export interface TarjetaTablero {
  id: string
  def: GraficaDef
  /** Filtros propios de esta gráfica (se suman a los globales). Vacío = ninguno. */
  filtros: FiltrosCampo
}

export interface Tablero {
  version: typeof VERSION_TABLERO
  tarjetas: TarjetaTablero[]
}

let contador = 0
export function nuevoId(): string {
  contador += 1
  return `g${Date.now().toString(36)}${contador.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function nuevaTarjeta(def: GraficaDef = nuevaDef(CAMPO_INICIAL), filtros: FiltrosCampo = {}): TarjetaTablero {
  return { id: nuevoId(), def, filtros }
}

/** Tablero de la primera visita: una gráfica de ejemplo para que la pantalla no empiece vacía. */
export function tableroInicial(): Tablero {
  return { version: VERSION_TABLERO, tarjetas: [nuevaTarjeta()] }
}

export const tableroVacio = (): Tablero => ({ version: VERSION_TABLERO, tarjetas: [] })

// ---------------------------------------------------------------------------------------------
// Operaciones puras (el estado de la pantalla es siempre un Tablero nuevo, nunca uno mutado)
// ---------------------------------------------------------------------------------------------

export function agregarTarjeta(t: Tablero, tarjeta: TarjetaTablero): Tablero {
  if (t.tarjetas.length >= MAX_TARJETAS) return t
  return { ...t, tarjetas: [...t.tarjetas, tarjeta] }
}

export function reemplazarTarjeta(t: Tablero, id: string, def: GraficaDef, filtros: FiltrosCampo): Tablero {
  return { ...t, tarjetas: t.tarjetas.map((x) => (x.id === id ? { id, def, filtros } : x)) }
}

export function quitarTarjeta(t: Tablero, id: string): Tablero {
  return { ...t, tarjetas: t.tarjetas.filter((x) => x.id !== id) }
}

/** Copia la tarjeta justo después de la original, con id nuevo. */
export function duplicarTarjeta(t: Tablero, id: string): Tablero {
  const i = t.tarjetas.findIndex((x) => x.id === id)
  const original = t.tarjetas[i]
  if (i < 0 || !original || t.tarjetas.length >= MAX_TARJETAS) return t
  const copia: TarjetaTablero = { id: nuevoId(), def: { ...original.def }, filtros: copiarFiltros(original.filtros) }
  return { ...t, tarjetas: [...t.tarjetas.slice(0, i + 1), copia, ...t.tarjetas.slice(i + 1)] }
}

/** Mueve la tarjeta `delta` posiciones (-1 sube, +1 baja). Los extremos no se salen de la lista. */
export function moverTarjeta(t: Tablero, id: string, delta: -1 | 1): Tablero {
  const i = t.tarjetas.findIndex((x) => x.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= t.tarjetas.length) return t
  const tarjetas = [...t.tarjetas]
  const a = tarjetas[i]
  const b = tarjetas[j]
  if (!a || !b) return t
  tarjetas[i] = b
  tarjetas[j] = a
  return { ...t, tarjetas }
}

export function copiarFiltros(f: FiltrosCampo): FiltrosCampo {
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, [...v]]))
}

// ---------------------------------------------------------------------------------------------
// Lectura y escritura (JSON)
// ---------------------------------------------------------------------------------------------

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Solo campos del catálogo que se pueden filtrar (no numéricos), con valores de texto acotados. */
function leerFiltros(x: unknown): FiltrosCampo {
  if (!esObjeto(x)) return {}
  const salida: Record<string, string[]> = {}
  for (const [clave, valores] of Object.entries(x)) {
    const campo = buscarCampo(clave)
    if (!campo || campo.tipo === 'numerico' || !Array.isArray(valores)) continue
    const limpios = [...new Set(valores.filter((v): v is string => typeof v === 'string' && v !== '' && v.length <= MAX_LARGO_VALOR))].slice(0, MAX_VALORES_POR_FILTRO)
    if (limpios.length > 0) salida[campo.clave] = limpios
  }
  return salida
}

function leerTarjeta(x: unknown, usados: Set<string>): TarjetaTablero | null {
  if (!esObjeto(x) || !esObjeto(x.def)) return null
  const d = x.def
  if (typeof d.campo !== 'string' || typeof d.grafica !== 'string' || typeof d.medida !== 'string') return null
  const def = normalizar({
    campo: d.campo,
    grafica: d.grafica as GraficaDef['grafica'],
    medida: d.medida as GraficaDef['medida'],
    desglose: typeof d.desglose === 'string' ? d.desglose : null,
  })
  if (def === null) return null
  let id = typeof x.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(x.id) ? x.id : nuevoId()
  if (usados.has(id)) id = nuevoId()
  usados.add(id)
  return { id, def, filtros: leerFiltros(x.filtros) }
}

export type LecturaTablero =
  | { ok: true; tablero: Tablero; descartadas: number }
  | { ok: false; motivo: string }

/** Convierte texto JSON (de localStorage o de un archivo) en un tablero válido, o explica por qué no. */
export function leerTablero(texto: string): LecturaTablero {
  if (texto.length > MAX_BYTES_ARCHIVO) return { ok: false, motivo: 'El archivo es demasiado grande para ser un tablero.' }
  let crudo: unknown
  try {
    crudo = JSON.parse(texto)
  } catch {
    return { ok: false, motivo: 'El archivo no es un JSON válido.' }
  }
  if (!esObjeto(crudo) || !Array.isArray(crudo.tarjetas)) return { ok: false, motivo: 'El archivo no tiene el formato de un tablero de gráficas.' }
  if (typeof crudo.version !== 'number') return { ok: false, motivo: 'El archivo no indica la versión del tablero.' }
  if (crudo.version > VERSION_TABLERO) {
    return { ok: false, motivo: 'El archivo viene de una versión más nueva del sitio. Actualice la página e intente de nuevo.' }
  }
  const usados = new Set<string>()
  const candidatas = crudo.tarjetas.slice(0, MAX_TARJETAS)
  const tarjetas = candidatas.map((c) => leerTarjeta(c, usados)).filter((c): c is TarjetaTablero => c !== null)
  const descartadas = crudo.tarjetas.length - tarjetas.length
  return { ok: true, tablero: { version: VERSION_TABLERO, tarjetas }, descartadas }
}

export function serializarTablero(t: Tablero): string {
  return JSON.stringify({ version: VERSION_TABLERO, tarjetas: t.tarjetas }, null, 2)
}
