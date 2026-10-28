/**
 * Marca del sitio: textos y logos del encabezado.
 * Los archivos de los logos van en `public/logos/` y aquí solo se anota su nombre y su texto
 * alternativo (lo que lee un lector de pantalla). Si la lista está vacía, no se muestra ninguno.
 */
export const TITULO_SITIO = 'Asesorías Fonder Valle'
export const SUBTITULO_SITIO = 'Seguimiento a los beneficiarios del programa'

export interface Logo {
  /** Nombre del archivo dentro de public/logos/, p. ej. "gobernacion.png". */
  archivo: string
  alt: string
}

export const LOGOS: readonly Logo[] = [
  { archivo: 'gobernacion.png', alt: 'Gobernación del Valle del Cauca' },
  { archivo: 'infivalle.png', alt: 'InfiValle, Instituto Financiero para el Desarrollo del Valle del Cauca' },
]
