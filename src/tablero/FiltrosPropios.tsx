import { useId } from 'react'
import { CATALOGO, GRUPOS, buscarCampo } from '../catalogo/campos'
import { etiquetaCategoria, ordenarCategorias, valoresDe, type FiltrosCampo } from '../indicadores/consulta'
import type { FilaPublica } from '../publico/tipos'
import '../interfaz/estilos.css'

interface Props {
  /** Filas sobre las que se ofrecen los valores posibles. */
  filas: readonly FilaPublica[]
  filtros: FiltrosCampo
  onCambio: (nuevos: FiltrosCampo) => void
}

/** Campos por los que se puede filtrar una gráfica: todos los no numéricos. */
const FILTRABLES = CATALOGO.filter((c) => c.tipo !== 'numerico')

/** Filtros que valen solo para esta gráfica; se suman a los globales de la página. */
export function FiltrosPropios({ filas, filtros, onCambio }: Props) {
  const id = useId()
  const activos = Object.keys(filtros).filter((k) => (filtros[k]?.length ?? 0) > 0)
  const disponibles = FILTRABLES.filter((c) => !activos.includes(c.clave))

  const valoresDeCampo = (clave: string): string[] => {
    const campo = buscarCampo(clave)
    if (!campo) return []
    const cuenta = new Map<string, number>()
    for (const f of filas) for (const v of valoresDe(f, campo)) cuenta.set(v, (cuenta.get(v) ?? 0) + 1)
    // Los valores ya elegidos se conservan aunque ahora no haya filas con ellos.
    for (const v of filtros[clave] ?? []) if (!cuenta.has(v)) cuenta.set(v, 0)
    return ordenarCategorias(campo, cuenta)
  }
  const sin = (clave: string): FiltrosCampo => Object.fromEntries(Object.entries(filtros).filter(([k]) => k !== clave))

  const alternar = (clave: string, valor: string) => {
    const actuales = filtros[clave] ?? []
    const nuevos = actuales.includes(valor) ? actuales.filter((v) => v !== valor) : [...actuales, valor]
    onCambio(nuevos.length > 0 ? { ...sin(clave), [clave]: nuevos } : sin(clave))
  }
  // Un filtro sin ningún valor marcado no filtra nada: al agregarlo se parte del primer valor disponible.
  const agregar = (clave: string) => {
    const primero = valoresDeCampo(clave)[0]
    if (primero !== undefined) onCambio({ ...filtros, [clave]: [primero] })
  }

  return (
    <details className="filtros-propios" open={activos.length > 0}>
      <summary>Filtrar solo esta gráfica{activos.length > 0 ? ` (${activos.length})` : ''}</summary>
      <p className="filtros-propios__ayuda">Se suman a los filtros de arriba de la página.</p>

      {activos.map((clave) => {
        const campo = buscarCampo(clave)
        if (!campo) return null
        return (
          <fieldset key={clave} className="filtros-propios__campo">
            <legend>{campo.etiqueta}</legend>
            <div className="filtros-propios__opciones">
              {valoresDeCampo(clave).map((v) => (
                <label key={v} className="opcion">
                  <input type="checkbox" checked={(filtros[clave] ?? []).includes(v)} onChange={() => alternar(clave, v)} />
                  <span>{etiquetaCategoria(clave, v)}</span>
                </label>
              ))}
            </div>
            <button type="button" className="boton boton--texto" onClick={() => onCambio(sin(clave))}>
              Quitar filtro de {campo.etiqueta.toLowerCase()}
            </button>
          </fieldset>
        )
      })}

      {disponibles.length > 0 && (
        <div className="filtro">
          <label htmlFor={`${id}-nuevo`}>Agregar filtro por…</label>
          <select id={`${id}-nuevo`} value="" onChange={(e) => agregar(e.target.value)}>
            <option value="">Elija un campo</option>
            {(Object.keys(GRUPOS) as (keyof typeof GRUPOS)[]).map((g) => {
              const delGrupo = disponibles.filter((c) => c.grupo === g)
              return delGrupo.length === 0 ? null : (
                <optgroup key={g} label={GRUPOS[g]}>
                  {delGrupo.map((c) => (
                    <option key={c.clave} value={c.clave}>
                      {c.etiqueta}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>
      )}
    </details>
  )
}
