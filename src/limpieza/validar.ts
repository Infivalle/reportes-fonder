import { COLUMNAS_V1, NUM_COLUMNAS_V1 } from '../formato/v1.ts'
import { COLUMNAS_NUEVAS_V2, COLUMNAS_V2, NUM_COLUMNAS_V2, type ColumnaV2 } from '../formato/v2.ts'
import { separarCodigos } from './categorias.ts'
import { parseFechaUtc } from './fechas.ts'
import { desescaparMysql } from './texto.ts'
import type { FilaValidada, ResultadoValidacion } from './tipos.ts'
import { leerTsv } from './tsv.ts'

const MAX_ERRORES = 30
const MAX_ADVERTENCIAS = 10

const RE_ENTERO = /^-?\d+$/
const RE_DECIMAL = /^-?\d+(\.\d+)?$/

type FormatoTsv = 'v1' | 'v2'

const FORMATOS: Record<FormatoTsv, { columnas: readonly string[]; numero: number }> = {
  v1: { columnas: COLUMNAS_V1, numero: NUM_COLUMNAS_V1 },
  v2: { columnas: COLUMNAS_V2, numero: NUM_COLUMNAS_V2 },
}

/**
 * v2 es v1 más nueve columnas al final. Si el encabezado trae alguna de esas nueve se valida
 * como v2 (y los mensajes hablan de v2); si no, como v1.
 */
function detectarFormato(encabezado: readonly string[]): FormatoTsv {
  return COLUMNAS_NUEVAS_V2.some((c) => encabezado.includes(c)) ? 'v2' : 'v1'
}

/** Compara el encabezado con el formato y explica qué columnas sobran, faltan o cambian de orden. */
function errorEncabezado(encabezado: readonly string[], formato: FormatoTsv): string[] {
  const columnas = FORMATOS[formato].columnas
  const esperado = new Set<string>(columnas)
  const recibido = new Set(encabezado)
  const faltan = columnas.filter((c) => !recibido.has(c))
  const sobran = encabezado.filter((c) => !esperado.has(c))
  const errores: string[] = []

  if (faltan.length > 0) errores.push(`Encabezado: faltan columnas: ${faltan.join(', ')}`)
  if (sobran.length > 0) errores.push(`Encabezado: sobran columnas: ${sobran.join(', ')}`)
  if (errores.length === 0) {
    const distinto = columnas.findIndex((c, i) => encabezado[i] !== c)
    if (distinto !== -1) {
      errores.push(
        `Encabezado: el orden de las columnas no coincide con el formato ${formato} (primera diferencia en la columna ${distinto + 1}: se esperaba "${columnas[distinto]}")`,
      )
    }
  }
  return errores
}

/**
 * Algunos registros de origen traen la letra acentuada dañada ("�"). Para estos dos campos de
 * respuesta cerrada se restauran las palabras conocidas, para que no se cuenten como categorías
 * distintas. Cualquier otro daño se deja tal cual.
 */
function repararTexto(v: string | null): string | null {
  if (v === null) return null
  return v
    .replace(/Incrementar\uFFFD/g, 'Incrementará')
    .replace(/incrementar\uFFFD/g, 'incrementará')
    .replace(/n\uFFFDmero/g, 'número')
    .replace(/\s+/g, ' ')
    .trim()
}

