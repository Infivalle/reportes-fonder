/** Una asesoría tal como queda tras validar y convertir los tipos del TSV v1. */
export interface RegistroAsesoria {
  id: number
  beneficiarioId: number
  creditUsedAsApproved: string | null
  creditUsageDescription: string | null
  otherImprovement: string | null
  timeToResults: string | null
  resultsAsExpected: string | null
  resultsExplanation: string | null
  evidenceFile: string | null
  financialRecords: string | null
  resourceManager: string | null
  otherResourceManager: string | null
  paymentsOnSchedule: string | null
  paymentExplanation: string | null
  satisfaction: string | null
  needAnotherCredit: string | null
  creditIntendedUse: string | null
  monthlyIncome: number | null
  fixedCosts: number | null
  variableCosts: number | null
  debtLevel: number | null
  creditUsedPercentage: number | null
  monthlyPayment: number | null
  emergencyReserve: number | null
  monthlyClients: number | null
  monthlySales: number | null
  totalSalesValue: number | null
  currentEmployees: string | null
  otherSalesChannel: string | null
  evidenceVisitFile: string | null
  estado: string | null
  observaciones: string | null
  /** Instante ISO UTC. */
  creadaEn: string
  actualizadaEn: string | null
  mejoras: string[]
  canales: string[]
}

export interface RegistroBeneficiario {
  id: number
  documento: string
  nombres: string | null
  apellidos: string | null
  email: string | null
  celular: string | null
  departamento: string | null
  ciudad: string | null
  nombreEmpresa: string | null
  nit: string | null
  actividadEconomica: string | null
  proyectos: string[]
}

export interface FilaValidada {
  /** Línea del archivo (el encabezado es la 1). */
  linea: number
  asesoria: RegistroAsesoria
  beneficiario: RegistroBeneficiario
}

export type ResultadoValidacion =
  | { ok: true; formato: 'v1'; filas: FilaValidada[] }
  | { ok: false; errores: string[] }
