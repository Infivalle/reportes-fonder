/**
 * Generación de empleo declarada. El formulario NO registra cuántos empleos se generaron: solo si el
 * beneficiario marcó "Generación de empleo" entre las mejoras logradas con el crédito. Por eso el
 * indicador cuenta beneficiarios, nunca empleos. (La pregunta "Empleados actuales" es un rango del
 * total de empleados, no de los generados.)
 */
import type { Distribucion } from './calcular'

export interface GeneracionEmpleo {
  /** Beneficiarios que marcaron "Generación de empleo". */
  conteo: number
  /** Sobre quienes respondieron la pregunta de mejoras (0 a 100); null si nadie respondió. */
  porcentaje: number | null
  /** Beneficiarios que respondieron la pregunta de mejoras. */
  n: number
}

const esEmpleo = (valor: string) => valor.toLowerCase().includes('empleo')

/** A partir de la distribución del destino del crédito (la de `calcularIndicadores`). */
export function generacionDeEmpleo(destino: Distribucion): GeneracionEmpleo {
  const item = destino.items.find((i) => esEmpleo(i.valor))
  const conteo = item?.conteo ?? 0
  return { conteo, porcentaje: destino.n === 0 ? null : (conteo / destino.n) * 100, n: destino.n }
}
