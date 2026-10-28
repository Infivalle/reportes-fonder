import { RUTAS, construirHash, type FiltrosGlobales, type Ruta } from './ruta'
import './estilos.css'

interface Props {
  activa: Ruta
  /** Los filtros viajan de una sección a otra: los enlaces los conservan. */
  filtros: FiltrosGlobales
}

/** Pestañas del sitio. Son enlaces reales (funcionan con teclado, clic central y "copiar enlace"). */
export function Navegacion({ activa, filtros }: Props) {
  return (
    <nav className="navegacion" aria-label="Secciones del sitio">
      <ul className="navegacion__lista">
        {RUTAS.map((r) => (
          <li key={r.ruta}>
            <a
              className={`navegacion__enlace${r.ruta === activa ? ' navegacion__enlace--activo' : ''}`}
              href={construirHash(r.ruta, filtros)}
              aria-current={r.ruta === activa ? 'page' : undefined}
            >
              {r.etiqueta}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
