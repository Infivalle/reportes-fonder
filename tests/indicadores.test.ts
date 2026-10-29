import { describe, expect, it } from 'vitest'
import {
  calcularIndicadores,
  contarCategorias,
  denominadorCobertura,
  indicadorCredito,
  mediana,
  ultimaPorBeneficiario,
  indicadorDestino,
  indicadorMunicipios,
} from '../src/indicadores/calcular'
import { formatoEntero, formatoPorcentaje } from '../src/indicadores/formato'
import { claveProyecto, etiquetaProyecto, listarProyectos } from '../src/indicadores/proyectos'
import type { FilaPublica, PublicoJson } from '../src/publico/tipos'

const P1 = 'Fonder Valle Primera Convocatoria'
const P2 = 'FONDERVALLE SEGUNDA CONVOCATORIA'

let contador = 0
function fila(o: Partial<FilaPublica> = {}): FilaPublica {
  contador += 1
  return {
    id: `a${String(contador).padStart(4, '0')}`,
    beneficiario: `b${String(contador).padStart(4, '0')}`,
    proyecto: P1,
    municipio_codigo: '76001',
    mes: '2026-10',
    credit_used_as_approved: 'Sí',
    time_to_results: '1 mes',
    results_as_expected: 'Sí',
    financial_records: 'Sí',
    resource_manager: 'El beneficiario',
    payments_on_schedule: 'Sí',
    satisfaction: 'Muy satisfecho',
    need_another_credit: 'No',
    current_employees: 'De 1 a 5',
    rango_ingreso_mensual: null,
    rango_costos_fijos: null,
    rango_costos_variables: null,
    rango_cuota_mensual: null,
    rango_reserva_emergencia: null,
    rango_ventas_total: null,
    rango_clientes_mes: null,
    rango_ventas_mes: null,
    credit_used_percentage: 80,
    debt_level: 10,
    mejoras: [],
    canales: [],
    atipica: false, linea: null,
    ...o,
  }
}

function publico(asesorias: FilaPublica[], denominadores: PublicoJson['denominadores'] = []): PublicoJson {
  return {
    version: 1,
    generado_en: '2026-10-28T10:00:00Z',
    fecha_corte: '2026-10-28T02:00:00Z',
    fuente_municipio: 'residencia',
    totales: { asesorias_conservadas: asesorias.length, asesorias_descartadas: 0, beneficiarios_con_asesoria: asesorias.length },
    denominadores,
    asesorias,
    agregados: [],
  }
}

describe('proyectos', () => {
  it('unifica mayúsculas y espacios en la clave y en la etiqueta', () => {
    expect(claveProyecto('FONDERVALLE SEGUNDA CONVOCATORIA')).toBe(claveProyecto('Fonder Valle Segunda Convocatoria'))
    expect(etiquetaProyecto('FONDERVALLE SEGUNDA CONVOCATORIA')).toBe('Segunda convocatoria')
    expect(etiquetaProyecto('Fonder Valle Primera Convocatoria')).toBe('Primera convocatoria')
    expect(etiquetaProyecto('Fondervalle')).toBe('Fonder Valle')
    expect(etiquetaProyecto('OTRO PROYECTO')).toBe('Otro Proyecto')
    expect(etiquetaProyecto('Otro Proyecto Mixto')).toBe('Otro Proyecto Mixto')
  })

  it('lista cada proyecto una sola vez aunque venga escrito distinto', () => {
    const l = listarProyectos([P2, 'Fonder Valle Segunda Convocatoria', P1])
    expect(l.map((p) => p.etiqueta)).toEqual([
      'Primera convocatoria',
      'Segunda convocatoria',
    ])
  })
})

