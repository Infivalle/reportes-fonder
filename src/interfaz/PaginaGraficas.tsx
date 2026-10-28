import type { PublicoJson } from '../publico/tipos'
import type { FiltrosGlobales } from './ruta'
import './estilos.css'

interface Props {
  datos: PublicoJson
  filtros: FiltrosGlobales
}

/** Constructor de gráficas (entrega 2b). Por ahora reserva la sección y conserva los filtros. */
export function PaginaGraficas({ datos, filtros }: Props) {
  void datos
  void filtros
  return (
    <section className="indicadores" aria-labelledby="titulo-graficas">
      <h2 id="titulo-graficas">Mis gráficas</h2>
      <p className="indicadores__vacio" role="status">
        Aquí podrá armar sus propias gráficas con los datos de las asesorías. Esta sección está en construcción.
      </p>
    </section>
  )
}
