const PATRON = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/

/** Colombia no tiene horario de verano: UTC−5 fijo. */
const OFFSET_COLOMBIA_MS = -5 * 60 * 60 * 1000

/**
 * Convierte "2026-10-16 18:30:12" (asumido UTC, como sale de la base) a ISO UTC.
 * Devuelve null si el texto no es una fecha válida.
 */
export function parseFechaUtc(texto: string): string | null {
  const m = PATRON.exec(texto)
  if (m === null) return null
  const [, y, mo, d, h, mi, s] = m.map(Number) as [number, number, number, number, number, number, number]
  const ms = Date.UTC(y, mo - 1, d, h, mi, s)
  const fecha = new Date(ms)
  // Rechaza fechas imposibles que Date "corrige" (31 de febrero, hora 25...)
  if (
    fecha.getUTCFullYear() !== y ||
    fecha.getUTCMonth() !== mo - 1 ||
    fecha.getUTCDate() !== d ||
    fecha.getUTCHours() !== h ||
    fecha.getUTCMinutes() !== mi ||
    fecha.getUTCSeconds() !== s
  ) {
    return null
  }
  return fecha.toISOString()
}

/** Mes ("YYYY-MM") en hora de Colombia a partir de un instante ISO UTC. */
export function mesColombia(isoUtc: string): string {
  const local = new Date(new Date(isoUtc).getTime() + OFFSET_COLOMBIA_MS)
  return local.toISOString().slice(0, 7)
}

/** Fecha y hora en Colombia, "YYYY-MM-DD HH:MM:SS", a partir de un instante ISO UTC. */
export function aHoraColombia(isoUtc: string): string {
  const local = new Date(new Date(isoUtc).getTime() + OFFSET_COLOMBIA_MS)
  return local.toISOString().slice(0, 19).replace('T', ' ')
}
