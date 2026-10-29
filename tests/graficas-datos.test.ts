import { describe, expect, it } from 'vitest'
import { CATALOGO, GRAFICAS_POR_TIPO, MEDIDAS_POR_TIPO } from '../src/catalogo/campos'
import { UMBRAL_SUPRESION, calcularGrafica } from '../src/graficas/datos'
import { admiteDesglose, admiteMedida, desglosesPosibles, nuevaDef, normalizar, type GraficaDef } from '../src/graficas/definicion'
import type { FilaPublica } from '../src/publico/tipos'
import { buscarCampo } from '../src/catalogo/campos'

let n = 0
function fila(o: Partial<FilaPublica> = {}): FilaPublica {
  n += 1
  return {
    id: `a${n}`, beneficiario: `b${n}`, proyecto: 'Fonder Valle Primera Convocatoria', municipio_codigo: '76001', mes: '2026-10',
    credit_used_as_approved: null, time_to_results: null, results_as_expected: null, financial_records: null,
    resource_manager: null, payments_on_schedule: null, satisfaction: null, need_another_credit: null,
    current_employees: null, rango_ingreso_mensual: null, rango_costos_fijos: null, rango_costos_variables: null,
    rango_cuota_mensual: null, rango_reserva_emergencia: null, rango_ventas_total: null, rango_clientes_mes: null,
    rango_ventas_mes: null, credit_used_percentage: null, debt_level: null, mejoras: [], canales: [], atipica: false, linea: null, ...o,
  }
}
const muchas = (k: number, o: Partial<FilaPublica>): FilaPublica[] => Array.from({ length: k }, () => fila(o))
const def = (o: Partial<GraficaDef>): GraficaDef => ({ campo: 'satisfaction', grafica: 'barras', medida: 'conteo', desglose: null, ...o })
const textos = (d: ReturnType<typeof calcularGrafica>, i = 0) => d.series[i]!.celdas.map((c) => c.texto)

describe('definición', () => {
  it('cada campo del catálogo produce una definición inicial válida', () => {
    for (const c of CATALOGO) {
      const d = nuevaDef(c.clave)
      expect(normalizar(d), c.clave).toEqual(d)
      expect(GRAFICAS_POR_TIPO[c.tipo]).toContain(d.grafica)
      expect(MEDIDAS_POR_TIPO[c.tipo]).toContain(d.medida)
    }
  })
  it('campo desconocido → null; gráfica o medida no admitidas → las del tipo', () => {
    expect(normalizar(def({ campo: 'nada' }))).toBeNull()
    expect(normalizar(def({ grafica: 'histograma' }))?.grafica).toBe('barras')
    expect(normalizar(def({ medida: 'promedio' }))?.medida).toBe('conteo')
    expect(normalizar(def({ campo: 'debt_level', grafica: 'dona', medida: 'conteo' }))).toMatchObject({ grafica: 'histograma', medida: 'promedio' })
  })
  it('apilada al 100 % fuerza porcentaje; dona e histograma no llevan desglose', () => {
    expect(normalizar(def({ grafica: 'apilada_100', medida: 'conteo' }))?.medida).toBe('porcentaje')
    expect(normalizar(def({ campo: 'proyecto', grafica: 'dona', desglose: 'satisfaction' }))?.desglose).toBeNull()
    expect(normalizar(def({ campo: 'debt_level', grafica: 'histograma', medida: 'promedio', desglose: 'proyecto' }))?.desglose).toBeNull()
  })
  it('el desglose debe existir, ser discreto y distinto del campo', () => {
    expect(normalizar(def({ desglose: 'satisfaction' }))?.desglose).toBeNull()
    expect(normalizar(def({ desglose: 'mejoras' }))?.desglose).toBeNull()
    expect(normalizar(def({ desglose: 'debt_level' }))?.desglose).toBeNull()
    expect(normalizar(def({ desglose: 'inventado' }))?.desglose).toBeNull()
    expect(normalizar(def({ desglose: 'proyecto' }))?.desglose).toBe('proyecto')
    expect(desglosesPosibles('satisfaction').every((c) => c.clave !== 'satisfaction' && c.tipo !== 'numerico' && c.tipo !== 'multivalor')).toBe(true)
  })
  it('qué controles aplican', () => {
    expect(admiteDesglose({ grafica: 'dona' })).toBe(false)
    expect(admiteDesglose({ grafica: 'barras' })).toBe(true)
    expect(admiteMedida({ grafica: 'apilada_100' }, buscarCampo('satisfaction')!)).toBe(false)
    expect(admiteMedida({ grafica: 'histograma' }, buscarCampo('debt_level')!)).toBe(false)
    expect(admiteMedida({ grafica: 'barras' }, buscarCampo('debt_level')!)).toBe(true)
  })
})