describe('utilidades', () => {
  it('mediana', () => {
    expect(mediana([])).toBeNull()
    expect(mediana([5])).toBe(5)
    expect(mediana([1, 3, 2])).toBe(2)
    expect(mediana([1, 2, 3, 10])).toBe(2.5)
  })

  it('contarCategorias respeta el orden del catálogo, ignora nulos y conserva valores raros', () => {
    const d = contarCategorias(['No', 'Sí', null, 'Sí', 'Quizás'], ['Sí', 'No', 'Tal vez'])
    expect(d.n).toBe(4)
    expect(d.items.map((i) => [i.valor, i.conteo])).toEqual([
      ['Sí', 2],
      ['No', 1],
      ['Tal vez', 0],
      ['Quizás', 1],
    ])
    expect(d.items[0]!.porcentaje).toBe(50)
  })

  it('contarCategorias sin respuestas no inventa porcentajes', () => {
    const d = contarCategorias([null, null], ['Sí', 'No'])
    expect(d.n).toBe(0)
    expect(d.items.every((i) => i.porcentaje === null)).toBe(true)
  })

  it('formato en español de Colombia', () => {
    expect(formatoEntero(1300)).toBe('1.300')
    expect(formatoEntero(168)).toBe('168')
    expect(formatoPorcentaje(97)).toBe('97 %')
    expect(formatoPorcentaje(97.34)).toBe('97,3 %')
    expect(formatoPorcentaje(0.5)).toBe('0,5 %')
    expect(formatoPorcentaje(null)).toBe('Sin dato')
  })
})

describe('ultimaPorBeneficiario', () => {
  it('usa la más reciente por mes y, si empatan, el id mayor', () => {
    const a = fila({ beneficiario: 'x', mes: '2026-10', satisfaction: 'Satisfecho' })
    const b = fila({ beneficiario: 'x', mes: '2027-02', satisfaction: 'Insatisfecho' })
    const c = fila({ beneficiario: 'y', mes: '2026-10' })
    const d = fila({ beneficiario: 'y', mes: '2026-10' })
    const r = ultimaPorBeneficiario([a, b, c, d])
    expect(r).toHaveLength(2)
    expect(r.find((f) => f.beneficiario === 'x')!.id).toBe(b.id)
    expect(r.find((f) => f.beneficiario === 'y')!.id).toBe(d.id)
  })
})

describe('indicadorCredito', () => {
  it('reparte en tramos con límite superior inclusivo y calcula la mediana', () => {
    const r = indicadorCredito([0, 25, 26, 50, 75, 100, null])
    expect(r.n).toBe(6)
    expect(r.distribucion.items.map((i) => i.conteo)).toEqual([2, 2, 1, 1])
    expect(r.mediana).toBe(38)
  })

  it('agrega "Más de 100 %" solo si hay valores sobre 100 y descarta negativos', () => {
    const sin = indicadorCredito([10, 20])
    expect(sin.distribucion.items).toHaveLength(4)
    const con = indicadorCredito([10, 120, -5])
    expect(con.n).toBe(2)
    expect(con.distribucion.items.at(-1)).toMatchObject({ valor: 'Más de 100 %', conteo: 1 })
  })

  it('sin datos: n = 0 y sin mediana', () => {
    expect(indicadorCredito([null])).toMatchObject({ n: 0, mediana: null })
  })
})

describe('denominadorCobertura', () => {
  const den = [
    { proyecto: P1, total_beneficiarios: 1000 },
    { proyecto: 'Fonder Valle Segunda Convocatoria', total_beneficiarios: 300 },
  ]

  it('empareja por clave aunque el nombre difiera en mayúsculas', () => {
    expect(denominadorCobertura(den, [P2])).toBe(300)
  })

  it('suma los proyectos presentes', () => {
    expect(denominadorCobertura(den, [P1, P2, P1])).toBe(1300)
  })

  it('si falta el denominador de algún proyecto, "Sin dato"', () => {
    expect(denominadorCobertura([den[0]!], [P1, P2])).toBeNull()
    expect(denominadorCobertura([], [P1])).toBeNull()
    expect(denominadorCobertura(den, [])).toBeNull()
  })

  it('un total de 0 no sirve de denominador', () => {
    expect(denominadorCobertura([{ proyecto: P1, total_beneficiarios: 0 }], [P1])).toBeNull()
  })
})

