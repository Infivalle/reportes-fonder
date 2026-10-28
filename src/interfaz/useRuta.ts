import { useMemo, useSyncExternalStore } from 'react'
import { leerHash, type EstadoRuta } from './ruta'

const oyentes = new Set<() => void>()

function suscribir(aviso: () => void): () => void {
  oyentes.add(aviso)
  window.addEventListener('hashchange', aviso)
  return () => {
    oyentes.delete(aviso)
    window.removeEventListener('hashchange', aviso)
  }
}

const instantanea = (): string => window.location.hash

/**
 * Cambia el hash. Con `reemplazar` no agrega una entrada al historial (los cambios de filtro no
 * deben llenar el botón "atrás"); `replaceState` no dispara `hashchange`, por eso se avisa a mano.
 */
export function irA(hash: string, reemplazar = false): void {
  if (reemplazar) {
    window.history.replaceState(null, '', hash)
    oyentes.forEach((f) => f())
  } else {
    window.location.hash = hash
  }
}

/** Ruta y filtros leídos del `#` de la URL; se actualiza con el botón atrás y con los enlaces. */
export function useRuta(): EstadoRuta {
  const hash = useSyncExternalStore(suscribir, instantanea, () => '')
  return useMemo(() => leerHash(hash), [hash])
}
