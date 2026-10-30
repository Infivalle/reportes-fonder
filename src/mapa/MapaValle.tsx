import { useId, useMemo, type KeyboardEvent } from 'react'
import { formatoEntero } from '../indicadores/formato'
import { claseDe, type ClaseColor, type ResumenMunicipio } from './datos'
import { GEOMETRIA_VALLE } from './geometriaValle'
import { VISTA_3D, cajaDeVista, matriz3D, puntosDeTrazado, sombraDe, textoMatriz, type ModoVista } from './proyeccion'
import './mapa.css'

const MATRIZ = textoMatriz(matriz3D())
const PUNTOS = GEOMETRIA_VALLE.flatMap((g) => puntosDeTrazado(g.d))
const CAJAS = { '3d': cajaDeVista(PUNTOS, '3d'), plana: cajaDeVista(PUNTOS, 'plana') } as const
const CLASES_DEGRADE = [0, 1, 2, 3, 4] as const
const PASOS_PARED = Array.from({ length: VISTA_3D.espesor }, (_, i) => i + 1)
/** Cuánto sube (en unidades del viewBox) el municipio elegido en la vista 3D. */
const ELEVACION = 7
const PASOS_ELEVACION = Array.from({ length: ELEVACION }, (_, i) => i)

interface Props {
  municipios: readonly ResumenMunicipio[]
  clases: readonly ClaseColor[]
  seleccionado: string | null
  vista: ModoVista
  onElegir: (codigo: string) => void
  /** Municipio bajo el cursor o con el foco (null al salir). */
  onActivo: (codigo: string | null) => void
}

/** Los ids de React traen símbolos que no valen dentro de `url(#…)`. */
const limpio = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '')

/**
 * Mapa del Valle por municipios. En 3D es una proyección oblicua con pared y sombra, hecha solo con
 * SVG (sin WebGL). Cada municipio es un botón: se elige con clic, toque o Enter/espacio.
 */
export function MapaValle({ municipios, clases, seleccionado, vista, onElegir, onActivo }: Props) {
  const id = limpio(useId())
  const idSilueta = `${id}-silueta`
  const idSombra = `${id}-sombra`
  const idPatron = `${id}-patron`
  const idDegrade = (i: number) => `${id}-degrade-${i}`
  const sombra = sombraDe(vista)
  const en3d = vista === '3d'
  const caja = CAJAS[vista]
  const porCodigo = useMemo(() => new Map(municipios.map((m) => [m.codigo, m])), [municipios])

  const dibujar = (codigo: string, d: string, elegido: boolean) => {
    const m = porCodigo.get(codigo)
    const n = m?.beneficiarios ?? 0
    const clase = claseDe(n, clases)
    const nombre = m?.nombre ?? codigo
    const teclas = (e: KeyboardEvent<SVGPathElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onElegir(codigo)
      }
    }
    return (
      <path
        key={codigo}
        d={d}
        className={`mapa__municipio mapa__clase-${clase ?? 'cero'}${elegido ? ' mapa__municipio--elegido' : ''}`}
        fill={clase === null ? `url(#${idPatron})` : `url(#${idDegrade(clase)})`}
        data-mapa-codigo={codigo}
        role="button"
        tabIndex={0}
        aria-pressed={elegido}
        aria-label={`${nombre}: ${formatoEntero(n)} ${n === 1 ? 'beneficiario' : 'beneficiarios'}`}
        onClick={() => onElegir(codigo)}
        onKeyDown={teclas}
        onMouseEnter={() => onActivo(codigo)}
        onMouseLeave={() => onActivo(null)}
        onFocus={() => onActivo(codigo)}
        onBlur={() => onActivo(null)}
      />
    )
  }

  const elegida = seleccionado === null ? undefined : GEOMETRIA_VALLE.find((g) => g.codigo === seleccionado)
  const resto = GEOMETRIA_VALLE.filter((g) => g.codigo !== seleccionado)
  const transformar = en3d ? MATRIZ : undefined

  return (
    <svg
      className={`mapa__svg${en3d ? ' mapa__svg--3d' : ''}`}
      viewBox={`${caja.x} ${caja.y} ${caja.ancho} ${caja.alto}`}
      role="group"
      aria-label="Mapa del Valle del Cauca: beneficiarios por municipio"
    >
      <defs>
        <g id={idSilueta}>
          {GEOMETRIA_VALLE.map((g) => (
            <path key={g.codigo} d={g.d} />
          ))}
        </g>
        <filter id={idSombra} x="-10%" y="-10%" width="125%" height="125%">
          <feGaussianBlur stdDeviation={sombra.difuminado} />
        </filter>
        {/* Degradé de cada tramo: más claro arriba a la izquierda, más oscuro abajo (el promedio es el color del tramo). */}
        {CLASES_DEGRADE.map((i) => (
          <linearGradient key={i} id={idDegrade(i)} x1="0" y1="0" x2="0.45" y2="1">
            <stop offset="0" className={`mapa__degrade-claro-${i}`} />
            <stop offset="1" className={`mapa__degrade-oscuro-${i}`} />
          </linearGradient>
        ))}
        <pattern id={idPatron} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="9" height="9" className="mapa__patron-fondo" />
          <line x1="0" y1="0" x2="0" y2="9" className="mapa__patron-raya" />
        </pattern>
      </defs>

      {/* Sombra proyectada: en las dos vistas. */}
      <g aria-hidden="true" transform={`translate(${sombra.dx} ${sombra.dy})`} filter={`url(#${idSombra})`}>
        <use href={`#${idSilueta}`} transform={transformar} className="mapa__sombra" />
      </g>

      {en3d && (
        <g aria-hidden="true">
          {PASOS_PARED.map((paso) => (
            <use key={paso} href={`#${idSilueta}`} transform={`translate(0 ${paso}) ${MATRIZ}`} className="mapa__pared" />
          ))}
        </g>
      )}

      <g transform={transformar}>{resto.map((g) => dibujar(g.codigo, g.d, false))}</g>

      {elegida !== undefined &&
        (en3d ? (
          <>
            {/* El municipio elegido "sube": se le dibuja su propia pared bajo la cara superior. */}
            <g aria-hidden="true">
              {PASOS_ELEVACION.map((paso) => (
                <path key={paso} d={elegida.d} className="mapa__pared" transform={`translate(0 ${-paso}) ${MATRIZ}`} />
              ))}
            </g>
            <g transform={`translate(0 ${-ELEVACION}) ${MATRIZ}`}>{dibujar(elegida.codigo, elegida.d, true)}</g>
          </>
        ) : (
          <g>{dibujar(elegida.codigo, elegida.d, true)}</g>
        ))}
    </svg>
  )
}

interface PropsLeyenda {
  clases: readonly ClaseColor[]
}

/** Leyenda de la escala: un tramo por color, más "Sin beneficiarios" (con rayas, no solo color). */
export function LeyendaMapa({ clases }: PropsLeyenda) {
  return (
    <ul className="mapa__leyenda" aria-label="Leyenda: beneficiarios por municipio">
      <li>
        <span className="mapa__muestra mapa__muestra--cero" aria-hidden="true" />
        Sin beneficiarios
      </li>
      {clases.map((c) => (
        <li key={c.indice}>
          <span className={`mapa__muestra mapa__muestra-${c.indice}`} aria-hidden="true" />
          {c.desde === c.hasta ? formatoEntero(c.desde) : `${formatoEntero(c.desde)} a ${formatoEntero(c.hasta)}`}
        </li>
      ))}
    </ul>
  )
}
