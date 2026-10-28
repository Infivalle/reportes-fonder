import { useEffect, useState } from 'react'
import type { PublicoJson, PublicoVacio } from '../publico/tipos'

export type EstadoPublico =
  | { estado: 'cargando' }
  | { estado: 'error'; mensaje: string }
  | { estado: 'vacio'; motivo: string }
  | { estado: 'listo'; datos: PublicoJson }

function esVacio(x: PublicoJson | PublicoVacio): x is PublicoVacio {
  return 'vacio' in x && x.vacio === true
}

/** Lee publico.json, el único origen de datos de la capa pública (no depende de Supabase). */
export function usePublico(url: string = `${import.meta.env.BASE_URL}publico.json`): EstadoPublico {
  const [estado, setEstado] = useState<EstadoPublico>({ estado: 'cargando' })

  useEffect(() => {
    const control = new AbortController()
    fetch(url, { signal: control.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<PublicoJson | PublicoVacio>
      })
      .then((json) => setEstado(esVacio(json) ? { estado: 'vacio', motivo: json.motivo } : { estado: 'listo', datos: json }))
      .catch((e: unknown) => {
        if (control.signal.aborted) return
        setEstado({ estado: 'error', mensaje: e instanceof Error ? e.message : 'Error desconocido' })
      })
    return () => control.abort()
  }, [url])

  return estado
}
