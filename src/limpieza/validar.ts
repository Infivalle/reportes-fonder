import { COLUMNAS_V1, NUM_COLUMNAS_V1, type ColumnaV1 } from '../formato/v1.ts'
import { separarCodigos } from './categorias.ts'
import { parseFechaUtc } from './fechas.ts'
import { desescaparMysql } from './texto.ts'
import type { FilaValidada, ResultadoValidacion } from './tipos.ts'
import { leerTsv } from './tsv.ts'

const MAX_ERRORES = 30

const RE_ENTERO = /^-?\d+$/
const RE_DECIMAL = /^-?\d+(\.\d+)?$/

/** Compara el encabezado con el formato v1 y explica qué columnas sobran, faltan o cambian de orden. */
function errorEncabezado(encabezado: readonly string[]): string[] {
  const esperado = new Set<string>(COLUMNAS_V1)
  const recibido = new Set(encabezado)
  const faltan = COLUMNAS_V1.filter((c) => !recibido.has(c))
  const sobran = encabezado.filter((c) => !esperado.has(c))
  const errores: string[] = []

  if (faltan.length > 0) errores.push(`Encabezado: faltan columnas: ${faltan.join(', ')}`)
  if (sobran.length > 0) errores.push(`Encabezado: sobran columnas: ${sobran.join(', ')}`)
  if (errores.length === 0) {
    const distinto = COLUMNAS_V1.findIndex((c, i) => encabezado[i] !== c)
    if (distinto !== -1) {
      errores.push(
        `Encabezado: el orden de las columnas no coincide con el formato v1 (primera diferencia en la columna ${distinto + 1}: se esperaba "${COLUMNAS_V1[distinto]}")`,
      )
    }
  }
  return errores
}

/**
 * Valida un TSV en formato v1. Rechaza el archivo completo (ok: false) si:
 *  - el encabezado no coincide exactamente con el formato,
 *  - alguna fila no tiene 52 columnas,
 *  - una fecha, número o id no se puede convertir a su tipo,
 *  - una asesoría no trae beneficiario (documento vacío).
 */
export function validarTsvV1(contenido: string): ResultadoValidacion {
  const { encabezado, filas } = leerTsv(contenido)

  if (encabezado.length === 0 || (encabezado.length === 1 && encabezado[0] === '')) {
    return { ok: false, errores: ['El archivo está vacío'] }
  }

  const errHeader = errorEncabezado(encabezado)
  if (errHeader.length > 0) return { ok: false, errores: errHeader }

  // Número de columnas por fila
  const errores: string[] = []
  let malas = 0
  filas.forEach((fila, i) => {
    if (fila.length !== NUM_COLUMNAS_V1) {
      malas++
      if (errores.length < MAX_ERRORES) {
        errores.push(`Línea ${i + 2}: tiene ${fila.length} columnas, se esperaban ${NUM_COLUMNAS_V1}`)
      }
    }
  })
  if (malas > MAX_ERRORES) errores.push(`… y ${malas - MAX_ERRORES} líneas más con número de columnas incorrecto`)
  if (malas > 0) return { ok: false, errores }

  // Conversión de tipos
  const indice = new Map<string, number>(COLUMNAS_V1.map((c, i) => [c, i]))
  const validadas: FilaValidada[] = []
  let total = 0

  const registrar = (linea: number, mensaje: string) => {
    total++
    if (errores.length < MAX_ERRORES) errores.push(`Línea ${linea}: ${mensaje}`)
  }

  filas.forEach((fila, i) => {
    const linea = i + 2
    let ok = true

    const crudo = (col: ColumnaV1): string | null => {
      const v = fila[indice.get(col) ?? -1]
      if (v === undefined || v === null) return null
      const limpio = desescaparMysql(v)
      return limpio.trim() === '' ? null : limpio
    }
    const texto = (col: ColumnaV1): string | null => {
      const v = crudo(col)
      return v === null ? null : v.trim()
    }
    const entero = (col: ColumnaV1, requerido = false): number | null => {
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
    const decimal = (col: ColumnaV1): number | null => {
      const v = texto(col)
      if (v === null) return null
      if (!RE_DECIMAL.test(v)) {
        registrar(linea, `${col} debe ser un número (valor: "${v}")`)
        ok = false
        return null
      }
      return Number(v)
    }
    const fecha = (col: ColumnaV1, requerido = false): string | null => {
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

  return { ok: true, formato: 'v1', filas: validadas }
}
