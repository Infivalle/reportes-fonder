import { describe, expect, it } from 'vitest'
import { calcularGrafica } from '../src/graficas/datos'
import type { GraficaDef } from '../src/graficas/definicion'
import { PALETA, altoGrafica, construirOpcion, hayQueDibujar } from '../src/graficas/opcion'
import type { FilaPublica } from '../src/publico/tipos'

let n = 0
function fila(o: Partial<FilaPublica> = {}): FilaPublica {
  n += 1
  return {
    id: `a${n}`, beneficiario: `b${n}`, proyecto: 'P', municipio_codigo: '76001', mes: '2026-10', credit_used_as_approved: null,
    time_to_results: null, results_as_expected: null, financial_records: null, resource_manager: null, payments_on_schedule: null,
    satisfaction: null, need_another_credit: null, current_employees: null, rango_ingreso_mensual: null, rango_costos_fijos: null,
    rango_costos_variables: null, rango_cuota_mensual: null, rango_reserva_emergencia: null, rango_ventas_total: null,
    rango_clientes_mes: null, rango_ventas_mes: null, credit_used_percentage: null, debt_level: null, mejoras: [], canales: [],
    atipica: false, ...o,
  }
}
const muchas = (k: number, o: Partial<FilaPublica>) => Array.from({ length: k }, () => fila(o))
const def = (o: Partial<GraficaDef>): GraficaDef => ({ campo: 'satisfaction', grafica: 'barras', medida: 'conteo', desglose: null, ...o })
const filas = [...muchas(6, { satisfaction: 'Muy satisfecho', proyecto: 'A' }), ...muchas(2, { satisfaction: 'Satisfecho', proyecto: 'B' })]

// La opción es un objeto de forma libre; para leerla en la prueba basta una vista mínima.
type Opc = { series: { type: string; name?: string; stack?: string; data: { value: number | null; texto: string }[] }[]; xAxis?: { type: string; data?: string[] }; yAxis?: { type: string; inverse?: boolean; max?: number; data?: string[] }; legend?: unknown; animation: boolean; aria: { enabled: boolean } }
const opcion = (d: GraficaDef, f = filas): Opc => construirOpcion(calcularGrafica(f, d), d) as unknown as Opc

