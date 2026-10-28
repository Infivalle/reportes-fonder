import { OPCIONES_PROVISIONALES } from '../catalogo/opciones.ts'
import { esMontoAtipico } from './atipicos.ts'
import { normalizarCategoria } from './categorias.ts'
import { decidirDuplicados } from './duplicados.ts'
import { resolverMunicipio, type MotivoMunicipio } from './municipios.ts'
import type { RegistroAsesoria, RegistroBeneficiario } from './tipos.ts'
import { validarTsvV1 } from './validar.ts'

export interface AsesoriaLimpia extends RegistroAsesoria {
  conservada: boolean
  motivoDescarte: string | null
  /** Monto atípico: marcado, no corregido. */
  atipica: boolean
}

export interface BeneficiarioLimpio extends RegistroBeneficiario {
  municipioCodigo: string | null
  municipioOrigen: 'residencia' | 'sin_ubicar'
}

export interface ResumenCarga {
  formato: 'v1'
  filasLeidas: number
  asesoriasConservadas: number
  asesoriasDescartadas: number
  beneficiariosDistintos: number
  /** Beneficiarios con al menos una asesoría conservada. */
  beneficiariosConAsesoria: number
  /** Textos de ciudad que no se pudieron llevar a un municipio del Valle (para agregar alias). */
  municipiosSinReconocer: { texto: string; motivo: MotivoMunicipio; beneficiarios: number }[]
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
] as const satisfies readonly (readonly [keyof RegistroAsesoria, string])[]

/**
 * Valida y limpia un TSV v1. Es la misma función en el navegador (vista previa) y en la
 * Edge Function (carga real): si se separan, los dos lados terminan dando cifras distintas.
 */
export function limpiarTsv(contenido: string): ResultadoCarga {
  const validacion = validarTsvV1(contenido)
  if (!validacion.ok) return { ok: false, errores: validacion.errores }

  const advertencias: string[] = []

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
  const sinReconocer = new Map<string, { motivo: MotivoMunicipio; ids: Set<number> }>()
  const beneficiarios: BeneficiarioLimpio[] = [...beneficiariosMap.values()]
    .sort((a, b) => a.id - b.id)
    .map((b) => {
      const { codigo, motivo } = resolverMunicipio(b.ciudad, b.departamento)
      if (codigo === null && motivo !== 'vacio') {
        const texto = (b.ciudad ?? '').trim()
        const entrada = sinReconocer.get(texto) ?? { motivo, ids: new Set<number>() }
        entrada.ids.add(b.id)
        sinReconocer.set(texto, entrada)
      }
      return {
        ...b,
        municipioCodigo: codigo,
        municipioOrigen: codigo === null ? ('sin_ubicar' as const) : ('residencia' as const),
      }
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
        const opciones = OPCIONES_PROVISIONALES[columna] ?? []
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
    formato: 'v1',
    filasLeidas: validacion.filas.length,
    asesoriasConservadas: conservadas.length,
    asesoriasDescartadas: asesorias.length - conservadas.length,
    beneficiariosDistintos: beneficiarios.length,
    beneficiariosConAsesoria: new Set(conservadas.map((a) => a.beneficiarioId)).size,
    municipiosSinReconocer: [...sinReconocer.entries()]
      .map(([texto, v]) => ({ texto, motivo: v.motivo, beneficiarios: v.ids.size }))
      .sort((a, b) => b.beneficiarios - a.beneficiarios || a.texto.localeCompare(b.texto)),
    valoresFueraDeCatalogo: [...fuera.entries()]
      .map(([clave, filas]) => {
        const [campo = '', valor = ''] = clave.split('\u0000')
        return { campo, valor, filas }
      })
      .sort((a, b) => a.campo.localeCompare(b.campo) || b.filas - a.filas),
    montosAtipicos: atipicos,
    advertencias,
  }

  const proyectos = [...new Set(beneficiarios.flatMap((b) => b.proyectos))].sort()

  return { ok: true, resultado: { resumen, proyectos, beneficiarios, asesorias } }
}
