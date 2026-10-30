/**
 * Indicador de empleos: suma de los empleados actuales de los beneficiarios.
 *
 * El formulario NO guarda el número de empleados, solo un rango ("De 1 a 5", "De 5 a 10"…). Por eso
 * la suma exacta no existe: lo único cierto es un MÍNIMO. Cada beneficiario aporta el extremo
 * inferior de su rango y el resultado se presenta siempre como "al menos N".
 */
import type { Distribucion } from './calcular'

export interface EmpleosMinimos {
  /** Suma de los extremos inferiores: "al menos" tantos empleos. */
  minimo: number
  /** Beneficiarios con respuesta cuyo rango se pudo interpretar. */
  personas: number
  /** Beneficiarios con respuesta cuyo rango no se reconoció (no suman). */
  sinInterpretar: number
}

/**
 * Extremo inferior de un rango de empleados. Entiende "0", "De 1 a 5", "1 a 2", "Entre 3 y 5",
 * "Más de 5" (→ 6) y "10 o más" (→ 10). null si el texto no es un rango reconocible.
 */
export function limiteInferior(rango: string): number | null {
  const t = rango.trim().toLowerCase()
  const mas = /^m[aá]s de\s+(\d+)$/.exec(t)
  if (mas) return Number(mas[1]) + 1
  const omas = /^(\d+)\s+o\s+m[aá]s$/.exec(t)
  if (omas) return Number(omas[1])
  const entre = /^(?:de|entre)?\s*(\d+)\s*(?:a|y|-)\s*(\d+)$/.exec(t)
  if (entre) return Number(entre[1])
  const solo = /^(\d+)$/.exec(t)
  return solo ? Number(solo[1]) : null
}

/** Mínimo de empleos a partir de la distribución de "Empleados actuales" (la de `calcularIndicadores`). */
export function empleosMinimos(d: Distribucion): EmpleosMinimos {
  let minimo = 0
  let personas = 0
  let sinInterpretar = 0
  for (const { valor, conteo } of d.items) {
    const piso = limiteInferior(valor)
    if (piso === null) sinInterpretar += conteo
    else {
      minimo += piso * conteo
      personas += conteo
    }
  }
  return { minimo, personas, sinInterpretar }
}
