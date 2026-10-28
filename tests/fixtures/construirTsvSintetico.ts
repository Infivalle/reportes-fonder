/**
 * Construye TSV sintéticos (sin datos reales) en formato v1 o v2 para las pruebas.
 * Cada fila parte de valores por defecto válidos; se sobrescribe solo lo que la prueba necesita.
 */
import { COLUMNAS_V1 } from '../../src/formato/v1.ts'
import { COLUMNAS_V2, type ColumnaV2 } from '../../src/formato/v2.ts'

export type CamposFila = Partial<Record<ColumnaV2, string>>

const BASE: Record<ColumnaV2, string> = {
  id: '1',
  idbeneficiario: '101',
  idasesor: '0',
  creditusedasapproved: 'Sí',
  creditUsageDescription: 'Compra de insumos',
  idimprovements: 'NULL',
  otherimprovement: 'NULL',
  timetoresults: '1 mes',
  resultsasexpected: 'Sí',
  resultsExplanation: 'NULL',
  evidenceFile: 'NULL',
  financialRecords: 'Sí',
  resourcemanager: 'El beneficiario',
  otherResourceManager: 'NULL',
  paymentsonschedule: 'Sí',
  paymentExplanation: 'NULL',
  satisfaction: 'Muy satisfecho',
  needanothercredit: 'No',
  creditINTendedUse: 'NULL',
  monthlyIncome: '2000000',
  fixedCosts: '500000',
  variableCosts: '300000',
  debtLevel: '10.50',
  creditUsedPercentage: '80.00',
  monthlyPayment: '200000',
  emergencyReserve: '100000',
  monthlyClients: '40',
  monthlySales: '60',
  totalSalesValue: '3000000',
  currentemployees: 'De 1 a 5',
  idsaleschannels: 'NULL',
  othersaleschannel: 'NULL',
  evidenceVisitFile: 'NULL',
  estado: 'ACTIVO',
  observaciones: 'NULL',
  created_at: '2026-10-20 15:00:00',
  updated_at: '2026-10-20 15:00:00',
  es_duplicado: 'NO',
  asesor: 'NO REGISTRADO',
  documento: '1000000001',
  benef_nombres: 'Persona',
  benef_apellidos: 'Sintética',
  email: 'persona@example.org',
  celular: '3000000000',
  departamento: 'Valle del Cauca',
  ciudad: 'Cali',
  nombreempresa: 'Taller de prueba',
  nit: '900000001',
  actividadeconomica: 'Comercio',
  proyectos: 'Fonder Valle Primera Convocatoria',
  mejoras_codigos: 'CT,AA',
  canales_venta_codigos: 'TF',
  // --- solo v2 ---
  municipioempresa: 'Toro',
  tipoempresa: 'Persona natural',
  aniofundacion: '2018',
  empleosgenerado: '1 a 3',
  empleosagenerar: 'Incrementará 1% a 10%',
  patrimonio: '15000000',
  pasivos: '2000000',
  dinerosolicitado: '5000000',
  cuotas: '12',
}

/** Completa id, beneficiario y documento únicos según la posición de la fila. */
function completar(o: CamposFila, i: number): Record<ColumnaV2, string> {
  const n = i + 1
  return {
    ...BASE,
    id: String(n),
    idbeneficiario: String(100 + n),
    documento: String(1_000_000_000 + n),
    ...o,
  }
}

function construir(columnas: readonly ColumnaV2[], filas: readonly CamposFila[]): string {
  const lineas = filas.map((o, i) => {
    const fila = completar(o, i)
    return columnas.map((c) => fila[c]).join('\t')
  })
  return [columnas.join('\t'), ...lineas].join('\n') + '\n'
}

/** TSV con las 52 columnas de la consulta actual. */
export function tsvV1(filas: readonly CamposFila[]): string {
  return construir(COLUMNAS_V1, filas)
}

/** TSV con las 61 columnas de la consulta ampliada. */
export function tsvV2(filas: readonly CamposFila[]): string {
  return construir(COLUMNAS_V2, filas)
}
