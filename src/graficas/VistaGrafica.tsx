import { useMemo, type ReactNode } from 'react'
import { buscarCampo } from '../catalogo/campos'
import { formatoEntero } from '../indicadores/formato'
import type { DatosGrafica } from './datos'
import type { GraficaDef } from './definicion'
import { Echarts } from './Echarts'
import { altoGrafica, construirOpcion } from './opcion'
import '../interfaz/estilos.css'

interface Props {
  datos: DatosGrafica
  def: GraficaDef
  /** Altura reducida, para las tarjetas del tablero. */
  compacta?: boolean
  /** Botones junto al título (editar, quitar…): los pone el tablero. */
  acciones?: ReactNode
  /** Una línea bajo la base, p. ej. los filtros propios de la gráfica. */
  nota?: ReactNode
}

const NOMBRE_MEDIDA: Record<GraficaDef['medida'], string> = {
  conteo: 'Conteo',
  porcentaje: 'Porcentaje',
  promedio: 'Promedio',
  mediana: 'Mediana',
  minimo: 'Mínimo',
  maximo: 'Máximo',
}

/** Nombre del campo que define las filas de la tabla (la primera columna). */
function encabezadoFilas(def: GraficaDef): string {
  const campo = buscarCampo(def.campo)
  const desglose = def.desglose === null ? undefined : buscarCampo(def.desglose)
  const filasPorDesglose = def.grafica === 'apilada_100' || campo?.tipo === 'numerico'
  if (filasPorDesglose && desglose) return desglose.etiqueta
  if (def.grafica === 'apilada_100') return 'Grupo'
  return campo?.etiqueta ?? 'Categoría'
}

function Tabla({ datos, def, visible }: { datos: DatosGrafica; def: GraficaDef; visible: boolean }) {
  const etiquetaFilas = encabezadoFilas(def)
  return (
    <div className={visible ? 'grafica__tabla' : undefined}>
      <table className="tabla-datos">
        <caption className="solo-lectores">{datos.titulo}</caption>
        <thead>
          <tr>
            <th scope="col">{etiquetaFilas}</th>
            {datos.series.map((s) => (
              <th key={s.nombre} scope="col">
                {s.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.categorias.map((c, i) => (
            <tr key={c}>
              <th scope="row">{c}</th>
              {datos.series.map((s) => (
                <td key={s.nombre}>{s.celdas[i]?.texto ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Una gráfica con su base (n), avisos, y siempre una tabla con los mismos datos. */
export function VistaGrafica({ datos, def, compacta = false, acciones, nota }: Props) {
  const opcion = useMemo(() => construirOpcion(datos, def), [datos, def])
  const sinDatos = datos.series.length === 0 || datos.categorias.length === 0
  const r = datos.resumen
  const resumen = r && r.n > 0
    ? `${NOMBRE_MEDIDA.promedio}: ${r.promedio?.toFixed(1).replace('.', ',')} % · ${NOMBRE_MEDIDA.mediana}: ${r.mediana?.toFixed(1).replace('.', ',')} % · ${NOMBRE_MEDIDA.minimo}: ${r.minimo?.toFixed(1).replace('.', ',')} % · ${NOMBRE_MEDIDA.maximo}: ${r.maximo?.toFixed(1).replace('.', ',')} %`
    : null

  return (
    <figure className={compacta ? 'grafica grafica--compacta' : 'grafica'} aria-label={datos.titulo}>
      <figcaption>
        <div className="grafica__cabecera">
          <h3 className="grafica__titulo">{datos.titulo}</h3>
          {acciones}
        </div>
        <p className="grafica__base">
          Base: {formatoEntero(datos.base)} {datos.base === 1 ? 'beneficiario con respuesta' : 'beneficiarios con respuesta'} de{' '}
          {formatoEntero(datos.total)}.
        </p>
        {nota}
      </figcaption>

      {datos.avisos.map((a) => (
        <p key={a} className="tarjeta__aviso" role="note">
          {a}
        </p>
      ))}

      {sinDatos && datos.avisos.length === 0 && (
        <p className="indicadores__vacio" role="status">
          No hay respuestas para esta combinación de campo y filtros.
        </p>
      )}

      {opcion !== null && <Echarts opcion={opcion} alto={altoGrafica(datos, def, compacta)} etiqueta={`Gráfica: ${datos.titulo}`} />}

      {resumen !== null && <p className="grafica__resumen">{resumen}</p>}

      {!sinDatos &&
        (def.grafica === 'tabla' ? (
          <Tabla datos={datos} def={def} visible />
        ) : (
          <details className="grafica__detalle">
            <summary>Ver los datos en una tabla</summary>
            <Tabla datos={datos} def={def} visible={false} />
          </details>
        ))}
    </figure>
  )
}
