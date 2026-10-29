import { forwardRef } from 'react'
import { UMBRAL_SUPRESION } from '../graficas/datos'
import { formatoEntero, formatoPorcentaje } from '../indicadores/formato'
import { Tarjeta, TablaDistribucion } from '../interfaz/Tarjeta'
import type { DetalleMunicipio, PorcentajeMunicipio } from './datos'
import './mapa.css'

interface Props {
  detalle: DetalleMunicipio
  /** Enlace a la pestaña Indicadores con este municipio filtrado; null si no tiene beneficiarios. */
  enlaceIndicadores: string | null
  onCerrar: () => void
}

function valorDe(p: PorcentajeMunicipio): string {
  if (p.oculto) return `Menos de ${UMBRAL_SUPRESION} respuestas`
  return formatoPorcentaje(p.valor)
}

/**
 * Detalle de un municipio. En pantalla ancha va al lado del mapa; en celular se abre desde abajo
 * (ver mapa.css). No es un diálogo modal: el mapa sigue disponible para comparar otro municipio.
 */
export const PanelMunicipio = forwardRef<HTMLElement, Props>(function PanelMunicipio({ detalle, enlaceIndicadores, onCerrar }, ref) {
  const d = detalle
  const vacio = d.beneficiarios === 0
  return (
    <aside ref={ref} tabIndex={-1} className="mapa-panel" aria-labelledby="titulo-municipio">
      <header className="mapa-panel__cabecera">
        <div>
          <h3 id="titulo-municipio" className="mapa-panel__titulo">
            {d.nombre}
          </h3>
          <p className="mapa-panel__codigo">Valle del Cauca · código {d.codigo}</p>
        </div>
        <button type="button" className="boton" onClick={onCerrar}>
          Cerrar
        </button>
      </header>

      {vacio ? (
        <p className="indicadores__vacio" role="status">
          Este municipio no tiene beneficiarios con asesoría con los filtros actuales.
        </p>
      ) : (
        <>
          <dl className="mapa-panel__cifras">
            <div>
              <dt>Beneficiarios</dt>
              <dd>{formatoEntero(d.beneficiarios)}</dd>
            </div>
            <div>
              <dt>Asesorías</dt>
              <dd>{formatoEntero(d.asesorias)}</dd>
            </div>
          </dl>

          <div className="mapa-panel__tarjetas">
            <Tarjeta tono="verde" titulo="Satisfacción" valor={valorDe(d.satisfaccion)} descripcion="Muy satisfechos o satisfechos." n={d.satisfaccion.n} />
            <Tarjeta tono="azul" titulo="Resultados esperados" valor={valorDe(d.resultados)} descripcion="Obtuvieron los resultados que esperaban." n={d.resultados.n} />
            <Tarjeta tono="ambar" titulo="Necesidad de nuevo crédito" valor={valorDe(d.nuevoCredito)} descripcion="Necesitan otro crédito." n={d.nuevoCredito.n} />
            <Tarjeta tono="turquesa" titulo="Por convocatoria" descripcion="Beneficiarios de este municipio en cada convocatoria." n={null}>
              <TablaDistribucion
                titulo="Beneficiarios por convocatoria"
                distribucion={{
                  n: d.beneficiarios,
                  items: d.porConvocatoria.map((c) => ({
                    valor: c.etiqueta,
                    conteo: c.beneficiarios,
                    porcentaje: (c.beneficiarios / d.beneficiarios) * 100,
                  })),
                }}
              />
            </Tarjeta>
          </div>

          {enlaceIndicadores !== null && (
            <a className="boton mapa-panel__enlace" href={enlaceIndicadores}>
              Ver todos los indicadores de {d.nombre}
            </a>
          )}
        </>
      )}
    </aside>
  )
})
