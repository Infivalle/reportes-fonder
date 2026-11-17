import type { SupabaseClient } from '@supabase/supabase-js'

export type AccionExportacion = 'exporta_excel_cruce' | 'exporta_excel_completo'

/**
 * Registra una exportación en la bitácora (habeas data). Solo cifras: nunca datos personales.
 * Lanza un error si no se pudo registrar: la exportación no debe entregarse sin su registro.
 */
export async function registrarExportacion(
  cliente: SupabaseClient,
  usuarioId: string,
  accion: AccionExportacion,
  detalle: Record<string, string | number | boolean | null>,
): Promise<void> {
  const { error } = await cliente.from('bitacora').insert({ usuario_id: usuarioId, accion, detalle })
  if (error !== null) {
    throw new Error('No se pudo registrar la descarga en la bitácora, así que no se generó el archivo. Intente de nuevo.')
  }
}
