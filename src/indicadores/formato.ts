/** Formato de cifras para español de Colombia: punto de miles, coma decimal. Determinista (sin ICU). */

function agruparMiles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function formatoEntero(n: number): string {
  const signo = n < 0 ? '-' : ''
  return signo + agruparMiles(Math.abs(Math.round(n)).toString())
}

/** 97 → "97 %"; 97.34 → "97,3 %". Un decimal solo si hace falta. */
export function formatoPorcentaje(valor: number | null): string {
  if (valor === null) return 'Sin dato'
  const redondeado = Math.round(valor * 10) / 10
  const texto = Number.isInteger(redondeado)
    ? agruparMiles(redondeado.toString())
    : agruparMiles(Math.trunc(redondeado).toString()) + ',' + redondeado.toFixed(1).split('.')[1]
  return `${texto} %`
}

/** "27 de octubre de 2026" en hora de Colombia; null si no hay fecha. */
export function formatoFecha(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' }).format(d)
}
