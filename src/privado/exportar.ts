/**
 * Orquesta cada exportación: leer → calcular → REGISTRAR en bitácora → construir y entregar.
 * El registro va antes del archivo a propósito: si falla, no se entrega nada.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularCruce, type AsesoriaCruce, type BeneficiarioCruce } from './cruce'
import { leerCartera } from './cartera'
import { diaColombia, leerTabla, leerUltimaCarga } from './datosPrivados'
import { registrarExportacion } from './bitacora'
import { construirLibroCruce } from './libroCruce'
import { construirLibroLimpio, type AsesoriaDb, type BeneficiarioDb, type CodigoDb } from './libroLimpio'

export interface Resultado {
  contenido: ArrayBuffer
  nombre: string
  /** Frases cortas para mostrar a la persona. */
  resumen: string[]
  avisos: string[]
}

type Avance = (texto: string) => void

const COLUMNAS_BENEFICIARIO =
  'id,documento,nombres,apellidos,email,celular,departamento,ciudad,nombre_empresa,nit,actividad_economica,municipio_codigo,municipio_origen,municipio_empresa,tipo_empresa,anio_fundacion,empleos_generados,empleos_a_generar,patrimonio,pasivos,dinero_solicitado,cuotas'
const COLUMNAS_ASESORIA =
  'id,beneficiario_id,credit_used_as_approved,credit_usage_description,other_improvement,time_to_results,results_as_expected,results_explanation,financial_records,resource_manager,other_resource_manager,payments_on_schedule,payment_explanation,satisfaction,need_another_credit,credit_intended_use,monthly_income,fixed_costs,variable_costs,debt_level,credit_used_percentage,monthly_payment,emergency_reserve,monthly_clients,monthly_sales,total_sales_value,current_employees,other_sales_channel,estado,observaciones,creada_en,actualizada_en,conservada,motivo_descarte,atipica'

function aBuffer(datos: ArrayBuffer | { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }): ArrayBuffer {
  if (datos instanceof ArrayBuffer) return datos
  return new Uint8Array(datos.buffer, datos.byteOffset, datos.byteLength).slice().buffer
}

export async function generarCruce(
  cliente: SupabaseClient,
  usuarioId: string,
  archivoCartera: ArrayBuffer,
  avance: Avance,
): Promise<Resultado> {
  avance('Leyendo la cartera…')
  const cartera = await leerCartera(archivoCartera)

  avance('Leyendo las asesorías…')
  const [beneficiarios, asesorias, carga] = await Promise.all([
    leerTabla<{ id: number; documento: string; nombres: string | null; apellidos: string | null }>(cliente, 'beneficiarios', 'id,documento,nombres,apellidos', 'id'),
    leerTabla<{ id: number; beneficiario_id: number; creada_en: string }>(cliente, 'asesorias', 'id,beneficiario_id,creada_en', 'id'),
    leerUltimaCarga(cliente),
  ])
  const documentoDe = new Map(beneficiarios.map((b) => [b.id, b.documento]))
  const filasAsesoria: AsesoriaCruce[] = asesorias.map((a) => ({ documento: documentoDe.get(a.beneficiario_id) ?? '', creadaEn: a.creada_en }))
  const benefCruce: BeneficiarioCruce[] = beneficiarios

  avance('Calculando el cruce…')
  const r = calcularCruce(cartera, filasAsesoria, benefCruce)

  const avisos: string[] = []
  if (carga !== null && carga.filas_leidas !== asesorias.length) {
    avisos.push(`La última carga leyó ${carga.filas_leidas} filas y la base tiene ${asesorias.length} asesorías: revise que la carga esté completa.`)
  }
  if (carga === null) avisos.push('No hay cargas registradas.')
  const sinDocumento = filasAsesoria.filter((a) => a.documento === '').length
  if (sinDocumento > 0) avisos.push(`${sinDocumento} asesorías no tienen documento y no se pueden cruzar.`)

  avance('Registrando la descarga…')
  await registrarExportacion(cliente, usuarioId, 'exporta_excel_cruce', {
    filas_cartera: r.filasExcel,
    cedulas_distintas: r.cedulasDistintas,
    cedulas_con_asesoria: r.cedulasConAsesoria,
    filas_asesorias: asesorias.length,
    carga_id: carga?.id ?? null,
  })

  avance('Construyendo el Excel…')
  const dia = carga === null ? 'sin carga' : diaColombia(carga.creada_en)
  const libro = construirLibroCruce(r, { origen: `carga del ${dia}, ${asesorias.length} filas` })
  const contenido = aBuffer(await libro.xlsx.writeBuffer())

  return {
    contenido,
    nombre: `cruce_excel_vs_asesorias_${new Date().toISOString().slice(0, 10)}.xlsx`,
    resumen: [
      `${r.filasExcel} filas en la cartera (${r.cedulasDistintas} cédulas distintas).`,
      `${r.cedulasConAsesoria} cédulas con asesoría y ${r.cedulasSinAsesoria} sin asesoría.`,
      r.sinMatch.length === 0 ? 'Ninguna asesoría queda fuera de la cartera.' : `${r.sinMatch.length} documento(s) con asesoría que no están en la cartera.`,
    ],
    avisos,
  }
}

