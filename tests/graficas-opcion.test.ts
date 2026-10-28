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
  it('con comparación hay una serie por grupo y leyenda; las celdas suprimidas no tienen valor', () => {
    const o = opcion(def({ desglose: 'proyecto' }))
    expect(o.series.map((s) => s.name)).toEqual(['A', 'B'])
    expect(o.legend).toBeDefined()
    expect(o.series[1]!.data.map((d) => d.texto)).toEqual(['0', '<5'])
    expect(o.series[1]!.data[1]!.value).toBeNull()
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
