import { OPCIONES_FORMULARIO } from '../catalogo/opciones.ts'
import { esMontoAtipico } from './atipicos.ts'
import { normalizarCategoria } from './categorias.ts'
import { decidirDuplicados } from './duplicados.ts'
import { resolverMunicipio, resolverUbicacion, type MotivoMunicipio, type OrigenMunicipio } from './municipios.ts'
import type { RegistroAsesoria, RegistroBeneficiario } from './tipos.ts'
import { validarTsv } from './validar.ts'

export interface AsesoriaLimpia extends RegistroAsesoria {
  conservada: boolean
  motivoDescarte: string | null
  /** Monto atípico: marcado, no corregido. */
  atipica: boolean
}

export interface BeneficiarioLimpio extends RegistroBeneficiario {
  municipioCodigo: string | null
  municipioOrigen: OrigenMunicipio
}

export interface ResumenCarga {
  formato: 'v1' | 'v2'
  filasLeidas: number
  asesoriasConservadas: number
  asesoriasDescartadas: number
  beneficiariosDistintos: number
  /** Beneficiarios con al menos una asesoría conservada. */
  beneficiariosConAsesoria: number
  /**
   * Textos de municipio que no se pudieron llevar a un municipio del Valle (para agregar alias).
   * En v2 `campo` dice de qué columna viene el texto; en v1 siempre es la ciudad y no se indica.
   */
  municipiosSinReconocer: {
    texto: string
    motivo: MotivoMunicipio
    beneficiarios: number
    campo?: 'municipioempresa' | 'ciudad'
  }[]
  /** Solo v2: de dónde salió el municipio de cada beneficiario. */
  municipiosPorOrigen?: Record<OrigenMunicipio, number>
  valoresFueraDeCatalogo: { campo: string; valor: string; filas: number }[]
  montosAtipicos: number
  advertencias: string[]
}

export interface ResultadoLimpieza {
  resumen: ResumenCarga
  proyectos: string[]
  beneficiarios: BeneficiarioLimpio[]
  /** Todas las asesorías, conservadas y descartadas, ordenadas por id. */
  asesorias: AsesoriaLimpia[]
}

export type ResultadoCarga =
  | { ok: true; resultado: ResultadoLimpieza }
  | { ok: false; errores: string[] }

/** Campo del registro tipado -> columna del TSV que define su catálogo. */
const CAMPOS_CATEGORICOS = [
  ['satisfaction', 'satisfaction'],
  ['resultsAsExpected', 'resultsasexpected'],
  ['paymentsOnSchedule', 'paymentsonschedule'],
  ['needAnotherCredit', 'needanothercredit'],
  ['financialRecords', 'financialRecords'],
  ['creditUsedAsApproved', 'creditusedasapproved'],
  ['currentEmployees', 'currentemployees'],
  ['timeToResults', 'timetoresults'],
  ['resourceManager', 'resourcemanager'],
] as const satisfies readonly (readonly [keyof RegistroAsesoria, string])[]

/**
 * Valida y limpia un TSV v1 o v2 (el formato se reconoce por el encabezado). Es la misma función en el navegador (vista previa) y en la
 * Edge Function (carga real): si se separan, los dos lados terminan dando cifras distintas.
 */
