import { describe, expect, it } from 'vitest'
import { ensamblarPublico } from '../src/publico/ensamblar.ts'
import { MINIMO_GRUPO, RANGOS_CONTEO, RANGOS_MONTO } from '../src/publico/rangos.ts'
import type { FilaVista, PublicoJson } from '../src/publico/tipos.ts'
import { problemasPublico, verificarPublico } from '../src/publico/verificar.ts'

function fila(n: number, extra: Partial<FilaVista> = {}): FilaVista {
  return {
    asesoria_ref: n,
    beneficiario_ref: n,
    proyecto: 'Fonder Valle Primera Convocatoria',
    municipio_codigo: '76001',
    mes: '2026-10',
    credit_used_as_approved: 'Sí',
    time_to_results: 'De 1 a 3 meses',
    results_as_expected: 'Sí',
    financial_records: 'Sí',
    resource_manager: 'Yo mismo',
    payments_on_schedule: 'Sí',
    satisfaction: 'Muy satisfecho',
    need_another_credit: 'No',
    current_employees: 'De 1 a 5',
    rango_ingreso_mensual: RANGOS_MONTO[2],
    rango_costos_fijos: RANGOS_MONTO[1],
    rango_costos_variables: RANGOS_MONTO[1],
    rango_cuota_mensual: RANGOS_MONTO[0],
    rango_reserva_emergencia: RANGOS_MONTO[0],
    rango_ventas_total: RANGOS_MONTO[3],
    rango_clientes_mes: RANGOS_CONTEO[1],
    rango_ventas_mes: RANGOS_CONTEO[2],
    credit_used_percentage: '100.00',
    debt_level: '12.50',
    mejoras: ['CT'],
    canales: ['TF'],
    atipica: false,
    ...extra,
  }
}

function valido(): PublicoJson {
  return ensamblarPublico(
    [fila(1), fila(2), fila(3)],
    [],
    [{ proyecto: 'Fonder Valle Primera Convocatoria', total_beneficiarios: 1300 }],
    { ultima_carga: '2026-10-28T12:00:00.000Z', asesorias_conservadas: 3, asesorias_descartadas: 0, beneficiarios_con_asesoria: 3 },
    { generadoEn: '2026-10-28T13:00:00.000Z', aleatorio: () => 0.5 },
  )
}

/** Copia profunda para modificar sin afectar el original. */
const copia = (p: PublicoJson): PublicoJson => JSON.parse(JSON.stringify(p)) as PublicoJson

describe('verificarPublico', () => {
  it('acepta un contenido correcto', () => {
    expect(problemasPublico(valido())).toEqual([])
    expect(() => verificarPublico(valido())).not.toThrow()
  })

  it('rechaza una clave prohibida en una fila (aunque no sea de la lista de claves permitidas)', () => {
    for (const clave of ['documento', 'email', 'celular', 'nit', 'monthly_income', 'created_at', 'observaciones', 'beneficiario_id']) {
      const p = copia(valido())
      Object.assign(p.asesorias[0] ?? {}, { [clave]: 'x' })
      expect(problemasPublico(p).join(' '), clave).toContain(clave)
    }
  })

  it('rechaza una clave prohibida aunque esté en otro nivel del archivo', () => {
    const p = copia(valido())
    Object.assign(p.denominadores[0] ?? {}, { documento: '1' })
    expect(problemasPublico(p).join(' ')).toContain('clave prohibida')
  })

  it('rechaza claves desconocidas en las filas', () => {
    const p = copia(valido())
    Object.assign(p.asesorias[0] ?? {}, { campo_nuevo: 'x' })
    expect(problemasPublico(p).join(' ')).toContain('clave no permitida')
  })

  it('rechaza textos con forma de correo o de número largo', () => {
    const p1 = copia(valido())
    if (p1.asesorias[0]) p1.asesorias[0].proyecto = 'alguien@correo.com'
    expect(problemasPublico(p1).join(' ')).toContain('correo')

    const p2 = copia(valido())
    if (p2.asesorias[0]) p2.asesorias[0].satisfaction = '3001234567'
    expect(problemasPublico(p2).join(' ')).toContain('número largo')
  })

  it('rechaza rangos que no son de la lista (un monto exacto disfrazado)', () => {
    const p = copia(valido())
    if (p.asesorias[0]) p.asesorias[0].rango_ingreso_mensual = '2500000'
    expect(problemasPublico(p).join(' ')).toContain('no es un rango válido')
  })

  it('rechaza valores numéricos en campos que no son porcentajes', () => {
    const p = copia(valido())
    Object.assign(p.asesorias[0] ?? {}, { mes_exacto: 5 })
    expect(problemasPublico(p).join(' ')).toContain('valor numérico no permitido')
  })

  it('rechaza identificadores con formato de la base', () => {
    const p = copia(valido())
    if (p.asesorias[0]) p.asesorias[0].id = '12345'
    expect(problemasPublico(p).join(' ')).toContain('identificador')
  })

  it(`rechaza agregados de menos de ${MINIMO_GRUPO} beneficiarios`, () => {
    const p = copia(valido())
    p.agregados.push({
      proyecto: 'X', municipio_codigo: '76001', nivel: 'municipio', n_beneficiarios: 4, n_asesorias: 4,
      promedio_ingreso_mensual: 1, mediana_ingreso_mensual: 1, promedio_ventas_total: 1, mediana_ventas_total: 1,
      promedio_costos_fijos: 1, mediana_costos_fijos: 1, promedio_costos_variables: 1, mediana_costos_variables: 1,
      promedio_cuota_mensual: 1, mediana_cuota_mensual: 1, promedio_reserva_emergencia: 1, mediana_reserva_emergencia: 1,
    })
    expect(problemasPublico(p).join(' ')).toContain('mínimo')
  })

  it('verificarPublico lanza un error que lista los problemas', () => {
    const p = copia(valido())
    Object.assign(p.asesorias[0] ?? {}, { documento: '1' })
    expect(() => verificarPublico(p)).toThrow(/NO se puede publicar/)
  })
})

describe('ensamblarPublico', () => {
  it('convierte los textos numéricos de la base en números', () => {
    const p = valido()
    expect(p.asesorias[0]?.credit_used_percentage).toBe(100)
    expect(p.asesorias[0]?.debt_level).toBe(12.5)
    expect(p.totales.asesorias_conservadas).toBe(3)
  })

  it('sin datos de meta deja la fecha de corte vacía', () => {
    const p = ensamblarPublico([], [], [], undefined, { generadoEn: '2026-10-28T13:00:00.000Z' })
    expect(p.fecha_corte).toBeNull()
    expect(p.asesorias).toEqual([])
  })

  it('usa crypto por defecto: dos generaciones con los mismos datos dan ids distintos', () => {
    const filas = Array.from({ length: 30 }, (_, i) => fila(i + 1))
    const gen = () =>
      ensamblarPublico(filas, [], [], undefined, { generadoEn: 'x' }).asesorias.map((f) => f.beneficiario)
    expect(gen()).not.toEqual(gen())
  })
})
