/**
 * Cruce de la cartera Fonder (Excel) con las asesorías registradas.
 * Lógica pura y sin dependencias del navegador: se prueba sola.
 *
 * Reglas (iguales a la documentación de `cruce_excel_vs_asesorias_vN.xlsx`):
 *  - Llave: cédula del Excel = documento de la base, como texto sin espacios al inicio ni al final.
 *    No se quitan puntos, ceros a la izquierda ni dígitos de verificación. No se cruza por NIT.
 *  - "Tiene asesoría" = la cédula aparece al menos una vez entre las asesorías.
 *  - No se eliminan duplicados: `N° registros` cuenta todas las filas de esa cédula (conservadas
 *    y descartadas).
 *  - Las tablas por estado y por año cuentan filas del Excel, no cédulas distintas.
 */

export interface FilaCartera {
  /** Texto ya recortado; '' si la fila no trae cédula. */
  cedula: string
  nombre: string
  anio: number | null
  estado: string
  municipio: string
  equipo: string
}

export interface AsesoriaCruce {
  documento: string
  /** ISO 8601 (UTC). */
  creadaEn: string
}

export interface BeneficiarioCruce {
  documento: string
  nombres: string | null
  apellidos: string | null
}

export interface FilaCruce extends FilaCartera {
  tieneAsesoria: boolean
  registros: number
  /** 'AAAA-MM-DD HH:mm:ss' en UTC, o null. */
  primera: string | null
  ultima: string | null
}

export interface SinMatch {
  documento: string
  nombre: string
  registros: number
}

export interface ConteoGrupo {
  grupo: string | number
  filas: number
  conAsesoria: number
  /** Proporción redondeada a 3 decimales (0,488), como en el archivo de referencia. */
  proporcion: number
}

export interface ResultadoCruce {
  filas: FilaCruce[]
  filasExcel: number
  cedulasDistintas: number
  cedulasConAsesoria: number
  cedulasSinAsesoria: number
  sinMatch: SinMatch[]
  porEstado: ConteoGrupo[]
  porAnio: ConteoGrupo[]
}

const ORDEN_ESTADOS = ['Vigente', 'Pagado / saldo cero', 'Mora']

export function limpiarDocumento(valor: string | null | undefined): string {
  return (valor ?? '').trim()
}

/** 'AAAA-MM-DD HH:mm:ss' en UTC a partir de un ISO; null si no es una fecha. */
export function formatoUtc(iso: string): string | null {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 19).replace('T', ' ')
}

function agrupar(filas: FilaCruce[], clave: (f: FilaCruce) => string | number | null): ConteoGrupo[] {
  const mapa = new Map<string | number, { filas: number; con: number }>()
  for (const f of filas) {
    const k = clave(f)
    if (k === null) continue
    const g = mapa.get(k) ?? { filas: 0, con: 0 }
    g.filas += 1
    if (f.tieneAsesoria) g.con += 1
    mapa.set(k, g)
  }
  return [...mapa.entries()].map(([grupo, g]) => ({
    grupo,
    filas: g.filas,
    conAsesoria: g.con,
    proporcion: g.filas === 0 ? 0 : Math.round((g.con / g.filas) * 1000) / 1000,
  }))
}

export function calcularCruce(
  cartera: readonly FilaCartera[],
  asesorias: readonly AsesoriaCruce[],
  beneficiarios: readonly BeneficiarioCruce[],
): ResultadoCruce {
  const porDocumento = new Map<string, { n: number; primera: number; ultima: number; primeraTxt: string; ultimaTxt: string }>()
  for (const a of asesorias) {
    const doc = limpiarDocumento(a.documento)
    if (doc === '') continue
    const t = Date.parse(a.creadaEn)
    const txt = formatoUtc(a.creadaEn)
    const g = porDocumento.get(doc)
    if (g === undefined) {
      porDocumento.set(doc, { n: 1, primera: t, ultima: t, primeraTxt: txt ?? '', ultimaTxt: txt ?? '' })
      continue
    }
    g.n += 1
    if (!Number.isNaN(t)) {
      if (Number.isNaN(g.primera) || t < g.primera) {
        g.primera = t
        g.primeraTxt = txt ?? ''
      }
      if (Number.isNaN(g.ultima) || t > g.ultima) {
        g.ultima = t
        g.ultimaTxt = txt ?? ''
      }
    }
  }

  const filas: FilaCruce[] = cartera.map((c) => {
    const g = c.cedula === '' ? undefined : porDocumento.get(c.cedula)
    return {
      ...c,
      tieneAsesoria: g !== undefined,
      registros: g?.n ?? 0,
      primera: g === undefined || g.primeraTxt === '' ? null : g.primeraTxt,
      ultima: g === undefined || g.ultimaTxt === '' ? null : g.ultimaTxt,
    }
  })

  const cedulas = new Set(cartera.map((c) => c.cedula).filter((c) => c !== ''))
  const conAsesoria = [...cedulas].filter((c) => porDocumento.has(c)).length

  const nombres = new Map<string, string>()
  for (const b of beneficiarios) {
    nombres.set(limpiarDocumento(b.documento), `${b.nombres ?? ''} ${b.apellidos ?? ''}`.replace(/\s+/g, ' ').trim())
  }
  const sinMatch: SinMatch[] = [...porDocumento.entries()]
    .filter(([doc]) => !cedulas.has(doc))
    .map(([documento, g]) => ({ documento, nombre: nombres.get(documento) ?? '', registros: g.n }))
    .sort((a, b) => a.documento.localeCompare(b.documento))

  const porEstado = agrupar(filas, (f) => (f.estado === '' ? null : f.estado)).sort((a, b) => {
    const ia = ORDEN_ESTADOS.indexOf(String(a.grupo))
    const ib = ORDEN_ESTADOS.indexOf(String(b.grupo))
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
  const porAnio = agrupar(filas, (f) => f.anio).sort((a, b) => Number(a.grupo) - Number(b.grupo))

  return {
    filas,
    filasExcel: filas.length,
    cedulasDistintas: cedulas.size,
    cedulasConAsesoria: conAsesoria,
    cedulasSinAsesoria: cedulas.size - conAsesoria,
    sinMatch,
    porEstado,
    porAnio,
  }
}
