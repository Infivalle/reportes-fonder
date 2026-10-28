import { useMemo } from 'react'
import { calcularGrafica } from '../graficas/datos'
import { VistaGrafica } from '../graficas/VistaGrafica'
import { Icono, type NombreIcono } from '../interfaz/Icono'
import { filtrarPorCampos } from '../indicadores/consulta'
import type { FilaPublica } from '../publico/tipos'
import type { TarjetaTablero } from './modelo'
import { resumenFiltros } from './resumen'
import '../interfaz/estilos.css'

interface Props {
  tarjeta: TarjetaTablero
  /** Filas que dejan pasar los filtros globales. */
  filas: readonly FilaPublica[]
  primera: boolean
  ultima: boolean
  onEditar: () => void
  onDuplicar: () => void
  onQuitar: () => void
  onMover: (delta: -1 | 1) => void
  onAmpliar: () => void
}

/** Una gráfica del tablero con su barra de acciones. */
export function TarjetaGrafica({ tarjeta, filas, primera, ultima, onEditar, onDuplicar, onQuitar, onMover, onAmpliar }: Props) {
  const resultado = useMemo(() => calcularGrafica(filtrarPorCampos(filas, tarjeta.filtros), tarjeta.def), [filas, tarjeta])
  const nombre = resultado.titulo
  const resumen = resumenFiltros(tarjeta.filtros)

  const boton = (texto: string, icono: NombreIcono, onClick: () => void, inactivo = false) => (
    <button type="button" className="boton boton--icono" onClick={onClick} disabled={inactivo} aria-label={`${texto}: ${nombre}`} title={texto}>
      <Icono nombre={icono} />
    </button>
  )

  return (
    <li className="tablero__item">
      <VistaGrafica
        datos={resultado}
        def={tarjeta.def}
        compacta
        nota={resumen === '' ? null : <p className="grafica__filtros">Filtro propio — {resumen}</p>}
        acciones={
          <div className="tarjeta-acciones" role="group" aria-label={`Acciones de la gráfica ${nombre}`}>
            {boton('Mover antes', 'subir', () => onMover(-1), primera)}
            {boton('Mover después', 'bajar', () => onMover(1), ultima)}
            {boton('Ampliar', 'ampliar', onAmpliar)}
            {boton('Editar', 'editar', onEditar)}
            {boton('Duplicar', 'duplicar', onDuplicar)}
            {boton('Quitar', 'quitar', onQuitar)}
          </div>
        }
      />
    </li>
  )
}
