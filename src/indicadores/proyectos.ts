/**
 * Nombres de proyecto: en origen llegan con mayúsculas distintas
 * ("FONDERVALLE SEGUNDA CONVOCATORIA" y "Fonder Valle Primera Convocatoria").
 * Para comparar se usa una clave normalizada; para mostrar, una etiqueta unificada.
 */

/** Clave de comparación: sin tildes, sin mayúsculas, sin espacios ni signos. */
export function claveProyecto(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function titulo(texto: string): string {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function primeraMayuscula(texto: string): string {
  const t = texto.toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * Etiqueta para mostrar. Los proyectos se presentan como convocatorias:
 * "FONDERVALLE SEGUNDA CONVOCATORIA" → "Segunda convocatoria".
 */
export function etiquetaProyecto(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  const m = /^fonder\s*valle\s*(.*)$/i.exec(limpio)
  if (m) {
    const resto = (m[1] ?? '').trim()
    return resto === '' ? 'Fonder Valle' : primeraMayuscula(resto)
  }
  return limpio === limpio.toUpperCase() ? titulo(limpio) : limpio
}

export interface OpcionProyecto {
  clave: string
  etiqueta: string
}

/** Proyectos distintos presentes en una lista de nombres, ordenados por etiqueta. */
export function listarProyectos(nombres: readonly string[]): OpcionProyecto[] {
  const mapa = new Map<string, string>()
  for (const nombre of nombres) {
    const clave = claveProyecto(nombre)
    if (!mapa.has(clave)) mapa.set(clave, etiquetaProyecto(nombre))
  }
  return [...mapa.entries()]
    .map(([clave, etiqueta]) => ({ clave, etiqueta }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
}