describe('opción de ECharts', () => {
  it('barras: categorías en el eje X, una serie, sin leyenda, sin animación y con accesibilidad', () => {
    const o = opcion(def({}))
    expect(o.xAxis).toMatchObject({ type: 'category', data: ['Muy satisfecho', 'Satisfecho'] })
    expect(o.yAxis?.type).toBe('value')
    expect(o.series).toHaveLength(1)
    expect(o.series[0]).toMatchObject({ type: 'bar' })
    expect(o.series[0]!.data.map((d) => d.texto)).toEqual(['6', '2'])
    expect(o.legend).toBeUndefined()
    expect(o.animation).toBe(false)
    expect(o.aria.enabled).toBe(true)
  })
  it('con comparación: barras sin huecos (solo los grupos con valor), leyenda por grupo y cifras intactas', () => {
    const o = opcion(def({ desglose: 'proyecto' })) as unknown as { series: { name: string; xAxisIndex?: number; data: ({ texto: string; value: number; grupo: string } | null)[] }[]; legend: { data: string[]; selectedMode: boolean } }
    const huecos = o.series.filter((s) => s.xAxisIndex === undefined)
    // Muy satisfecho: solo A (6). Satisfecho: solo B (2). Con un solo hueco basta: los ceros no ocupan lugar.
    expect(huecos).toHaveLength(1)
    expect(huecos[0]!.data.map((d) => d?.texto)).toEqual(['6', '2'])
    expect(huecos[0]!.data.map((d) => d?.grupo)).toEqual(['A', 'B'])
    // La leyenda sale de series vacías en ejes ocultos, una por grupo.
    expect(o.series.filter((s) => s.xAxisIndex === 1).map((s) => s.name)).toEqual(['A', 'B'])
    expect(o.legend.data).toEqual(['A', 'B'])
    expect(o.legend.selectedMode).toBe(false)
  })
  it('barras horizontales: ejes cambiados y categorías de arriba abajo', () => {
    const o = opcion(def({ grafica: 'barras_horizontales' }))
    expect(o.xAxis?.type).toBe('value')
    expect(o.yAxis).toMatchObject({ type: 'category', inverse: true })
  })
  it('apilada al 100 %: series apiladas y eje hasta 100', () => {
    const o = opcion(def({ grafica: 'apilada_100', medida: 'porcentaje' }))
    expect(o.series.every((s) => s.stack === 'total')).toBe(true)
    expect(o.yAxis?.max).toBe(100)
  })
  it('dona: serie de tipo pie sin ejes y sin categorías en cero', () => {
    const o = construirOpcion(calcularGrafica(filas, def({ grafica: 'dona' })), def({ grafica: 'dona' })) as unknown as { series: { type: string; data: { name: string }[] }[]; xAxis?: unknown }
    expect(o.series[0]!.type).toBe('pie')
    expect(o.series[0]!.data.map((d) => d.name)).toEqual(['Muy satisfecho', 'Satisfecho'])
    expect(o.xAxis).toBeUndefined()
  })
  it('la tabla y los datos vacíos no dibujan nada', () => {
    const tabla = def({ grafica: 'tabla' })
    expect(construirOpcion(calcularGrafica(filas, tabla), tabla)).toBeNull()
    expect(hayQueDibujar(calcularGrafica([], def({})), def({}))).toBe(false)
    expect(construirOpcion(calcularGrafica([], def({})), def({}))).toBeNull()
  })
  it('el alto crece con las barras horizontales y tiene tope', () => {
    const pocas = calcularGrafica(filas, def({ grafica: 'barras_horizontales' }))
    expect(altoGrafica(pocas, def({ grafica: 'barras_horizontales' }))).toBe(260)
    const muchasCat = { ...pocas, categorias: Array.from({ length: 80 }, (_, i) => `c${i}`) }
    expect(altoGrafica(muchasCat, def({ grafica: 'barras_horizontales' }))).toBe(720)
    expect(altoGrafica(pocas, def({}))).toBe(340)
  })
  it('el tooltip escapa el texto antes de pintarlo como HTML', () => {
    const o = construirOpcion(calcularGrafica(filas, def({})), def({})) as unknown as { tooltip: { formatter: (p: unknown) => string } }
    const html = o.tooltip.formatter([{ name: '<img src=x onerror=alert(1)>', seriesName: 'a"b', data: { value: 1, texto: '<b>1</b>' } }])
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<b>1</b>')
    expect(html).toContain('&lt;img')
  })
  it('la paleta tiene colores distintos', () => {
    expect(new Set(PALETA).size).toBe(PALETA.length)
  })
})

describe('dona en tarjeta compacta', () => {
  const datosDona = { titulo: 'M', categorias: ['A', 'B'], series: [{ nombre: 'Beneficiarios', celdas: [{ valor: 9, texto: '9' }, { valor: 1, texto: '1' }] }], unidad: 'conteo' as const, base: 10, total: 10, resumen: null, avisos: [] }
  const def = { campo: 'municipio_codigo', grafica: 'dona' as const, medida: 'conteo' as const, desglose: null }

  it('sin leyenda y solo con etiqueta en las porciones grandes', () => {
    const o = construirOpcion(datosDona, def, true) as { legend: { show: boolean }; series: { minShowLabelAngle: number }[] }
    expect(o.legend.show).toBe(false)
    expect(o.series[0]!.minShowLabelAngle).toBeGreaterThan(0)
  })

  it('a tamaño completo conserva la leyenda (con desplazamiento) y todas las etiquetas', () => {
    const o = construirOpcion(datosDona, def) as { legend: { show?: boolean; type: string }; series: { minShowLabelAngle: number }[] }
    expect(o.legend.show).not.toBe(false)
    expect(o.legend.type).toBe('scroll')
    expect(o.series[0]!.minShowLabelAngle).toBe(0)
  })
})