describe('calcularIndicadores', () => {
  const filas = [
    // Primera convocatoria: 4 beneficiarios
    fila({ proyecto: P1, satisfaction: 'Muy satisfecho', results_as_expected: 'Sí', payments_on_schedule: 'Sí', need_another_credit: 'Sí', credit_used_percentage: 100, current_employees: 'De 1 a 5' }),
    fila({ proyecto: P1, satisfaction: 'Satisfecho', results_as_expected: 'Parcialmente', payments_on_schedule: 'Sí', need_another_credit: 'No', credit_used_percentage: 50, current_employees: 'De 5 a 10' }),
    fila({ proyecto: P1, satisfaction: 'Poco satisfecho', results_as_expected: 'Todavía no se ha evidenciado', payments_on_schedule: 'No', need_another_credit: 'Tal vez', credit_used_percentage: 20, current_employees: 'De 1 a 5' }),
    fila({ proyecto: P1, satisfaction: null, results_as_expected: 'Sí', payments_on_schedule: 'Parcialmente', need_another_credit: null, credit_used_percentage: null, current_employees: null }),
    // Segunda convocatoria: 2 beneficiarios
    fila({ proyecto: P2, satisfaction: 'Insatisfecho', results_as_expected: 'No', payments_on_schedule: 'Sí', need_another_credit: 'Sí', credit_used_percentage: 80, current_employees: 'De 10 a 15' }),
    fila({ proyecto: P2, satisfaction: 'Muy satisfecho', results_as_expected: 'Sí', payments_on_schedule: 'Sí', need_another_credit: 'No', credit_used_percentage: 60, current_employees: 'De 1 a 5' }),
  ]
  const den = [
    { proyecto: P1, total_beneficiarios: 100 },
    { proyecto: 'Fonder Valle Segunda Convocatoria', total_beneficiarios: 50 },
  ]
  const datos = publico(filas, den)

  it('sin filtro: todos los beneficiarios, cada indicador sobre respuestas no nulas', () => {
    const r = calcularIndicadores(datos, { proyecto: null })
    expect(r.asesorias).toBe(6)
    expect(r.beneficiarios).toBe(6)
    expect(r.cobertura).toMatchObject({ atendidos: 6, total: 150, inconsistente: false })
    expect(r.cobertura.porcentaje).toBeCloseTo(4)
    // Satisfacción: 5 respuestas; favorables = Muy satisfecho x2 + Satisfecho x1 = 3
    expect(r.satisfaccion.n).toBe(5)
    expect(r.satisfaccion.valor).toBeCloseTo(60)
    // Resultados: 6 respuestas; Sí = 3 (dos en P1, uno en P2); Parcialmente 1; Todavía 1
    expect(r.resultados.n).toBe(6)
    expect(r.resultados.valor).toBeCloseTo(50)
    expect(r.resultados.parcialmente).toBeCloseTo(100 / 6)
    expect(r.resultados.sinEvidenciar).toBeCloseTo(100 / 6)
    // Pagos: Sí = 4 de 6
    expect(r.pagos.valor).toBeCloseTo((4 / 6) * 100)
    // Nuevo crédito: 5 respuestas; Sí = 2
    expect(r.nuevoCredito.n).toBe(5)
    expect(r.nuevoCredito.valor).toBeCloseTo(40)
    // Crédito utilizado: valores 100, 50, 20, 80, 60 -> mediana 60
    expect(r.creditoUtilizado.n).toBe(5)
    expect(r.creditoUtilizado.mediana).toBe(60)
    // Empleo: 5 respuestas
    expect(r.empleo.n).toBe(5)
    expect(r.empleo.items.map((i) => i.conteo)).toEqual([3, 1, 1])
  })

  it('con filtro por proyecto (clave) solo cuenta ese proyecto y su denominador', () => {
    const r = calcularIndicadores(datos, { proyecto: claveProyecto(P2) })
    expect(r.beneficiarios).toBe(2)
    expect(r.cobertura).toMatchObject({ atendidos: 2, total: 50 })
    expect(r.satisfaccion.valor).toBeCloseTo(50)
    expect(r.creditoUtilizado.mediana).toBe(70)
  })

  it('sin denominador cargado: la cobertura es "Sin dato" y no un porcentaje inventado', () => {
    const r = calcularIndicadores(publico(filas, []), { proyecto: null })
    expect(r.cobertura.total).toBeNull()
    expect(r.cobertura.porcentaje).toBeNull()
  })

  it('marca como inconsistente un denominador menor que los atendidos', () => {
    const r = calcularIndicadores(publico(filas, [{ proyecto: P2, total_beneficiarios: 1 }]), { proyecto: claveProyecto(P2) })
    expect(r.cobertura.inconsistente).toBe(true)
  })

  it('un proyecto con denominador pero sin asesorías muestra 0 de N', () => {
    const r = calcularIndicadores(publico([], den), { proyecto: claveProyecto(P1) })
    expect(r.cobertura).toMatchObject({ atendidos: 0, total: 100, porcentaje: 0 })
    expect(r.satisfaccion.valor).toBeNull()
    expect(r.creditoUtilizado.mediana).toBeNull()
  })

  it('una segunda asesoría del mismo beneficiario reemplaza a la primera en los indicadores', () => {
    const primera = fila({ beneficiario: 'z', mes: '2026-10', satisfaction: 'Insatisfecho' })
    const segunda = fila({ beneficiario: 'z', mes: '2027-03', satisfaction: 'Muy satisfecho' })
    const r = calcularIndicadores(publico([primera, segunda]), { proyecto: null })
    expect(r.asesorias).toBe(2)
    expect(r.beneficiarios).toBe(1)
    expect(r.satisfaccion).toMatchObject({ n: 1, valor: 100 })
  })
})

