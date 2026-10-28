import { useMemo, useState } from 'react'
import { calcularGrafica } from '../graficas/datos'
import { Constructor } from '../graficas/Constructor'
import { CAMPO_INICIAL, nuevaDef, type GraficaDef } from '../graficas/definicion'
import { VistaGrafica } from '../graficas/VistaGrafica'
import { filtrarPorCampos, type FiltrosCampo } from '../indicadores/consulta'
import type { FilaPublica } from '../publico/tipos'
import { FiltrosPropios } from './FiltrosPropios'
import { Panel } from './Panel'
import { resumenFiltros } from './resumen'
import '../interfaz/estilos.css'

interface Props {
  /** null = gráfica nueva. */
  inicial: { def: GraficaDef; filtros: FiltrosCampo } | null
  /** Filas que dejan pasar los filtros globales. */
  filas: readonly FilaPublica[]
  onGuardar: (def: GraficaDef, filtros: FiltrosCampo) => void
  onCerrar: () => void
}

/** Panel lateral para crear o editar una gráfica del tablero, con vista previa. */
export function PanelEdicion({ inicial, filas, onGuardar, onCerrar }: Props) {
  const [def, setDef] = useState<GraficaDef>(inicial?.def ?? nuevaDef(CAMPO_INICIAL))
  const [filtros, setFiltros] = useState<FiltrosCampo>(inicial?.filtros ?? {})
  const filasGrafica = useMemo(() => filtrarPorCampos(filas, filtros), [filas, filtros])
  const resultado = useMemo(() => calcularGrafica(filasGrafica, def), [filasGrafica, def])
  const resumen = resumenFiltros(filtros)

  return (
    <Panel
      variante="lateral"
      titulo={inicial === null ? 'Agregar gráfica' : 'Editar gráfica'}
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="boton boton--primario" onClick={() => onGuardar(def, filtros)}>
            {inicial === null ? 'Agregar al tablero' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <Constructor def={def} onCambio={setDef} />
      <FiltrosPropios filas={filas} filtros={filtros} onCambio={setFiltros} />
      <h3 className="panel__subtitulo">Vista previa</h3>
      <VistaGrafica
        datos={resultado}
        def={def}
        compacta
        nota={resumen === '' ? null : <p className="grafica__filtros">Filtro propio — {resumen}</p>}
      />
    </Panel>
  )
}
