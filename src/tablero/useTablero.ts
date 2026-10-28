import { useCallback, useRef, useState } from 'react'
import type { FiltrosCampo } from '../indicadores/consulta'
import type { GraficaDef } from '../graficas/definicion'
import { cargarTablero, guardarTablero } from './almacen'
import {
  agregarTarjeta,
  duplicarTarjeta,
  moverTarjeta,
  nuevaTarjeta,
  quitarTarjeta,
  reemplazarTarjeta,
  type Tablero,
} from './modelo'

const AVISO_GUARDADO = 'No se pudieron guardar los cambios en este navegador. Exporte sus gráficas a un archivo para no perderlas.'

/** Estado del tablero con guardado automático en cada cambio. */
export function useTablero() {
  const [carga] = useState(cargarTablero)
  const [tablero, setTablero] = useState<Tablero>(carga.tablero)
  const [falloGuardado, setFalloGuardado] = useState(false)
  // Los cambios llegan de eventos, uno a la vez: la referencia siempre tiene el tablero vigente.
  const actual = useRef(carga.tablero)

  const cambiar = useCallback((transformar: (t: Tablero) => Tablero) => {
    const siguiente = transformar(actual.current)
    if (siguiente === actual.current) return
    actual.current = siguiente
    setTablero(siguiente)
    setFalloGuardado(!guardarTablero(siguiente))
  }, [])

  // Si la carga ya avisó de un problema, ese aviso explica la causa y no se pisa con el de guardado.
  const avisoAlmacen = carga.aviso ?? (falloGuardado ? AVISO_GUARDADO : null)

  return {
    tablero,
    avisoAlmacen,
    reemplazarTodo: useCallback((t: Tablero) => cambiar(() => t), [cambiar]),
    agregar: useCallback((def: GraficaDef, filtros: FiltrosCampo) => cambiar((t) => agregarTarjeta(t, nuevaTarjeta(def, filtros))), [cambiar]),
    reemplazar: useCallback((id: string, def: GraficaDef, filtros: FiltrosCampo) => cambiar((t) => reemplazarTarjeta(t, id, def, filtros)), [cambiar]),
    quitar: useCallback((id: string) => cambiar((t) => quitarTarjeta(t, id)), [cambiar]),
    duplicar: useCallback((id: string) => cambiar((t) => duplicarTarjeta(t, id)), [cambiar]),
    mover: useCallback((id: string, delta: -1 | 1) => cambiar((t) => moverTarjeta(t, id, delta)), [cambiar]),
  }
}