describe('cubrimiento de municipios', () => {
  it('cuenta municipios distintos del Valle y descarta nulos y códigos ajenos', () => {
    const filas = [
      fila({ municipio_codigo: '76001' }),
      fila({ municipio_codigo: '76001' }),
      fila({ municipio_codigo: '76834' }),
      fila({ municipio_codigo: null }),
      fila({ municipio_codigo: '99999' }),
    ]
    const m = indicadorMunicipios(filas)
    expect(m).toMatchObject({ visitados: 2, total: 42 })
    expect(m.porcentaje).toBeCloseTo((2 / 42) * 100)
  })

  it('con filtro por convocatoria cuenta solo sus municipios', () => {
    const publicoM = publico(
      [fila({ proyecto: P1, municipio_codigo: '76001' }), fila({ proyecto: P2, municipio_codigo: '76834' }), fila({ proyecto: P2, municipio_codigo: '76001' })],
      [],
    )
    expect(calcularIndicadores(publicoM, { proyecto: null }).municipios.visitados).toBe(2)
    expect(calcularIndicadores(publicoM, { proyecto: claveProyecto(P1) }).municipios.visitados).toBe(1)
  })
})

describe('destino del crédito (mejoras logradas)', () => {
  it('cuenta cada beneficiario una vez por opción y agrupa "Otras" y códigos desconocidos como Otros', () => {
    const d = indicadorDestino([
      fila({ mejoras: ['CT', 'AI', 'CT'] }),
      fila({ mejoras: ['CT'] }),
      fila({ mejoras: ['O', 'XX'] }),
      fila({ mejoras: [] }),
    ])
    expect(d.n).toBe(3)
    const por = Object.fromEntries(d.items.map((i) => [i.valor, i.conteo]))
    expect(por['Capital de trabajo']).toBe(2)
    expect(por['Aumento de ingresos']).toBe(1)
    expect(por['Otros']).toBe(1)
    expect(d.items.at(-1)?.valor).toBe('Otros')
    expect(d.items.find((i) => i.valor === 'Capital de trabajo')?.porcentaje).toBeCloseTo((2 / 3) * 100)
  })

  it('sin respuestas: n = 0 y porcentajes nulos', () => {
    const d = indicadorDestino([fila({ mejoras: [] })])
    expect(d.n).toBe(0)
    expect(d.items.every((i) => i.porcentaje === null)).toBe(true)
  })
})
