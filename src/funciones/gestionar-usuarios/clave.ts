/**
 * Contraseñas temporales. Cumplen la política del proyecto (mínimo 12 caracteres con minúscula,
 * mayúscula, número y símbolo) y evitan caracteres que se confunden al leerlos (0/O, 1/l/I).
 */
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz'
const MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const NUMEROS = '23456789'
const SIMBOLOS = '!#$%&*+-=?@'
const TODOS = MINUSCULAS + MAYUSCULAS + NUMEROS + SIMBOLOS

/** Entero uniforme en [0, n) sin sesgo (descarta los valores que no caben en un múltiplo de n). */
function entero(n: number): number {
  const limite = Math.floor(0x100000000 / n) * n
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    const v = buf[0] ?? 0
    if (v < limite) return v % n
  }
}

function letraDe(alfabeto: string): string {
  return alfabeto.charAt(entero(alfabeto.length))
}

export function generarClaveTemporal(largo = 20): string {
  if (largo < 12) throw new Error('El largo mínimo es 12')
  const letras = [letraDe(MINUSCULAS), letraDe(MAYUSCULAS), letraDe(NUMEROS), letraDe(SIMBOLOS)]
  while (letras.length < largo) letras.push(letraDe(TODOS))
  // Fisher–Yates para que las cuatro obligatorias no queden siempre al principio
  for (let i = letras.length - 1; i > 0; i -= 1) {
    const j = entero(i + 1)
    const a = letras[i] ?? ''
    letras[i] = letras[j] ?? ''
    letras[j] = a
  }
  return letras.join('')
}

/** Mensaje si la contraseña no cumple la política; null si cumple. */
export function validarClave(clave: string): string | null {
  if (clave.length < 12) return 'Debe tener al menos 12 caracteres.'
  if (!/[a-z]/.test(clave)) return 'Debe incluir una letra minúscula.'
  if (!/[A-Z]/.test(clave)) return 'Debe incluir una letra mayúscula.'
  if (!/[0-9]/.test(clave)) return 'Debe incluir un número.'
  if (!/[^A-Za-z0-9]/.test(clave)) return 'Debe incluir un símbolo (por ejemplo ! # $ % &).'
  return null
}
