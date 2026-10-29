/**
 * Vista 3D del mapa (opción A): proyección oblicua en SVG, sin WebGL.
 * El mapa plano se gira unos grados y se aplasta en vertical (como verlo inclinado); el "grosor" se
 * dibuja apilando copias de la silueta desplazadas hacia abajo. Como la transformación es afín, el
 * navegador sigue haciendo bien el clic y el toque sobre cada municipio.
 */

export type ModoVista = '3d' | 'plana'

export const VISTA_3D = {
  /** Giro en grados (negativo = antihorario). */
  giro: -14,
  /** Aplastamiento vertical: 1 = plano, menor = más inclinado. */
  escalaY: 0.6,
  /** Grosor de la pared, en unidades del viewBox (una copia de silueta por unidad). */
  espesor: 16,
  /** Desplazamiento de la sombra proyectada en el suelo. */
  sombra: { dx: 18, dy: 30, difuminado: 9 },
} as const

export interface Caja {
  x: number
  y: number
  ancho: number
  alto: number
}

/** Matriz SVG `matrix(a b c d 0 0)` de la vista 3D: primero el giro y después el aplastamiento vertical. */
export function matriz3D(giro: number = VISTA_3D.giro, escalaY: number = VISTA_3D.escalaY): [number, number, number, number] {
  const r = (giro * Math.PI) / 180
  const cos = Math.cos(r)
  const sen = Math.sin(r)
  return [cos, escalaY * sen, -sen, escalaY * cos]
}

export function textoMatriz(m: readonly [number, number, number, number]): string {
  return `matrix(${m.map((v) => Number(v.toFixed(5))).join(' ')} 0 0)`
}

export type Punto = readonly [number, number]

/** Vértices de un trazado generado por scripts/generar-geometria-valle.mjs (solo M absoluto, l relativo y z). */
export function puntosDeTrazado(d: string): Punto[] {
  const puntos: Punto[] = []
  let x = 0
  let y = 0
  for (const [, orden, args = ''] of d.matchAll(/([Mlz])([^Mlz]*)/g)) {
    if (orden === 'z') continue
    const [a = 0, b = 0] = args.trim().split(/\s+/).map(Number)
    if (orden === 'M') {
      x = a
      y = b
    } else {
      x += a
      y += b
    }
    puntos.push([x, y])
  }
  return puntos
}

/**
 * Caja (viewBox) que contiene el mapa en la vista pedida, con la pared, la sombra y un margen.
 * `puntos` son los vértices del mapa plano: la caja se ajusta a la forma real, no a su rectángulo.
 */
export function cajaDeVista(puntos: readonly Punto[], modo: ModoVista, margen = 12): Caja {
  const [a, b, c, d] = modo === '3d' ? matriz3D() : ([1, 0, 0, 1] as const)
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of puntos) {
    const px = a * x + c * y
    const py = b * x + d * y
    x0 = Math.min(x0, px)
    x1 = Math.max(x1, px)
    y0 = Math.min(y0, py)
    y1 = Math.max(y1, py)
  }
  const { sombra, espesor } = VISTA_3D
  const holgura = sombra.difuminado * 3
  const derecha = modo === '3d' ? Math.max(0, sombra.dx) + holgura : 0
  const abajo = modo === '3d' ? espesor + Math.max(0, sombra.dy) + holgura : 0
  const arriba = modo === '3d' ? 8 : 0 // el municipio elegido sube unas unidades
  const ax = Math.floor(x0 - margen)
  const ay = Math.floor(y0 - margen - arriba)
  return { x: ax, y: ay, ancho: Math.ceil(x1 + derecha + margen - ax), alto: Math.ceil(y1 + abajo + margen - ay) }
}
