/**
 * Lectura de la cartera Fonder (`fondercompleto.xlsx`, hoja `DETALLE FONDER`) en el navegador.
 * El archivo no se envía a ningún servidor: se lee y se cruza en el equipo de quien lo elige.
 */
import ExcelJS from 'exceljs'
import type { FilaCartera } from './cruce'

export const HOJA_CARTERA = 'DETALLE FONDER'
/** En el archivo actual el encabezado está en la fila 4; si cambia, se busca en las primeras filas. */
const FILA_ENCABEZADO_ESPERADA = 4
const FILAS_DONDE_BUSCAR = 20

/** Minúsculas, sin tildes, sin signos y con espacios simples ("Año" → "ano"). */
export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Texto de una celda de ExcelJS (número, texto, fórmula, texto enriquecido, enlace, fecha). */
export function valorTexto(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: unknown }
    if (o.richText !== undefined) return o.richText.map((t) => t.text).join('').trim()
    if (o.result !== undefined) return valorTexto(o.result)
    if (o.text !== undefined) return valorTexto(o.text)
  }
  return ''
}

interface Columnas {
  cedula: number
  nombre: number
  anio: number
  estado: number
  municipio: number | null
  equipo: number | null
  solicitud: number | null
}

const REQUERIDAS: readonly { clave: 'cedula' | 'nombre' | 'anio' | 'estado'; titulo: string; alias: readonly string[] }[] = [
  { clave: 'cedula', titulo: 'Cédula', alias: ['cedula'] },
  { clave: 'nombre', titulo: 'Nombre', alias: ['nombre'] },
  { clave: 'anio', titulo: 'Año', alias: ['ano'] },
  { clave: 'estado', titulo: 'Estado depurado', alias: ['estado depurado'] },
]

/** Posición (1 = primera columna) de cada columna que interesa, o null con la lista de las que faltan. */
export function ubicarColumnas(encabezados: readonly string[]): { columnas: Columnas } | { faltan: string[] } {
  const norm = encabezados.map(normalizarEncabezado)
  const buscar = (alias: readonly string[]): number | null => {
    const i = norm.findIndex((t) => alias.includes(t))
    return i === -1 ? null : i + 1
  }
  const faltan: string[] = []
  const pos: Partial<Record<'cedula' | 'nombre' | 'anio' | 'estado', number>> = {}
  for (const r of REQUERIDAS) {
    const p = buscar(r.alias)
    if (p === null) faltan.push(r.titulo)
    else pos[r.clave] = p
  }
  if (faltan.length > 0 || pos.cedula === undefined || pos.nombre === undefined || pos.anio === undefined || pos.estado === undefined) {
    return { faltan }
  }
  const solicitudIdx = norm.findIndex((t) => t.includes('solicitud'))
  return {
    columnas: {
      cedula: pos.cedula,
      nombre: pos.nombre,
      anio: pos.anio,
      estado: pos.estado,
      municipio: buscar(['municipio residencia']),
      equipo: buscar(['equipo']),
      solicitud: solicitudIdx === -1 ? null : solicitudIdx + 1,
    },
  }
}

function entero(texto: string): number | null {
  const n = Number(texto)
  return Number.isInteger(n) ? n : null
}

/**
 * Lee la cartera. Lanza un Error con un mensaje para la persona si el archivo no tiene la hoja o
 * las columnas esperadas. Las filas sin cédula ni ID de solicitud se ignoran.
 */
export async function leerCartera(contenido: ArrayBuffer): Promise<FilaCartera[]> {
  const libro = new ExcelJS.Workbook()
  try {
    await libro.xlsx.load(contenido)
  } catch {
    throw new Error('No se pudo abrir el archivo. Debe ser un Excel (.xlsx) sin contraseña.')
  }

  const hoja = libro.getWorksheet(HOJA_CARTERA)
  if (hoja === undefined) {
    const nombres = libro.worksheets.map((h) => h.name).join(', ')
    throw new Error(`El archivo no tiene la hoja "${HOJA_CARTERA}". Hojas encontradas: ${nombres || 'ninguna'}.`)
  }

  const leerEncabezados = (n: number): string[] => {
    const fila = hoja.getRow(n)
    const textos: string[] = []
    for (let c = 1; c <= hoja.columnCount; c += 1) textos.push(valorTexto(fila.getCell(c).value))
    return textos
  }

  // Primero la fila esperada; si no sirve, se busca la primera fila que traiga todas las columnas.
  let filaEnc = FILA_ENCABEZADO_ESPERADA
  let ubicado = ubicarColumnas(leerEncabezados(filaEnc))
  if (!('columnas' in ubicado)) {
    for (let n = 1; n <= FILAS_DONDE_BUSCAR; n += 1) {
      const intento = ubicarColumnas(leerEncabezados(n))
      if ('columnas' in intento) {
        filaEnc = n
        ubicado = intento
        break
      }
    }
  }
  if (!('columnas' in ubicado)) {
    throw new Error(
      `No se encontró la fila de encabezados en la hoja "${HOJA_CARTERA}". Faltan las columnas: ${ubicado.faltan.join(', ')}.`,
    )
  }
  const col = ubicado.columnas

  const filas: FilaCartera[] = []
  for (let n = filaEnc + 1; n <= hoja.rowCount; n += 1) {
    const fila = hoja.getRow(n)
    const cedula = valorTexto(fila.getCell(col.cedula).value)
    const solicitud = col.solicitud === null ? '' : valorTexto(fila.getCell(col.solicitud).value)
    if (cedula === '' && solicitud === '') continue
    filas.push({
      cedula,
      nombre: valorTexto(fila.getCell(col.nombre).value),
      anio: entero(valorTexto(fila.getCell(col.anio).value)),
      estado: valorTexto(fila.getCell(col.estado).value),
      municipio: col.municipio === null ? '' : valorTexto(fila.getCell(col.municipio).value),
      equipo: col.equipo === null ? '' : valorTexto(fila.getCell(col.equipo).value),
    })
  }
  if (filas.length === 0) throw new Error('La hoja de la cartera no tiene filas con cédula debajo del encabezado.')
  return filas
}
