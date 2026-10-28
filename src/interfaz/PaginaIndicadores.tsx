import { usePublico } from './usePublico'
import { VistaIndicadores } from './VistaIndicadores'

/** Página de inicio: carga publico.json y muestra los indicadores. */
export function PaginaIndicadores() {
  const publico = usePublico()

  if (publico.estado === 'cargando') return <p role="status">Cargando indicadores…</p>
  if (publico.estado === 'error') {
    return (
      <p role="alert">No se pudieron cargar los datos ({publico.mensaje}). Intente de nuevo en unos minutos.</p>
    )
  }
  if (publico.estado === 'vacio') {
    return <p role="status">Todavía no hay datos publicados. {publico.motivo}</p>
  }
  return <VistaIndicadores datos={publico.datos} />
}
