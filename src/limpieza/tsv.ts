/**
 * Lector mínimo de TSV generado con `mysql --batch`.
 *
 * - Separa por salto de línea y tabulador; NO usa parser CSV con comillas
 *   (hay un registro con un salto de línea suelto dentro de un campo).
 * - El texto `NULL` se convierte en null.
 *
 * Esta versión es el punto de partida de F1; la validación completa
 * (formatos v1/v2, tipos) se agrega allí.
 */
export type Fila = (string | null)[]

export function leerTsv(contenido: string): { encabezado: string[]; filas: Fila[] } {
  const lineas = contenido.replace(/\r\n/g, '\n').split('\n')
  // mysql --batch termina el archivo con un salto de línea: descartar el vacío final
  if (lineas.length > 0 && lineas[lineas.length - 1] === '') lineas.pop()

  const [cabecera, ...resto] = lineas
  const encabezado = cabecera === undefined ? [] : cabecera.split('\t')
  const filas = resto.map((linea) =>
    linea.split('\t').map((valor) => (valor === 'NULL' ? null : valor)),
  )
  return { encabezado, filas }
}
