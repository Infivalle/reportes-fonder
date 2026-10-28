import { buscarCampo } from '../catalogo/campos'
import { etiquetaCategoria, type FiltrosCampo } from '../indicadores/consulta'

/** "Convocatoria: Primera convocatoria · Municipio: 3 opciones"; '' si no hay filtros propios. */
export function resumenFiltros(filtros: FiltrosCampo): string {
  return Object.entries(filtros)
    .filter(([, vs]) => vs.length > 0)
    .map(([clave, vs]) => {
      const nombre = buscarCampo(clave)?.etiqueta ?? clave
      const texto = vs.length === 1 ? etiquetaCategoria(clave, vs[0] ?? '') : `${vs.length} opciones`
      return `${nombre}: ${texto}`
    })
    .join(' · ')
}