describe('campo discreto sin desglose', () => {
  const filas = [...muchas(3, { satisfaction: 'Muy satisfecho' }), ...muchas(1, { satisfaction: 'Satisfecho' }), fila()]
  it('conteo en el orden del formulario, con base y total', () => {
    const d = calcularGrafica(filas, def({}))
    expect(d.categorias).toEqual(['Muy satisfecho', 'Satisfecho'])
    expect(textos(d)).toEqual(['3', '1'])
    expect(d).toMatchObject({ base: 4, total: 5, unidad: 'conteo', titulo: 'Satisfacción' })
  })
  it('porcentaje sobre quienes respondieron; sin desglose no suprime cifras pequeñas', () => {
    const d = calcularGrafica(filas, def({ medida: 'porcentaje' }))
    expect(textos(d)).toEqual(['75 %', '25 %'])
    expect(d.avisos).toEqual([])
  })
  it('apilada al 100 % sin desglose: una barra "Total" partida por categoría', () => {
    const d = calcularGrafica(filas, def({ grafica: 'apilada_100', medida: 'porcentaje' }))
    expect(d.categorias).toEqual(['Total'])
    expect(d.series.map((s) => s.nombre)).toEqual(['Muy satisfecho', 'Satisfecho'])
    expect(d.series.reduce((t, s) => t + (s.celdas[0]!.valor ?? 0), 0)).toBeCloseTo(100)
  })
  it('usa las etiquetas legibles (municipio, convocatoria, mes)', () => {
    const f = [fila({ municipio_codigo: '76834' }), fila({ municipio_codigo: '76834', proyecto: 'FONDERVALLE SEGUNDA CONVOCATORIA' })]
    expect(calcularGrafica(f, def({ campo: 'municipio_codigo' })).categorias).toEqual(['Tuluá'])
    expect(calcularGrafica(f, def({ campo: 'proyecto' })).categorias.sort()).toEqual(['Primera convocatoria', 'Segunda convocatoria'])
    expect(calcularGrafica(f, def({ campo: 'mes' })).categorias).toEqual(['Octubre de 2026'])
  })
  it('sin filas no falla', () => {
    const d = calcularGrafica([], def({ medida: 'porcentaje' }))
    expect(d).toMatchObject({ categorias: [], series: [{ celdas: [] }], base: 0, total: 0 })
  })
  it('usa la asesoría más reciente de cada beneficiario', () => {
    const a = fila({ beneficiario: 'x', mes: '2026-10', satisfaction: 'Insatisfecho' })
    const b = fila({ beneficiario: 'x', mes: '2027-03', satisfaction: 'Muy satisfecho' })
    const d = calcularGrafica([a, b], def({}))
    expect(d.categorias).toEqual(['Muy satisfecho'])
  })
})

describe('desglose y supresión', () => {
  const filas = [
    ...muchas(6, { proyecto: 'A', satisfaction: 'Satisfecho' }),
    ...muchas(2, { proyecto: 'B', satisfaction: 'Satisfecho' }),
    ...muchas(5, { proyecto: 'B', satisfaction: 'Muy satisfecho' }),
  ]
  it('barras agrupadas: una serie por grupo; las celdas pequeñas (1 a 4) se muestran con su cifra real', () => {
    const d = calcularGrafica(filas, def({ desglose: 'proyecto' }))
    expect(d.categorias).toEqual(['Muy satisfecho', 'Satisfecho'])
    const a = d.series.find((s) => s.nombre === 'A')!
    const b = d.series.find((s) => s.nombre === 'B')!
    expect(a.celdas.map((c) => c.texto)).toEqual(['0', '6'])
    expect(b.celdas.map((c) => c.texto)).toEqual(['5', '2'])
    expect(b.celdas[1]!.valor).toBe(2)
    expect(d.avisos).toEqual([])
    expect(d.titulo).toBe('Satisfacción por convocatoria')
  })
  it('el porcentaje es dentro de cada grupo, también en grupos de menos de 5 respuestas', () => {
    const f = [...muchas(8, { proyecto: 'A', satisfaction: 'Satisfecho' }), ...muchas(3, { proyecto: 'B', satisfaction: 'Satisfecho' })]
    const d = calcularGrafica(f, def({ desglose: 'proyecto', medida: 'porcentaje' }))
    expect(d.series.find((s) => s.nombre === 'A')!.celdas[0]!.texto).toBe('100 %')
    expect(d.series.find((s) => s.nombre === 'B')!.celdas[0]!.texto).toBe('100 %')
  })
  it('apilada al 100 % con desglose: una barra por grupo', () => {
    const d = calcularGrafica(filas, def({ grafica: 'apilada_100', medida: 'porcentaje', desglose: 'proyecto' }))
    expect(d.categorias).toEqual(['A', 'B'])
    expect(d.series.map((s) => s.nombre)).toEqual(['Muy satisfecho', 'Satisfecho'])
  })
  it('una fila sin valor en el desglose no cuenta en ningún grupo', () => {
    const f = [...muchas(5, { municipio_codigo: '76001', satisfaction: 'Satisfecho' }), ...muchas(5, { municipio_codigo: null, satisfaction: 'Satisfecho' })]
    const d = calcularGrafica(f, def({ desglose: 'municipio_codigo' }))
    expect(d.series.map((s) => s.nombre)).toEqual(['Cali'])
  })
})

