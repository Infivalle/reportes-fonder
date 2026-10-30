import { useId, useMemo, useState } from 'react'
import { formatoEntero } from '../indicadores/formato'
import { ordenarMunicipios, type OrdenLista, type ResumenMunicipio } from './datos'
import './mapa.css'

interface Props {
  municipios: readonly ResumenMunicipio[]
  seleccionado: string | null
  maximo: number
  /** Beneficiarios sin municipio del Valle; se muestra al pie, no se puede elegir. */
  sinUbicar: number
  total: number
  onElegir: (codigo: string) => void
}

/** Id del contenedor de la tabla: la página lo usa para llevar el foco desde el mapa. */
export const ID_TABLA_MUNICIPIOS = 'lista-municipios-tabla'

const COLUMNAS: { clave: OrdenLista; etiqueta: string }[] = [
  { clave: 'nombre', etiqueta: 'Municipio' },
  { clave: 'beneficiarios', etiqueta: 'Beneficiarios' },
]

/**
 * Lista ordenable de los 42 municipios. Es la forma cómoda de elegir un municipio pequeño en el
 * celular y la alternativa completa al mapa para quien usa lector de pantalla o teclado.
 */
export function ListaMunicipios({ municipios, seleccionado, maximo, sinUbicar, total, onElegir }: Props) {
  const titulo = useId()
  const [orden, setOrden] = useState<{ por: OrdenLista; ascendente: boolean }>({ por: 'beneficiarios', ascendente: false })
  const filas = useMemo(() => ordenarMunicipios(municipios, orden.por, orden.ascendente), [municipios, orden])

  const ordenarPor = (por: OrdenLista) =>
    setOrden((o) => (o.por === por ? { por, ascendente: !o.ascendente } : { por, ascendente: por === 'nombre' }))

  return (
    <section className="lista-municipios" aria-labelledby={titulo}>
      <h3 id={titulo} className="seccion__titulo">
        Municipios
      </h3>
      <div id={ID_TABLA_MUNICIPIOS} className="lista-municipios__tabla" tabIndex={0} role="region" aria-labelledby={titulo}>
        <table className="tabla-datos">
          <thead>
            <tr>
              {COLUMNAS.map((c) => {
                const activa = orden.por === c.clave
                return (
                  <th key={c.clave} scope="col" aria-sort={activa ? (orden.ascendente ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="lista-municipios__orden" onClick={() => ordenarPor(c.clave)}>
                      {c.etiqueta}
                      <span aria-hidden="true" className="lista-municipios__flecha">
                        {activa ? (orden.ascendente ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filas.map((m) => (
              <tr key={m.codigo} className={m.codigo === seleccionado ? 'lista-municipios__fila--elegida' : undefined}>
                <th scope="row">
                  <button
                    type="button"
                    className="lista-municipios__nombre"
                    data-lista-codigo={m.codigo}
                    aria-pressed={m.codigo === seleccionado}
                    onClick={() => onElegir(m.codigo)}
                  >
                    {m.nombre}
                  </button>
                </th>
                <td>
                  <span className="lista-municipios__valor">
                    <span
                      className="lista-municipios__barra"
                      aria-hidden="true"
                      style={{ width: `${maximo === 0 ? 0 : (m.beneficiarios / maximo) * 100}%` }}
                    />
                    {formatoEntero(m.beneficiarios)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {sinUbicar > 0 && (
              <tr>
                <th scope="row">Sin ubicar en un municipio del Valle</th>
                <td>{formatoEntero(sinUbicar)}</td>
              </tr>
            )}
            <tr>
              <th scope="row">Total de beneficiarios</th>
              <td>{formatoEntero(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
