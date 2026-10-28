import { MINIMO_GRUPO, RANGOS_CONTEO, RANGOS_MONTO } from './rangos.ts'
import { METRICAS_AGREGADO, type PublicoJson } from './tipos.ts'

/**
 * Claves que NUNCA pueden aparecer en publico.json, en ningún nivel (en minúsculas).
 * Es la lista de "se eliminan" del documento de arquitectura, más los montos exactos.
 */
export const CLAVES_PROHIBIDAS: ReadonlySet<string> = new Set([
  // identificación y contacto
  'documento', 'nombres', 'apellidos', 'benef_nombres', 'benef_apellidos', 'email', 'celular',
  'nit', 'nombreempresa', 'nombre_empresa', 'direccion', 'fechanacimiento', 'fecha_nacimiento',
  'ciudad', 'username', 'password', 'asesor', 'idasesor',
  // ids de base
  'id_base', 'idbeneficiario', 'beneficiario_id', 'asesoria_id', 'iduser', 'carga_id',
  // archivos
  'evidencefile', 'evidence_file', 'evidencevisitfile', 'evidence_visit_file',
  // texto libre
  'credit_usage_description', 'creditusagedescription', 'results_explanation', 'resultsexplanation',
  'payment_explanation', 'paymentexplanation', 'other_improvement', 'otherimprovement',
  'other_resource_manager', 'otherresourcemanager', 'other_sales_channel', 'othersaleschannel',
  'credit_intended_use', 'creditintendeduse', 'observaciones', 'motivo_descarte',
  // fechas exactas y actividad sin normalizar
  'created_at', 'updated_at', 'creada_en', 'actualizada_en', 'actividad_economica', 'actividadeconomica',
  // montos y conteos exactos (solo se publican en rangos)
  'monthly_income', 'fixed_costs', 'variable_costs', 'monthly_payment', 'emergency_reserve',
  'total_sales_value', 'monthly_clients', 'monthly_sales',
  // formato v2 (capa privada): empresa y situación financiera de la solicitud
  'municipio_empresa', 'municipioempresa', 'tipo_empresa', 'tipoempresa',
  'anio_fundacion', 'aniofundacion', 'empleos_generados', 'empleosgenerado',
  'empleos_a_generar', 'empleosagenerar', 'patrimonio', 'pasivos',
  'dinero_solicitado', 'dinerosolicitado', 'cuotas',
])

const CLAVES_FILA = new Set([
  'id', 'beneficiario', 'proyecto', 'municipio_codigo', 'mes',
  'credit_used_as_approved', 'time_to_results', 'results_as_expected', 'financial_records',
  'resource_manager', 'payments_on_schedule', 'satisfaction', 'need_another_credit', 'current_employees',
  'rango_ingreso_mensual', 'rango_costos_fijos', 'rango_costos_variables', 'rango_cuota_mensual',
  'rango_reserva_emergencia', 'rango_ventas_total', 'rango_clientes_mes', 'rango_ventas_mes',
  'credit_used_percentage', 'debt_level', 'mejoras', 'canales', 'atipica',
])

const CLAVES_AGREGADO = new Set([
  'proyecto', 'municipio_codigo', 'nivel', 'n_beneficiarios', 'n_asesorias',
  ...METRICAS_AGREGADO.flatMap((m) => [`promedio_${m}`, `mediana_${m}`]),
])

const RANGOS_DE_MONTO = ['rango_ingreso_mensual', 'rango_costos_fijos', 'rango_costos_variables',
  'rango_cuota_mensual', 'rango_reserva_emergencia', 'rango_ventas_total'] as const
const RANGOS_DE_CONTEO = ['rango_clientes_mes', 'rango_ventas_mes'] as const

const RE_CORREO = /[^\s@]+@[^\s@]+\.[^\s@]+/
const RE_NUMERO_LARGO = /\d{7,}/

function recorrer(valor: unknown, ruta: string, problemas: string[]) {
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => recorrer(v, `${ruta}[${i}]`, problemas))
  } else if (valor !== null && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      if (CLAVES_PROHIBIDAS.has(k.toLowerCase())) problemas.push(`${ruta}.${k}: clave prohibida`)
      recorrer(v, `${ruta}.${k}`, problemas)
    }
  } else if (typeof valor === 'string') {
    if (RE_CORREO.test(valor)) problemas.push(`${ruta}: parece un correo electrónico`)
    if (RE_NUMERO_LARGO.test(valor)) problemas.push(`${ruta}: contiene un número largo (¿documento o teléfono?)`)
  }
}

/** Devuelve la lista de problemas (vacía si el contenido se puede publicar). */
export function problemasPublico(p: PublicoJson): string[] {
  const problemas: string[] = []

  // 1. Ninguna clave prohibida ni texto con forma de dato personal, en todo el documento
  recorrer(p, 'publico', problemas)

  // 2. Las filas solo pueden tener las claves permitidas
  p.asesorias.forEach((f, i) => {
    const ruta = `asesorias[${i}]`
    for (const k of Object.keys(f)) {
      if (!CLAVES_FILA.has(k)) problemas.push(`${ruta}.${k}: clave no permitida`)
    }
    if (!/^a\d+$/.test(f.id) || !/^b\d+$/.test(f.beneficiario)) problemas.push(`${ruta}: identificador con formato inesperado`)
    if (!/^\d{4}-\d{2}$/.test(f.mes)) problemas.push(`${ruta}.mes: debe ser AAAA-MM`)

    for (const c of RANGOS_DE_MONTO) {
      const v = f[c]
      if (v !== null && !(RANGOS_MONTO as readonly string[]).includes(v)) problemas.push(`${ruta}.${c}: "${v}" no es un rango válido`)
    }
    for (const c of RANGOS_DE_CONTEO) {
      const v = f[c]
      if (v !== null && !(RANGOS_CONTEO as readonly string[]).includes(v)) problemas.push(`${ruta}.${c}: "${v}" no es un rango válido`)
    }
    // Solo dos campos numéricos permitidos: porcentajes
    for (const [k, v] of Object.entries(f)) {
      if (typeof v === 'number' && k !== 'credit_used_percentage' && k !== 'debt_level') {
        problemas.push(`${ruta}.${k}: valor numérico no permitido`)
      }
    }
  })

  // 3. Agregados: claves permitidas y mínimo de beneficiarios por grupo
  p.agregados.forEach((a, i) => {
    const ruta = `agregados[${i}]`
    for (const k of Object.keys(a)) {
      if (!CLAVES_AGREGADO.has(k)) problemas.push(`${ruta}.${k}: clave no permitida`)
    }
    if (a.n_beneficiarios < MINIMO_GRUPO) {
      problemas.push(`${ruta}: grupo de ${a.n_beneficiarios} beneficiarios (mínimo ${MINIMO_GRUPO})`)
    }
  })

  return problemas
}

/** Lanza un error con todos los problemas si el contenido no se puede publicar. */
export function verificarPublico(p: PublicoJson): void {
  const problemas = problemasPublico(p)
  if (problemas.length > 0) {
    const lista = problemas.slice(0, 20).map((x) => `  - ${x}`).join('\n')
    const resto = problemas.length > 20 ? `\n  … y ${problemas.length - 20} más` : ''
    throw new Error(`publico.json NO se puede publicar:\n${lista}${resto}`)
  }
}