describe('multivalor', () => {
  it('cuenta una vez por beneficiario y por código, con etiquetas y aviso en porcentaje', () => {
    const f = [fila({ mejoras: ['CT', 'AI'] }), fila({ mejoras: ['AI', 'AI'] }), fila({ mejoras: [] })]
    const d = calcularGrafica(f, def({ campo: 'mejoras', grafica: 'barras_horizontales', medida: 'porcentaje' }))
    expect(d.categorias).toEqual(['Aumento de ingresos', 'Capital de trabajo'])
    expect(textos(d)).toEqual(['100 %', '50 %'])
    expect(d.base).toBe(2)
    expect(d.avisos.join(' ')).toMatch(/sumar más de 100/)
  })
  it('se puede desglosar por un campo discreto', () => {
    const f = [...muchas(5, { proyecto: 'A', canales: ['TF', 'RS'] }), ...muchas(5, { proyecto: 'B', canales: ['TF'] })]
    const d = calcularGrafica(f, def({ campo: 'canales', grafica: 'barras_horizontales', desglose: 'proyecto' }))
    expect(d.categorias).toEqual(['Tienda física', 'Redes sociales'])
    expect(d.series.find((s) => s.nombre === 'A')!.celdas.map((c) => c.texto)).toEqual(['5', '5'])
    expect(d.series.find((s) => s.nombre === 'B')!.celdas.map((c) => c.texto)).toEqual(['5', '0'])
  })
})

describe('campo numérico', () => {
  const pct = (v: number | null) => fila({ credit_used_percentage: v })
  it('histograma: tramos de 20 en 20, el 100 incluido y "Más de 100 %" solo si existe', () => {
    const f = [0, 20, 21, 100, 100].map(pct)
    const d = calcularGrafica(f, def({ campo: 'credit_used_percentage', grafica: 'histograma', medida: 'promedio' }))
    expect(d.categorias).toEqual(['0 a 20 %', '20 a 40 %', '40 a 60 %', '60 a 80 %', '80 a 100 %'])
    expect(textos(d)).toEqual(['2', '1', '0', '0', '2'])
    expect(d.resumen).toMatchObject({ n: 5, mediana: 21, minimo: 0, maximo: 100 })
    const sobre = calcularGrafica([...f, pct(130)], def({ campo: 'credit_used_percentage', grafica: 'histograma', medida: 'promedio' }))
    expect(sobre.categorias.at(-1)).toBe('Más de 100 %')
  })
  it('ignora nulos y negativos', () => {
    const d = calcularGrafica([pct(null), pct(-5), pct(50)], def({ campo: 'credit_used_percentage', grafica: 'histograma', medida: 'promedio' }))
    expect(d.base).toBe(1)
  })
  it('medida por categoría: promedio y mediana, también en grupos pequeños', () => {
    const f = [
      ...[10, 20, 30, 40, 50].map((v) => fila({ proyecto: 'A', credit_used_percentage: v })),
      ...muchas(3, { proyecto: 'B', credit_used_percentage: 90 }),
    ]
    const prom = calcularGrafica(f, def({ campo: 'credit_used_percentage', grafica: 'barras', medida: 'promedio', desglose: 'proyecto' }))
    expect(prom.categorias).toEqual(['A', 'B'])
    expect(textos(prom)).toEqual(['30 %', '90 %'])
    expect(prom.titulo).toBe('Promedio de crédito utilizado (%) por convocatoria')
    const med = calcularGrafica(f, def({ campo: 'credit_used_percentage', grafica: 'barras', medida: 'maximo', desglose: 'proyecto' }))
    expect(textos(med)[0]).toBe('50 %')
  })
  it('barras sin desglose avisa en vez de inventar una gráfica', () => {
    const d = calcularGrafica([pct(10)], def({ campo: 'credit_used_percentage', grafica: 'barras', medida: 'promedio' }))
    expect(d.series).toEqual([])
    expect(d.avisos[0]).toMatch(/Elija un campo/)
  })
})

describe('cifras pequeñas', () => {
  it('por decisión de InfiValle no se suprime ninguna (umbral 0)', () => {
    expect(UMBRAL_SUPRESION).toBe(0)
  })
})
