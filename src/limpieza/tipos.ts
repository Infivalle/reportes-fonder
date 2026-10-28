/** Una asesoría tal como queda tras validar y convertir los tipos del TSV (v1 o v2). */
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
  // --- Solo formato v2 (en v1 estas claves no existen) ---
  /** Municipio de la empresa, texto original. */
  municipioEmpresa?: string | null
  tipoEmpresa?: string | null
  anioFundacion?: number | null
  /** Rango en texto, p. ej. "1 a 3" o "No genera empleo". */
  empleosGenerados?: string | null
  /** Rango en texto, p. ej. "Incrementará 1% a 10%". */
  empleosAGenerar?: string | null
  /** Situación financiera de la solicitud: dato personal, solo capa privada. */
  patrimonio?: number | null
  pasivos?: number | null
  dineroSolicitado?: number | null
  cuotas?: number | null
}

export interface FilaValidada {
  /** Línea del archivo (el encabezado es la 1). */
  linea: number
  asesoria: RegistroAsesoria
  beneficiario: RegistroBeneficiario
}

export type ResultadoValidacion =
  | {
      ok: true
      formato: 'v1' | 'v2'
      filas: FilaValidada[]
      /** Valores de v2 que no se pudieron leer y quedaron vacíos (no rechazan el archivo). */
      advertencias?: string[]
    }
  | { ok: false; errores: string[] }
