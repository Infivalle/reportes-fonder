import { lazy, Suspense, useMemo } from 'react'
import { BarraFiltros } from './BarraFiltros'
import { Encabezado } from './Encabezado'
import { Navegacion } from './Navegacion'
import { VistaIndicadores } from './VistaIndicadores'
import { construirHash, opcionesDe, sanearFiltros, type FiltrosGlobales } from './ruta'
import { irA, useRuta } from './useRuta'
import { usePublico } from './usePublico'
import './estilos.css'

// ECharts pesa bastante: solo se descarga al abrir "Mis gráficas" y los indicadores cargan sin él.
const PaginaGraficas = lazy(() => import('./PaginaGraficas').then((m) => ({ default: m.PaginaGraficas })))

interface Props {
  /** Otra dirección de publico.json (pruebas); por defecto la del sitio. */
  url?: string
}

/** Sitio completo: encabezado, pestañas, filtros globales y la sección activa. */
export function Aplicacion({ url }: Props) {
  const publico = usePublico(url)
  const { ruta, filtros: filtrosUrl } = useRuta()

  const datos = publico.estado === 'listo' ? publico.datos : null
  const opciones = useMemo(() => (datos === null ? null : opcionesDe(datos)), [datos])
  // Un enlace con un filtro que ya no existe en los datos no deja la pantalla vacía: se ignora.
  const filtros = useMemo(() => (opciones === null ? filtrosUrl : sanearFiltros(filtrosUrl, opciones)), [filtrosUrl, opciones])

  const cambiarFiltros = (nuevos: FiltrosGlobales) => irA(construirHash(ruta, nuevos), true)

  return (
    <>
      <Encabezado />
      <Navegacion activa={ruta} filtros={filtros} />
      <main id="contenido" className="contenido">
        {publico.estado === 'cargando' && <p role="status">Cargando indicadores…</p>}
        {publico.estado === 'error' && (
          <p role="alert">No se pudieron cargar los datos ({publico.mensaje}). Intente de nuevo en unos minutos.</p>
        )}
        {publico.estado === 'vacio' && <p role="status">Todavía no hay datos publicados. {publico.motivo}</p>}
        {datos !== null && opciones !== null && (
          <>
            <BarraFiltros opciones={opciones} filtros={filtros} onCambio={cambiarFiltros} />
            {ruta === 'indicadores' ? (
              <VistaIndicadores datos={datos} filtros={filtros} />
            ) : (
              <Suspense fallback={<p role="status">Cargando gráficas…</p>}>
                <PaginaGraficas datos={datos} filtros={filtros} />
              </Suspense>
            )}
          </>
        )}
      </main>
    </>
  )
}