function validar(contenido: string, forzado: FormatoTsv | null): ResultadoValidacion {
  const { encabezado, filas } = leerTsv(contenido)

  if (encabezado.length === 0 || (encabezado.length === 1 && encabezado[0] === '')) {
    return { ok: false, errores: ['El archivo está vacío'] }
  }

  const formato = forzado ?? detectarFormato(encabezado)
  const { columnas, numero } = FORMATOS[formato]

  const errHeader = errorEncabezado(encabezado, formato)
  if (errHeader.length > 0) return { ok: false, errores: errHeader }

  // Número de columnas por fila
  const errores: string[] = []
  let malas = 0
  filas.forEach((fila, i) => {
    if (fila.length !== numero) {
      malas++
      if (errores.length < MAX_ERRORES) {
        errores.push(`Línea ${i + 2}: tiene ${fila.length} columnas, se esperaban ${numero}`)
      }
    }
  })
  if (malas > MAX_ERRORES) errores.push(`… y ${malas - MAX_ERRORES} líneas más con número de columnas incorrecto`)
  if (malas > 0) return { ok: false, errores }

  // Conversión de tipos
  const indice = new Map<string, number>(columnas.map((c, i) => [c, i]))
  const validadas: FilaValidada[] = []
  const advertencias: string[] = []
  let total = 0
  let totalAdvertencias = 0

  const registrar = (linea: number, mensaje: string) => {
    total++
    if (errores.length < MAX_ERRORES) errores.push(`Línea ${linea}: ${mensaje}`)
  }
  const advertir = (linea: number, mensaje: string) => {
    totalAdvertencias++
    if (advertencias.length < MAX_ADVERTENCIAS) advertencias.push(`Línea ${linea}: ${mensaje}`)
  }

  filas.forEach((fila, i) => {
    const linea = i + 2
    let ok = true

    const crudo = (col: ColumnaV2): string | null => {
      const v = fila[indice.get(col) ?? -1]
      if (v === undefined || v === null) return null
      const limpio = desescaparMysql(v)
      return limpio.trim() === '' ? null : limpio
    }
    const texto = (col: ColumnaV2): string | null => {
      const v = crudo(col)
      return v === null ? null : v.trim()
    }
    const entero = (col: ColumnaV2, requerido = false): number | null => {
      const v = texto(col)
      if (v === null) {
        if (requerido) {
          registrar(linea, `${col} es obligatorio`)
          ok = false
        }
        return null
      }
      if (!RE_ENTERO.test(v) || !Number.isSafeInteger(Number(v))) {
        registrar(linea, `${col} debe ser un entero (valor: "${v}")`)
        ok = false
        return null
      }
      return Number(v)
    }
    const decimal = (col: ColumnaV2): number | null => {
      const v = texto(col)
      if (v === null) return null
      if (!RE_DECIMAL.test(v)) {
        registrar(linea, `${col} debe ser un número (valor: "${v}")`)
        ok = false
        return null
      }
      return Number(v)
    }
    const fecha = (col: ColumnaV2, requerido = false): string | null => {
      const v = texto(col)
      if (v === null) {
        if (requerido) {
          registrar(linea, `${col} es obligatorio`)
          ok = false
        }
        return null
      }
      const iso = parseFechaUtc(v)
      if (iso === null) {
        registrar(linea, `${col} no es una fecha válida AAAA-MM-DD HH:MM:SS (valor: "${v}")`)
        ok = false
      }
      return iso
    }

    // Columnas nuevas de v2: no alimentan ningún indicador y el tipo de origen no está
    // confirmado. Un valor ilegible se deja vacío y se avisa; no rechaza el archivo.
    const decimalSuave = (col: ColumnaV2): number | null => {
      const v = texto(col)
      if (v === null) return null
      if (!RE_DECIMAL.test(v) || !Number.isFinite(Number(v))) {
        advertir(linea, `${col} no es un número; se deja vacío (valor: "${v}")`)
        return null
      }
      return Number(v)
    }
    const enteroSuave = (col: ColumnaV2, min?: number, max?: number): number | null => {
      const n = decimalSuave(col)
      if (n === null) return null
      const v = texto(col)
      if (!Number.isSafeInteger(n) || (min !== undefined && n < min) || (max !== undefined && n > max)) {
        advertir(linea, `${col} no es un entero válido; se deja vacío (valor: "${v}")`)
        return null
      }
      return n
    }

    const id = entero('id', true)
    const beneficiarioId = entero('idbeneficiario', true)
    const creadaEn = fecha('created_at', true)
    const actualizadaEn = fecha('updated_at')
    const documento = texto('documento')
    if (documento === null) {
      registrar(linea, 'la asesoría no tiene beneficiario (documento vacío)')
      ok = false
    }

    const asesoria = {
      creditUsedAsApproved: texto('creditusedasapproved'),
      creditUsageDescription: crudo('creditUsageDescription'),
      otherImprovement: crudo('otherimprovement'),
      timeToResults: texto('timetoresults'),
      resultsAsExpected: texto('resultsasexpected'),
      resultsExplanation: crudo('resultsExplanation'),
      evidenceFile: texto('evidenceFile'),
      financialRecords: texto('financialRecords'),
      resourceManager: texto('resourcemanager'),
      otherResourceManager: crudo('otherResourceManager'),
      paymentsOnSchedule: texto('paymentsonschedule'),
      paymentExplanation: crudo('paymentExplanation'),
      satisfaction: texto('satisfaction'),
      needAnotherCredit: texto('needanothercredit'),
      creditIntendedUse: crudo('creditINTendedUse'),
      monthlyIncome: decimal('monthlyIncome'),
      fixedCosts: decimal('fixedCosts'),
      variableCosts: decimal('variableCosts'),
      debtLevel: decimal('debtLevel'),
      creditUsedPercentage: decimal('creditUsedPercentage'),
      monthlyPayment: decimal('monthlyPayment'),
      emergencyReserve: decimal('emergencyReserve'),
      monthlyClients: entero('monthlyClients'),
      monthlySales: entero('monthlySales'),
      totalSalesValue: decimal('totalSalesValue'),
      currentEmployees: texto('currentemployees'),
      otherSalesChannel: crudo('othersaleschannel'),
      evidenceVisitFile: texto('evidenceVisitFile'),
      estado: texto('estado'),
      observaciones: crudo('observaciones'),
      mejoras: separarCodigos(texto('mejoras_codigos')),
      canales: separarCodigos(texto('canales_venta_codigos')),
    }

    const proyectosTexto = texto('proyectos')
    const beneficiario = {
      nombres: texto('benef_nombres'),
      apellidos: texto('benef_apellidos'),
      email: texto('email'),
      celular: texto('celular'),
      departamento: texto('departamento'),
      ciudad: texto('ciudad'),
      nombreEmpresa: texto('nombreempresa'),
      nit: texto('nit'),
      actividadEconomica: texto('actividadeconomica'),
      proyectos:
        proyectosTexto === null
          ? []
          : [...new Set(proyectosTexto.split('|').map((p) => p.trim()).filter((p) => p !== ''))],
      // En v1 estas claves no existen (no se agregan ni como null).
      ...(formato === 'v2'
        ? {
            municipioEmpresa: texto('municipioempresa'),
            tipoEmpresa: texto('tipoempresa'),
            anioFundacion: enteroSuave('aniofundacion', 1800, 2100),
            // Son rangos en texto ("1 a 3", "Incrementará 1% a 10%"), no números.
            empleosGenerados: repararTexto(texto('empleosgenerado')),
            empleosAGenerar: repararTexto(texto('empleosagenerar')),
            patrimonio: decimalSuave('patrimonio'),
            pasivos: decimalSuave('pasivos'),
            dineroSolicitado: decimalSuave('dinerosolicitado'),
            cuotas: decimalSuave('cuotas'),
          }
        : {}),
    }

    if (ok && id !== null && beneficiarioId !== null && creadaEn !== null && documento !== null) {
      validadas.push({
        linea,
        asesoria: { id, beneficiarioId, creadaEn, actualizadaEn, ...asesoria },
        beneficiario: { id: beneficiarioId, documento, ...beneficiario },
      })
    }
  })

  if (total > 0) {
    if (total > MAX_ERRORES) errores.push(`… y ${total - MAX_ERRORES} errores más`)
    return { ok: false, errores }
  }

  // Ids de asesoría repetidos: la tabla de destino tiene id único
  const vistos = new Set<number>()
  for (const f of validadas) {
    if (vistos.has(f.asesoria.id)) {
      return { ok: false, errores: [`Línea ${f.linea}: el id de asesoría ${f.asesoria.id} está repetido`] }
    }
    vistos.add(f.asesoria.id)
  }

  if (totalAdvertencias > MAX_ADVERTENCIAS) {
    advertencias.push(`… y ${totalAdvertencias - MAX_ADVERTENCIAS} advertencias más sobre las columnas de v2`)
  }
  return { ok: true, formato, filas: validadas, ...(advertencias.length > 0 ? { advertencias } : {}) }
}

/** Valida un TSV v1 o v2; el formato se reconoce por el encabezado. */
export function validarTsv(contenido: string): ResultadoValidacion {
  return validar(contenido, null)
}

/**
 * Valida un TSV exigiendo el formato v1 (52 columnas). Rechaza el archivo completo (ok: false) si:
 *  - el encabezado no coincide exactamente con el formato,
 *  - alguna fila no tiene 52 columnas,
 *  - una fecha, número o id no se puede convertir a su tipo,
 *  - una asesoría no trae beneficiario (documento vacío).
 * Con v2 aplican las mismas reglas (61 columnas); ver `validarTsv`.
 */
export function validarTsvV1(contenido: string): ResultadoValidacion {
  return validar(contenido, 'v1')
}
