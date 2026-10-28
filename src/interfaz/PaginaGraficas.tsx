import { useMemo, useState } from 'react'
import { aplicarFiltros } from '../indicadores/calcular'
import { formatoEntero } from '../indicadores/formato'
import { calcularGrafica } from '../graficas/datos'
import { Constructor } from '../graficas/Constructor'
import { CAMPO_INICIAL, nuevaDef, type GraficaDef } from '../graficas/definicion'
import { VistaGrafica } from '../graficas/VistaGrafica'
import type { PublicoJson } from '../publico/tipos'
import type { FiltrosGlobales } from './ruta'
import './estilos.css'

interface Props {
  datos: PublicoJson
  filtros: FiltrosGlobales
}

/** "Mis gráficas": el constructor y su vista previa, sobre los datos que dejan pasar los filtros globales. */
export function PaginaGraficas({ datos, filtros }: Props) {
  const [def, setDef] = useState<GraficaDef>(() => nuevaDef(CAMPO_INICIAL))
  const filas = useMemo(() => aplicarFiltros(datos.asesorias, filtros), [datos, filtros])
  const resultado = useMemo(() => calcularGrafica(filas, def), [filas, def])

  return (
    <section className="indicadores" aria-labelledby="titulo-graficas">
      <header className="indicadores__encabezado">
        <div>
          <h2 id="titulo-graficas">Mis gráficas</h2>
          <p className="indicadores__meta">
            Elija un campo y cómo verlo. Los filtros de arriba aplican a la gráfica: {formatoEntero(resultado.total)} beneficiarios con asesoría.
          </p>
        </div>
      </header>

      <div className="graficas">
        <Constructor def={def} onCambio={setDef} />
        <VistaGrafica datos={resultado} def={def} />
      </div>
    </section>
  )
}
