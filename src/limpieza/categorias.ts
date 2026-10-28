import { normalizarTexto } from './texto.ts'

export interface ResultadoCategoria {
  valor: string | null
  /** true si el valor no coincide con ninguna opción del catálogo (se conserva tal cual). */
  fueraDeCatalogo: boolean
}

/**
 * Lleva una respuesta a la opción canónica del catálogo, sin distinguir mayúsculas,
 * tildes ni espacios sobrantes ("si " -> "Sí"). Un valor desconocido se conserva.
 */
export function normalizarCategoria(
  valor: string | null,
  opciones: readonly string[],
): ResultadoCategoria {
  if (valor === null) return { valor: null, fueraDeCatalogo: false }
  const clave = normalizarTexto(valor)
  if (clave === '') return { valor: null, fueraDeCatalogo: false }
  const canonica = opciones.find((o) => normalizarTexto(o) === clave)
  if (canonica !== undefined) return { valor: canonica, fueraDeCatalogo: false }
  return { valor: valor.trim(), fueraDeCatalogo: true }
}

/** "CT,AA" -> ["CT", "AA"] (sin vacíos ni repetidos, en mayúsculas). */
export function separarCodigos(valor: string | null): string[] {
  if (valor === null) return []
  const codigos = valor
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c !== '')
  return [...new Set(codigos)]
}
