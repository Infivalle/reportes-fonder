/**
 * Guardado del tablero en el navegador (localStorage). Puede fallar o venir vacío (modo privado,
 * datos del sitio bloqueados, cuota llena): nada de esto debe romper la pantalla.
 */
import { leerTablero, serializarTablero, tableroInicial, type Tablero } from './modelo'

export const CLAVE_TABLERO = 'fonder:tablero'

/** Acceder a `window.localStorage` ya puede lanzar un error, por eso va dentro de try. */
function almacenamiento(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export interface Carga {
  tablero: Tablero
  /** Mensaje para la persona si lo guardado no se pudo usar; null si todo bien. */
  aviso: string | null
}

export function cargarTablero(): Carga {
  const memoria = almacenamiento()
  if (memoria === null) return { tablero: tableroInicial(), aviso: 'Este navegador no deja guardar sus gráficas: se perderán al cerrar la página. Puede exportarlas a un archivo.' }
  let texto: string | null
  try {
    texto = memoria.getItem(CLAVE_TABLERO)
  } catch {
    return { tablero: tableroInicial(), aviso: 'No se pudieron leer las gráficas guardadas en este navegador.' }
  }
  if (texto === null) return { tablero: tableroInicial(), aviso: null }
  const lectura = leerTablero(texto)
  if (!lectura.ok) return { tablero: tableroInicial(), aviso: 'Las gráficas guardadas en este navegador no se pudieron leer, así que se empezó de nuevo.' }
  return { tablero: lectura.tablero, aviso: null }
}

/** true si quedó guardado. */
export function guardarTablero(t: Tablero): boolean {
  const memoria = almacenamiento()
  if (memoria === null) return false
  try {
    memoria.setItem(CLAVE_TABLERO, serializarTablero(t))
    return true
  } catch {
    return false
  }
}
