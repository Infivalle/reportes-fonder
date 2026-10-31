import { useMemo, type ReactNode } from 'react'
import { buscarCampo } from '../catalogo/campos'
import { formatoEntero } from '../indicadores/formato'
import type { DatosGrafica } from './datos'
import type { GraficaDef } from './definicion'
import { Echarts } from './Echarts'
import { MAX_SERIES_LEGIBLES, altoGrafica, construirOpcion, recortarParaTarjeta } from './opcion'
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

/** Con más series que esto la tabla se pone de lado (un grupo por fila): 20 columnas no caben en una tarjeta. */
const MAX_COLUMNAS_TABLA = 6

/** Nombre del campo que define las series (los grupos de comparación). */
function encabezadoSeries(def: GraficaDef): string {
  const campo = buscarCampo(def.campo)
  const desglose = def.desglose === null ? undefined : buscarCampo(def.desglose)
  if (def.grafica === 'apilada_100') return campo?.etiqueta ?? 'Serie'
  return desglose?.etiqueta ?? 'Serie'
}

function Tabla({ datos, def }: { datos: DatosGrafica; def: GraficaDef }) {
  const deLado = datos.series.length > MAX_COLUMNAS_TABLA
  return (
    // Un contenedor propio con desplazamiento: una tabla ancha no debe romper la tarjeta ni la ventana ampliada.
    <div className="grafica__tabla" tabIndex={0} role="region" aria-label={`Tabla de datos: ${datos.titulo}`}>
      <table className="tabla-datos">
        <caption className="solo-lectores">{datos.titulo}</caption>
        {deLado ? (
          <>
            <thead>
              <tr>
                <th scope="col">{encabezadoSeries(def)}</th>
                {datos.categorias.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.series.map((s) => (
                <tr key={s.nombre}>
                  <th scope="row">{s.nombre}</th>
                  {datos.categorias.map((c, i) => (
                    <td key={c}>{s.celdas[i]?.texto ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </>
        ) : (
          <>
            <thead>
              <tr>
                <th scope="col">{encabezadoFilas(def)}</th>
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
          </>
        )}
      </table>
    </div>
  )
}

/** Aviso breve de la tarjeta compacta: por qué falta algo en el dibujo y dónde verlo. */
function textoAyuda(datos: DatosGrafica, def: GraficaDef, ocultas: number): string {
  if (def.grafica === 'dona') return 'Las porciones pequeñas no llevan etiqueta: pase el cursor, amplíe la gráfica o abra la tabla.'
  const partes: string[] = []
  if (ocultas > 0) {
    partes.push(`Se muestran las ${formatoEntero(datos.categorias.length - ocultas)} con más respuestas de ${formatoEntero(datos.categorias.length)}: amplíe la gráfica o abra la tabla para ver todas.`)
  }
  if (datos.series.length > MAX_SERIES_LEGIBLES) {
    partes.push('Con tantos grupos no caben la leyenda ni las cifras: pase el cursor sobre las barras, amplíe la gráfica o abra la tabla.')
  }
  return partes.join(' ')
}

/** Una gráfica con su base (n), avisos, y siempre una tabla con los mismos datos. */
export function VistaGrafica({ datos, def, compacta = false, acciones, nota }: Props) {
  const opcion = useMemo(() => construirOpcion(datos, def, compacta), [datos, def, compacta])
  const ocultas = recortarParaTarjeta(datos, def, compacta).ocultas
  const ayuda = textoAyuda(datos, def, ocultas)
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

      {/* Siempre ocupa su sitio en la tarjeta (aunque vaya vacío): así todas las tarjetas miden lo mismo. */}
      {compacta && opcion !== null && <p className="grafica__ayuda">{ayuda}</p>}

      {resumen !== null && <p className="grafica__resumen">{resumen}</p>}

      {!sinDatos &&
        (def.grafica === 'tabla' ? (
          <Tabla datos={datos} def={def} />
        ) : (
          <details className="grafica__detalle">
            <summary>Ver los datos en una tabla</summary>
            <Tabla datos={datos} def={def} />
          </details>
        ))}
    </figure>
  )
}
