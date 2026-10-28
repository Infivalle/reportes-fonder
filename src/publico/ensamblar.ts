import {
  METRICAS_AGREGADO,
  type AgregadoPublico,
  type FilaAgregadoVista,
  type FilaDenominadorVista,
  type FilaMetaVista,
  type FilaPublica,
  type FilaVista,
  type PublicoJson,
} from './tipos.ts'

export interface OpcionesEnsamblar {
  generadoEn: string
  /** Número aleatorio en [0, 1). Por defecto usa crypto; las pruebas pasan uno con semilla. */
  aleatorio?: () => number
}

function aleatorioSeguro(): number {
  const [n = 0] = globalThis.crypto.getRandomValues(new Uint32Array(1))
  return n / 2 ** 32
}

function aNumero(v: string | number | null): number | null {
  if (v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Mezcla Fisher-Yates (no modifica la entrada). */
function barajar<T>(items: readonly T[], aleatorio: () => number): T[] {
  const copia = [...items]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1))
    const a = copia[i] as T
    copia[i] = copia[j] as T
    copia[j] = a
  }
  return copia
}

/** Asigna a cada referencia de la base un identificador aleatorio nuevo ("a0412"). */
function identificadores(refs: readonly (string | number)[], prefijo: string, aleatorio: () => number) {
  const unicas = [...new Set(refs.map(String))]
  const ancho = Math.max(4, String(unicas.length).length)
  const orden = barajar(unicas, aleatorio)
  const mapa = new Map<string, string>()
  orden.forEach((ref, i) => mapa.set(ref, `${prefijo}${String(i + 1).padStart(ancho, '0')}`))
  return mapa
}

/**
 * Arma el contenido de publico.json a partir de las vistas anonimizadas.
 * Reemplaza los números de referencia por identificadores aleatorios nuevos y deja las filas
 * en orden aleatorio, de modo que el archivo no se pueda cruzar con el de una carga anterior
 * ni con el orden de la base.
 */
export function ensamblarPublico(
  filas: readonly FilaVista[],
  agregados: readonly FilaAgregadoVista[],
  denominadores: readonly FilaDenominadorVista[],
  meta: FilaMetaVista | undefined,
  opciones: OpcionesEnsamblar,
): PublicoJson {
  const aleatorio = opciones.aleatorio ?? aleatorioSeguro
  const idAsesoria = identificadores(filas.map((f) => f.asesoria_ref), 'a', aleatorio)
  const idBeneficiario = identificadores(filas.map((f) => f.beneficiario_ref), 'b', aleatorio)

  const asesorias: FilaPublica[] = filas
    .map((f): FilaPublica => {
      const { asesoria_ref, beneficiario_ref, credit_used_percentage, debt_level, ...resto } = f
      return {
        id: idAsesoria.get(String(asesoria_ref)) ?? '',
        beneficiario: idBeneficiario.get(String(beneficiario_ref)) ?? '',
        ...resto,
        credit_used_percentage: aNumero(credit_used_percentage),
        debt_level: aNumero(debt_level),
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id) || a.proyecto.localeCompare(b.proyecto))

  const agregadosPublicos: AgregadoPublico[] = agregados.map((a) => {
    const salida: Record<string, unknown> = {
      proyecto: a.proyecto,
      municipio_codigo: a.municipio_codigo,
      nivel: a.nivel,
      n_beneficiarios: Number(a.n_beneficiarios),
      n_asesorias: Number(a.n_asesorias),
    }
    for (const m of METRICAS_AGREGADO) {
      salida[`promedio_${m}`] = aNumero(a[`promedio_${m}`])
      salida[`mediana_${m}`] = aNumero(a[`mediana_${m}`])
    }
    return salida as AgregadoPublico
  })
  agregadosPublicos.sort(
    (a, b) =>
      a.proyecto.localeCompare(b.proyecto) ||
      a.nivel.localeCompare(b.nivel) ||
      (a.municipio_codigo ?? '').localeCompare(b.municipio_codigo ?? ''),
  )

  const corte = meta?.ultima_carga ?? null

  return {
    version: 1,
    generado_en: opciones.generadoEn,
    fecha_corte: corte === null ? null : new Date(corte).toISOString(),
    // v2 usa el municipio de la empresa (con la residencia de respaldo); v1, la residencia.
    fuente_municipio: meta?.ultimo_formato === 'v2' ? 'empresa' : 'residencia',
    totales: {
      asesorias_conservadas: Number(meta?.asesorias_conservadas ?? 0),
      asesorias_descartadas: Number(meta?.asesorias_descartadas ?? 0),
      beneficiarios_con_asesoria: Number(meta?.beneficiarios_con_asesoria ?? 0),
    },
    denominadores: denominadores
      .map((d) => ({ proyecto: d.proyecto, total_beneficiarios: Number(d.total_beneficiarios) }))
      .sort((a, b) => a.proyecto.localeCompare(b.proyecto)),
    asesorias,
    agregados: agregadosPublicos,
  }
}