describe('barras con muchos grupos en tarjeta compacta', () => {
  const grupos = Array.from({ length: 8 }, (_, i) => `G${i}`)
  const datosMuchos = {
    titulo: 'S por G',
    categorias: ['X', 'Y'],
    series: grupos.map((g, i) => ({ nombre: g, celdas: [{ valor: i, texto: String(i) }, { valor: 0, texto: '0' }] })),
    unidad: 'conteo' as const,
    base: 28,
    total: 28,
    resumen: null,
    avisos: [],
  }
  const d = { campo: 'satisfaction', grafica: 'barras' as const, medida: 'conteo' as const, desglose: 'proyecto' }
  type Opc = { legend?: { type: string }; grid: { top: number }; series: { label?: { show: boolean } }[] }

  it('sin leyenda ni cifras sobre las barras (no caben)', () => {
    const o = construirOpcion(datosMuchos, d, true) as Opc
    expect(o.legend).toBeUndefined()
    expect(o.grid.top).toBe(20)
    expect(o.series.filter((s) => s.label).every((s) => s.label!.show === false)).toBe(true)
  })

  it('a tamaño completo la leyenda se desplaza en vez de tapar las barras', () => {
    const o = construirOpcion(datosMuchos, d) as Opc
    expect(o.legend?.type).toBe('scroll')
    expect(o.grid.top).toBe(44)
  })

  it('con pocos grupos conserva leyenda y cifras también en la tarjeta', () => {
    const pocos = { ...datosMuchos, series: datosMuchos.series.slice(0, 3) }
    const o = construirOpcion(pocos, d, true) as Opc
    expect(o.legend).toBeDefined()
    expect(o.series.filter((s) => s.label).every((s) => s.label!.show)).toBe(true)
  })
})

describe('barras agrupadas sin huecos', () => {
  const celda = (v: number | null) => ({ valor: v, texto: v === null ? 'Sin dato' : String(v) })
  const datosG = {
    titulo: 'T',
    categorias: ['X', 'Y', 'Z'],
    series: [
      { nombre: 'A', celdas: [celda(3), celda(1), celda(0)] },
      { nombre: 'B', celdas: [celda(0), celda(2), celda(0)] },
      { nombre: 'C', celdas: [celda(5), celda(4), celda(null)] },
    ],
    unidad: 'conteo' as const,
    base: 15,
    total: 15,
    resumen: null,
    avisos: [],
  }
  const d = { campo: 'satisfaction', grafica: 'barras' as const, medida: 'conteo' as const, desglose: 'proyecto' }
  type Barra = { grupo?: string; value: number; itemStyle: { color: string; decal: unknown } } | null
  const reales = (op: { series: { xAxisIndex?: number; data: Barra[] }[] }) => op.series.filter((s) => s.xAxisIndex === undefined)
  const o = { series: reales(construirOpcion(datosG, d) as { series: { xAxisIndex?: number; data: Barra[] }[] }) }

  it('los ceros y los "sin dato" no ocupan hueco', () => {
    // X: A, C · Y: A, B, C · Z: nada → 3 huecos como máximo.
    expect(o.series).toHaveLength(3)
    const grupos = (i: number) => o.series.map((s) => s.data[i]?.grupo ?? null)
    expect(grupos(1)).toEqual(['A', 'B', 'C'])
    expect(grupos(2)).toEqual([null, null, null])
  })

  it('una categoría con menos barras queda centrada entre los huecos', () => {
    const grupos = (i: number) => o.series.map((s) => s.data[i]?.grupo ?? null)
    // X tiene 2 de 3 huecos: se desplaza medio hueco (redondeado hacia abajo = 0) → A, C, vacío.
    expect(grupos(0)).toEqual(['A', 'C', null])
  })

  it('cada barra conserva el color y el patrón de su grupo, igual en todas las categorías', () => {
    const estilo = (g: string) => o.series.flatMap((s) => s.data).filter((b) => b?.grupo === g).map((b) => JSON.stringify(b!.itemStyle))
    for (const g of ['A', 'B', 'C']) expect(new Set(estilo(g)).size).toBe(1)
    expect(new Set(['A', 'B', 'C'].map((g) => estilo(g)[0])).size).toBe(3)
  })

  it('con todo en cero sigue habiendo un hueco para que los ejes se dibujen', () => {
    const ceros = { ...datosG, series: datosG.series.map((s) => ({ ...s, celdas: s.celdas.map(() => celda(0)) })) }
    const oz = reales(construirOpcion(ceros, d) as { series: { xAxisIndex?: number; data: Barra[] }[] })
    expect(oz).toHaveLength(1)
    expect(oz[0]!.data.every((b) => b === null)).toBe(true)
  })

  it('la barra apilada no se reorganiza: sigue una serie por categoría del campo', () => {
    const oa = construirOpcion(datosG, { ...d, grafica: 'apilada_100' as const, medida: 'porcentaje' as const }) as { series: { name: string; stack: string }[] }
    expect(oa.series.map((s) => s.name)).toEqual(['A', 'B', 'C'])
    expect(oa.series.every((s) => s.stack === 'total')).toBe(true)
  })
})
