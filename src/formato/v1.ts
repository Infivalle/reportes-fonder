/**
 * Formato v1 del TSV: consulta de extracción actual (52 columnas).
 * Ver docs/formato-v1.md. El orden importa: el encabezado del archivo debe
 * coincidir exactamente con esta lista.
 */
export const COLUMNAS_V1 = [
  // asesorias.* (37)
  'id',
  'idbeneficiario',
  'idasesor',
  'creditusedasapproved',
  'creditUsageDescription',
  'idimprovements',
  'otherimprovement',
  'timetoresults',
  'resultsasexpected',
  'resultsExplanation',
  'evidenceFile',
  'financialRecords',
  'resourcemanager',
  'otherResourceManager',
  'paymentsonschedule',
  'paymentExplanation',
  'satisfaction',
  'needanothercredit',
  'creditINTendedUse',
  'monthlyIncome',
  'fixedCosts',
  'variableCosts',
  'debtLevel',
  'creditUsedPercentage',
  'monthlyPayment',
  'emergencyReserve',
  'monthlyClients',
  'monthlySales',
  'totalSalesValue',
  'currentemployees',
  'idsaleschannels',
  'othersaleschannel',
  'evidenceVisitFile',
  'estado',
  'observaciones',
  'created_at',
  'updated_at',
  // calculadas por la consulta (2)
  'es_duplicado',
  'asesor',
  // beneficiario (10)
  'documento',
  'benef_nombres',
  'benef_apellidos',
  'email',
  'celular',
  'departamento',
  'ciudad',
  'nombreempresa',
  'nit',
  'actividadeconomica',
  // agregadas (3)
  'proyectos',
  'mejoras_codigos',
  'canales_venta_codigos',
] as const

export type ColumnaV1 = (typeof COLUMNAS_V1)[number]

export const NUM_COLUMNAS_V1 = COLUMNAS_V1.length
