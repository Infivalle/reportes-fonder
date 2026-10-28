/**
 * Normaliza texto para comparar: sin tildes, mayúsculas, solo letras y números,
 * espacios colapsados. "  Tuluá. " -> "TULUA"
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

/**
 * Deshace el escapado de `mysql --batch`: \n, \t, \0 y \\.
 * Se hace en una sola pasada para que "\\n" (barra + n escritas) no se confunda con un salto.
 */
export function desescaparMysql(texto: string): string {
  if (!texto.includes('\\')) return texto
  return texto.replace(/\\([ntr0\\])/g, (_, c: string) => {
    switch (c) {
      case 'n':
        return '\n'
      case 't':
        return '\t'
      case 'r':
        return '\r'
      case '0':
        return '\0'
      default:
        return '\\'
    }
  })
}
