export const VENTANA_DUPLICADO_DIAS = 30
const VENTANA_MS = VENTANA_DUPLICADO_DIAS * 24 * 60 * 60 * 1000

export interface EntradaDuplicado {
  id: number
  beneficiarioId: number
  /** Instante ISO UTC. */
  creadaEn: string
}

export interface DecisionDuplicado {
  conservada: boolean
  motivoDescarte: string | null
}

/**
 * Regla de duplicados: por beneficiario, ordenando por fecha e id, se conserva el primer
 * registro y se descarta todo registro a menos de 30 días del último conservado.
 * Los descartados no se borran: quedan marcados con el motivo.
 *
 * Devuelve un mapa id de asesoría -> decisión.
 */
export function decidirDuplicados(entradas: readonly EntradaDuplicado[]): Map<number, DecisionDuplicado> {
  const porBeneficiario = new Map<number, EntradaDuplicado[]>()
  for (const e of entradas) {
    const lista = porBeneficiario.get(e.beneficiarioId)
    if (lista === undefined) porBeneficiario.set(e.beneficiarioId, [e])
    else lista.push(e)
  }

  const decisiones = new Map<number, DecisionDuplicado>()
  for (const lista of porBeneficiario.values()) {
    lista.sort((a, b) => Date.parse(a.creadaEn) - Date.parse(b.creadaEn) || a.id - b.id)

    let ultimaConservada: EntradaDuplicado | null = null
    for (const e of lista) {
      if (
        ultimaConservada !== null &&
        Date.parse(e.creadaEn) - Date.parse(ultimaConservada.creadaEn) < VENTANA_MS
      ) {
        decisiones.set(e.id, {
          conservada: false,
          motivoDescarte: `duplicado: a menos de ${VENTANA_DUPLICADO_DIAS} días de la asesoría ${ultimaConservada.id}`,
        })
      } else {
        decisiones.set(e.id, { conservada: true, motivoDescarte: null })
        ultimaConservada = e
      }
    }
  }
  return decisiones
}
