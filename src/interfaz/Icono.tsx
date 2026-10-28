import type { CSSProperties } from 'react'
import './estilos.css'

export type NombreIcono = 'subir' | 'bajar' | 'ampliar' | 'editar' | 'duplicar' | 'quitar' | 'cerrar'

/** Carpeta (dentro de public/) con un SVG por icono: se cambia un icono reemplazando su archivo. */
const CARPETA_ICONOS = 'iconos/'

/**
 * Icono tomado de public/iconos/<nombre>.svg. Se pinta como máscara: toma el color del texto
 * (azul, gris al deshabilitar, etc.) sin importar el color con que venga dibujado el SVG.
 * Es decorativo: el botón que lo contiene lleva el nombre accesible.
 */
export function Icono({ nombre }: { nombre: NombreIcono }) {
  const estilo = { '--icono': `url(${import.meta.env.BASE_URL}${CARPETA_ICONOS}${nombre}.svg)` } as CSSProperties
  return <span className="icono" style={estilo} aria-hidden="true" />
}