export function limpiarTsv(contenido: string): ResultadoCarga {
  const validacion = validarTsv(contenido)
  if (!validacion.ok) return { ok: false, errores: validacion.errores }

  const esV2 = validacion.formato === 'v2'
  const advertencias: string[] = [...(validacion.advertencias ?? [])]

  // --- Beneficiarios (una fila por beneficiario; se toma la primera aparición) ---
  const beneficiariosMap = new Map<number, RegistroBeneficiario>()
  for (const { linea, beneficiario } of validacion.filas) {
    const previo = beneficiariosMap.get(beneficiario.id)
    if (previo === undefined) {
      beneficiariosMap.set(beneficiario.id, beneficiario)
    } else if (previo.documento !== beneficiario.documento) {
      advertencias.push(
        `Línea ${linea}: el beneficiario ${beneficiario.id} aparece con otro documento; se conserva el de la primera aparición`,
      )
    }
  }

  // Documentos repetidos entre beneficiarios distintos: la tabla de destino exige documento único
  const porDocumento = new Map<string, number>()
  for (const b of beneficiariosMap.values()) {
    const otro = porDocumento.get(b.documento)
    if (otro !== undefined && otro !== b.id) {
      return {
        ok: false,
        errores: [`El documento ${b.documento} pertenece a dos beneficiarios distintos (${otro} y ${b.id})`],
      }
    }
    porDocumento.set(b.documento, b.id)
  }

  // --- Municipios ---
  // v1: ciudad de residencia. v2: municipio de la empresa y, si no sirve, la residencia.
  const sinReconocer = new Map<
    string,
    { texto: string; campo?: 'municipioempresa' | 'ciudad'; motivo: MotivoMunicipio; ids: Set<number> }
  >()
  const anotar = (
    id: number,
    texto: string,
    motivo: MotivoMunicipio,
    campo?: 'municipioempresa' | 'ciudad',
  ) => {
    const clave = campo === undefined ? texto : `${campo}\u0000${texto}`
    const entrada = sinReconocer.get(clave) ?? {
      texto,
      ...(campo === undefined ? {} : { campo }),
      motivo,
      ids: new Set<number>(),
    }
    entrada.ids.add(id)
    sinReconocer.set(clave, entrada)
  }
  const porOrigen: Record<OrigenMunicipio, number> = { empresa: 0, residencia: 0, sin_ubicar: 0 }

  const beneficiarios: BeneficiarioLimpio[] = [...beneficiariosMap.values()]
    .sort((a, b) => a.id - b.id)
    .map((b) => {
      if (!esV2) {
        const { codigo, motivo } = resolverMunicipio(b.ciudad, b.departamento)
        if (codigo === null && motivo !== 'vacio') anotar(b.id, (b.ciudad ?? '').trim(), motivo)
        return {
          ...b,
          municipioCodigo: codigo,
          municipioOrigen: codigo === null ? ('sin_ubicar' as const) : ('residencia' as const),
        }
      }

      const u = resolverUbicacion(b.municipioEmpresa ?? null, b.ciudad, b.departamento)
      // Un texto de empresa que no se reconoce se reporta aunque la residencia lo rescate:
      // agregar el alias mejora la próxima carga.
      if (u.empresa.codigo === null && u.empresa.motivo !== 'vacio') {
        anotar(b.id, (b.municipioEmpresa ?? '').trim(), u.empresa.motivo, 'municipioempresa')
      }
      if (u.origen === 'sin_ubicar' && u.residencia.motivo !== 'vacio') {
        anotar(b.id, (b.ciudad ?? '').trim(), u.residencia.motivo, 'ciudad')
      }
      porOrigen[u.origen] += 1
      return { ...b, municipioCodigo: u.codigo, municipioOrigen: u.origen }
    })

  // --- Duplicados ---
  const decisiones = decidirDuplicados(
    validacion.filas.map(({ asesoria: a }) => ({
      id: a.id,
      beneficiarioId: a.beneficiarioId,
      creadaEn: a.creadaEn,
    })),
  )

  // --- Categorías y atípicos ---
  const fuera = new Map<string, number>()
  let atipicos = 0

  const asesorias: AsesoriaLimpia[] = validacion.filas
    .map(({ asesoria }) => {
      const copia: RegistroAsesoria = { ...asesoria }
      for (const [campo, columna] of CAMPOS_CATEGORICOS) {
        const opciones = OPCIONES_FORMULARIO[columna] ?? []
        const r = normalizarCategoria(copia[campo], opciones)
        copia[campo] = r.valor
        if (r.fueraDeCatalogo && r.valor !== null) {
          const clave = `${columna}\u0000${r.valor}`
          fuera.set(clave, (fuera.get(clave) ?? 0) + 1)
        }
      }

      const decision = decisiones.get(copia.id)
      const atipica = esMontoAtipico(copia.monthlyIncome, copia.totalSalesValue)
      if (atipica) atipicos++
      return {
        ...copia,
        conservada: decision?.conservada ?? true,
        motivoDescarte: decision?.motivoDescarte ?? null,
        atipica,
      }
    })
    .sort((a, b) => a.id - b.id)

  const conservadas = asesorias.filter((a) => a.conservada)

  const resumen: ResumenCarga = {
    formato: validacion.formato,
    filasLeidas: validacion.filas.length,
    asesoriasConservadas: conservadas.length,
    asesoriasDescartadas: asesorias.length - conservadas.length,
    beneficiariosDistintos: beneficiarios.length,
    beneficiariosConAsesoria: new Set(conservadas.map((a) => a.beneficiarioId)).size,
    municipiosSinReconocer: [...sinReconocer.entries()]
      .map(([, v]) => ({
        texto: v.texto,
        motivo: v.motivo,
        beneficiarios: v.ids.size,
        ...(v.campo === undefined ? {} : { campo: v.campo }),
      }))
      .sort((a, b) => b.beneficiarios - a.beneficiarios || a.texto.localeCompare(b.texto)),
    valoresFueraDeCatalogo: [...fuera.entries()]
      .map(([clave, filas]) => {
        const [campo = '', valor = ''] = clave.split('\u0000')
        return { campo, valor, filas }
      })
      .sort((a, b) => a.campo.localeCompare(b.campo) || b.filas - a.filas),
    montosAtipicos: atipicos,
    advertencias,
    ...(esV2 ? { municipiosPorOrigen: porOrigen } : {}),
  }

  const proyectos = [...new Set(beneficiarios.flatMap((b) => b.proyectos))].sort()

  return { ok: true, resultado: { resumen, proyectos, beneficiarios, asesorias } }
}
