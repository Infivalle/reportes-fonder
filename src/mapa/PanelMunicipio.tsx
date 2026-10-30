import { forwardRef } from 'react'
import { UMBRAL_SUPRESION } from '../graficas/datos'
import { formatoEntero, formatoPorcentaje } from '../indicadores/formato'
import { Tarjeta, TablaDistribucion } from '../interfaz/Tarjeta'
import { Anillo } from './Anillo'
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

type Tono = 'azul' | 'turquesa' | 'verde' | 'ambar'

/** Tarjeta de un porcentaje: el valor a la izquierda y una barra de progreso a su lado. */
function TarjetaPorcentaje({ tono, titulo, descripcion, p }: { tono: Tono; titulo: string; descripcion: string; p: PorcentajeMunicipio }) {
  const valor = valorDe(p)
  return (
    <article className={`tarjeta tarjeta--${tono}`}>
      <h4 className="tarjeta__titulo">{titulo}</h4>
      <div className="mapa-fila">
        <p className="tarjeta__valor">{valor}</p>
        {p.valor !== null && (
          <div
            className="progreso mapa-fila__barra"
            role="meter"
            aria-label={titulo}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(p.valor)}
            aria-valuetext={valor}
          >
            <span className="progreso__relleno" style={{ width: `${Math.min(100, Math.max(0, p.valor))}%` }} />
          </div>
        )}
      </div>
      <p className="tarjeta__descripcion">{descripcion}</p>
      <p className="tarjeta__n">
        Basado en {formatoEntero(p.n)} {p.n === 1 ? 'respuesta' : 'respuestas'}
      </p>
    </article>
  )
}

function TarjetaCobertura({ d }: { d: DetalleMunicipio }) {
  const c = d.cobertura
  const atendidos = `${formatoEntero(d.beneficiarios)} ${d.beneficiarios === 1 ? 'beneficiario' : 'beneficiarios'}`
  if (c.estado === 'ok' && c.total !== null && c.porcentaje !== null) {
    const pct = formatoPorcentaje(c.porcentaje)
    return (
      <article className="tarjeta tarjeta--azul">
        <h4 className="tarjeta__titulo">Cobertura</h4>
        <div className="mapa-fila mapa-fila--anillo">
          <div>
            <p className="tarjeta__valor">
              {formatoEntero(d.beneficiarios)} de {formatoEntero(c.total)}
            </p>
            <p className="tarjeta__descripcion">Beneficiarios del municipio con asesoría.</p>
          </div>
          <Anillo porcentaje={c.porcentaje} etiqueta={`Cobertura: ${pct}`} texto={pct} />
        </div>
        {c.inconsistente && (
          <p className="tarjeta__aviso" role="note">
            Hay más beneficiarios atendidos que el total cargado: el total está desactualizado.
          </p>
        )}
      </article>
    )
  }
  return (
    <article className="tarjeta tarjeta--azul">
      <h4 className="tarjeta__titulo">Beneficiarios con asesoría</h4>
      <p className="tarjeta__valor">{formatoEntero(d.beneficiarios)}</p>
      <p className="tarjeta__descripcion">
        {c.estado === 'con_mes'
          ? `${atendidos} con los filtros actuales. La cobertura se calcula con todos los meses: quite el filtro de mes para verla.`
          : `${atendidos}. No hay un total de beneficiarios del municipio para esta selección, así que no se puede calcular la cobertura.`}
      </p>
    </article>
  )
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
        <>
          <p className="indicadores__vacio" role="status">
            Este municipio no tiene beneficiarios con asesoría con los filtros actuales.
          </p>
          {d.cobertura.estado === 'ok' && <TarjetaCobertura d={d} />}
        </>
      ) : (
        <>
          <div className="mapa-panel__tarjetas">
            <TarjetaCobertura d={d} />
            <TarjetaPorcentaje tono="verde" titulo="Satisfacción" descripcion="Muy satisfechos o satisfechos." p={d.satisfaccion} />
            <TarjetaPorcentaje tono="azul" titulo="Resultados esperados" descripcion="Obtuvieron los resultados que esperaban." p={d.resultados} />
            <TarjetaPorcentaje tono="ambar" titulo="Necesidad de nuevo crédito" descripcion="Necesitan otro crédito." p={d.nuevoCredito} />
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
