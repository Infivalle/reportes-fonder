import { useId } from 'react'
import { SIN_FILTROS_GLOBALES, hayFiltros, type FiltrosGlobales, type OpcionesFiltro } from './ruta'
import './estilos.css'

interface Props {
  opciones: OpcionesFiltro
  filtros: FiltrosGlobales
  onCambio: (nuevos: FiltrosGlobales) => void
}

const TODOS = ''

/** Filtros globales: convocatoria, municipio y mes. Afectan a todas las secciones. */
export function BarraFiltros({ opciones, filtros, onCambio }: Props) {
  const id = useId()
  const cambiar = (campo: keyof FiltrosGlobales, valor: string) =>
    onCambio({ ...filtros, [campo]: valor === TODOS ? null : valor })

  return (
    <section className="barra-filtros" aria-label="Filtros">
      <div className="filtro">
        <label htmlFor={`${id}-conv`}>Convocatoria</label>
        <select id={`${id}-conv`} value={filtros.proyecto ?? TODOS} onChange={(e) => cambiar('proyecto', e.target.value)}>
          <option value={TODOS}>Todas las convocatorias</option>
          {opciones.proyectos.map((p) => (
            <option key={p.clave} value={p.clave}>
              {p.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div className="filtro">
        <label htmlFor={`${id}-mun`}>Municipio</label>
        <select id={`${id}-mun`} value={filtros.municipio ?? TODOS} onChange={(e) => cambiar('municipio', e.target.value)}>
          <option value={TODOS}>Todos los municipios</option>
          {opciones.municipios.map((m) => (
            <option key={m.codigo} value={m.codigo}>
              {m.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="filtro">
        <label htmlFor={`${id}-mes`}>Mes de la asesoría</label>
        <select id={`${id}-mes`} value={filtros.mes ?? TODOS} onChange={(e) => cambiar('mes', e.target.value)}>
          <option value={TODOS}>Todos los meses</option>
          {opciones.meses.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.etiqueta}
            </option>
          ))}
        </select>
      </div>

      {hayFiltros(filtros) && (
        <button type="button" className="barra-filtros__limpiar" onClick={() => onCambio(SIN_FILTROS_GLOBALES)}>
          Quitar filtros
        </button>
      )}
    </section>
  )
}