export async function generarDataLimpia(
  cliente: SupabaseClient,
  usuario: { id: string; correo: string },
  avance: Avance,
): Promise<Resultado> {
  avance('Leyendo la base de datos…')
  const [beneficiarios, asesorias, mejoras, canales, proyectos, enlaces, carga] = await Promise.all([
    leerTabla<BeneficiarioDb>(cliente, 'beneficiarios', COLUMNAS_BENEFICIARIO, 'id'),
    leerTabla<AsesoriaDb>(cliente, 'asesorias', COLUMNAS_ASESORIA, 'id'),
    leerTabla<CodigoDb>(cliente, 'asesoria_mejoras', 'asesoria_id,codigo', 'asesoria_id'),
    leerTabla<CodigoDb>(cliente, 'asesoria_canales', 'asesoria_id,codigo', 'asesoria_id'),
    leerTabla<{ id: number; nombre: string }>(cliente, 'proyectos', 'id,nombre', 'id'),
    leerTabla<{ beneficiario_id: number; proyecto_id: number }>(cliente, 'beneficiarios_proyecto', 'beneficiario_id,proyecto_id', 'beneficiario_id'),
    leerUltimaCarga(cliente),
  ])
  const nombreProyecto = new Map(proyectos.map((p) => [p.id, p.nombre]))
  const porBeneficiario = new Map<number, string[]>()
  for (const e of enlaces) {
    const n = nombreProyecto.get(e.proyecto_id)
    if (n !== undefined) porBeneficiario.set(e.beneficiario_id, [...(porBeneficiario.get(e.beneficiario_id) ?? []), n].sort())
  }

  const conservadas = asesorias.filter((a) => a.conservada).length
  avance('Registrando la descarga…')
  await registrarExportacion(cliente, usuario.id, 'exporta_excel_completo', {
    asesorias_conservadas: conservadas,
    asesorias_descartadas: asesorias.length - conservadas,
    beneficiarios: beneficiarios.length,
    carga_id: carga?.id ?? null,
  })

  avance('Construyendo el Excel…')
  const libro = construirLibroLimpio(
    { beneficiarios, asesorias, mejoras, canales, proyectos: porBeneficiario, carga },
    { generadoPor: usuario.correo, generadoEn: new Date() },
  )
  const contenido = aBuffer(await libro.xlsx.writeBuffer())

  return {
    contenido,
    nombre: `data_limpia_asesorias_${new Date().toISOString().slice(0, 10)}.xlsx`,
    resumen: [`${conservadas} asesorías conservadas y ${asesorias.length - conservadas} descartadas.`, `${beneficiarios.length} beneficiarios.`],
    avisos: carga === null ? ['No hay cargas registradas.'] : [],
  }
}
