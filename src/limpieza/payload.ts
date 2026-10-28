import type { ResultadoLimpieza } from './limpiar.ts'

/**
 * Carga útil que recibe la función SQL `reemplazar_datos`. Las claves y los nombres de
 * columna coinciden con las tablas (snake_case), de modo que la función pueda usar
 * jsonb_populate_recordset.
 */
export interface PayloadDb {
  carga: {
    archivo: string
    formato: 'v1' | 'v2'
    filas_leidas: number
    asesorias_conservadas: number
    asesorias_descartadas: number
    beneficiarios_distintos: number
  }
  proyectos: string[]
  beneficiarios: Record<string, string | number | null>[]
  beneficiarios_proyecto: { beneficiario_id: number; proyecto: string }[]
  asesorias: Record<string, string | number | boolean | null>[]
  asesoria_mejoras: { asesoria_id: number; codigo: string }[]
  asesoria_canales: { asesoria_id: number; codigo: string }[]
}

export function construirPayloadDb(resultado: ResultadoLimpieza, archivo: string): PayloadDb {
  const { resumen, proyectos, beneficiarios, asesorias } = resultado

  return {
    carga: {
      archivo,
      formato: resumen.formato,
      filas_leidas: resumen.filasLeidas,
      asesorias_conservadas: resumen.asesoriasConservadas,
      asesorias_descartadas: resumen.asesoriasDescartadas,
      beneficiarios_distintos: resumen.beneficiariosDistintos,
    },
    proyectos,
    beneficiarios: beneficiarios.map((b) => ({
      id: b.id,
      documento: b.documento,
      nombres: b.nombres,
      apellidos: b.apellidos,
      email: b.email,
      celular: b.celular,
      departamento: b.departamento,
      ciudad: b.ciudad,
      nombre_empresa: b.nombreEmpresa,
      nit: b.nit,
      actividad_economica: b.actividadEconomica,
      municipio_codigo: b.municipioCodigo,
      municipio_origen: b.municipioOrigen,
      // Solo v2. En v1 estas claves no se envían: las columnas quedan vacías en la base.
      ...(resumen.formato === 'v2'
        ? {
            municipio_empresa: b.municipioEmpresa ?? null,
            tipo_empresa: b.tipoEmpresa ?? null,
            anio_fundacion: b.anioFundacion ?? null,
            empleos_generados: b.empleosGenerados ?? null,
            empleos_a_generar: b.empleosAGenerar ?? null,
            patrimonio: b.patrimonio ?? null,
            pasivos: b.pasivos ?? null,
            dinero_solicitado: b.dineroSolicitado ?? null,
            cuotas: b.cuotas ?? null,
          }
        : {}),
    })),
    beneficiarios_proyecto: beneficiarios.flatMap((b) =>
      b.proyectos.map((proyecto) => ({ beneficiario_id: b.id, proyecto })),
    ),
    asesorias: asesorias.map((a) => ({
      id: a.id,
      beneficiario_id: a.beneficiarioId,
      credit_used_as_approved: a.creditUsedAsApproved,
      credit_usage_description: a.creditUsageDescription,
      other_improvement: a.otherImprovement,
      time_to_results: a.timeToResults,
      results_as_expected: a.resultsAsExpected,
      results_explanation: a.resultsExplanation,
      evidence_file: a.evidenceFile,
      financial_records: a.financialRecords,
      resource_manager: a.resourceManager,
      other_resource_manager: a.otherResourceManager,
      payments_on_schedule: a.paymentsOnSchedule,
      payment_explanation: a.paymentExplanation,
      satisfaction: a.satisfaction,
      need_another_credit: a.needAnotherCredit,
      credit_intended_use: a.creditIntendedUse,
      monthly_income: a.monthlyIncome,
      fixed_costs: a.fixedCosts,
      variable_costs: a.variableCosts,
      debt_level: a.debtLevel,
      credit_used_percentage: a.creditUsedPercentage,
      monthly_payment: a.monthlyPayment,
      emergency_reserve: a.emergencyReserve,
      monthly_clients: a.monthlyClients,
      monthly_sales: a.monthlySales,
      total_sales_value: a.totalSalesValue,
      current_employees: a.currentEmployees,
      other_sales_channel: a.otherSalesChannel,
      evidence_visit_file: a.evidenceVisitFile,
      estado: a.estado,
      observaciones: a.observaciones,
      creada_en: a.creadaEn,
      actualizada_en: a.actualizadaEn,
      conservada: a.conservada,
      motivo_descarte: a.motivoDescarte,
      atipica: a.atipica,
    })),
    asesoria_mejoras: asesorias.flatMap((a) =>
      a.mejoras.map((codigo) => ({ asesoria_id: a.id, codigo })),
    ),
    asesoria_canales: asesorias.flatMap((a) =>
      a.canales.map((codigo) => ({ asesoria_id: a.id, codigo })),
    ),
  }
}
