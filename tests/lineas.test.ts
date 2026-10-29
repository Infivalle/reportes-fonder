import { describe, expect, it } from 'vitest'
import { claveDocumento, normalizarLinea, procesarLineas, sqlDeCarga } from '../src/lineas/lineas'
import { buscarCampo } from '../src/catalogo/campos'
import { calcularGrafica } from '../src/graficas/datos'
import type { FilaPublica } from '../src/publico/tipos'

describe('claveDocumento', () => {
  it('iguala formatos distintos de la misma cédula', () => {
    expect(claveDocumento('1.234.567')).toBe('1234567')
    expect(claveDocumento(' 01234567 ')).toBe('1234567')
    expect(claveDocumento(1234567)).toBe('1234567')
    expect(claveDocumento('ab-12')).toBe('AB12')
  })
  it('vacío o sin dígitos útiles es null', () => {
    for (const v of [null, undefined, '', '  ', '---', '000']) expect(claveDocumento(v)).toBeNull()
  })
})

describe('normalizarLinea', () => {
  it('acepta las variantes de escritura', () => {
    expect(normalizarLinea('Línea 1')).toBe('Línea 1')
    expect(normalizarLinea('linea 2')).toBe('Línea 2')
    expect(normalizarLinea(' LÍNEA 1 ')).toBe('Línea 1')
    expect(normalizarLinea(2)).toBe('Línea 2')
  })
  it('rechaza lo demás', () => {
    for (const v of [null, '', 'Línea 3', 'Linea', 'otra', 0]) expect(normalizarLinea(v)).toBeNull()
  })
})

const f = (fila: number, cedula: unknown, anio: unknown, linea: unknown) => ({ fila, cedula, anio, linea })

describe('procesarLineas', () => {
  it('toma la línea tal cual, sin recalcularla', () => {
    const r = procesarLineas([f(5, '111', 2024, 'Línea 2'), f(6, '222', 2026, 'Línea 1')])
    expect(r.errores).toEqual([])
    expect(r.desembolsos).toEqual([
      { clave: '111', linea: 'Línea 2', anio: 2024 },
      { clave: '222', linea: 'Línea 1', anio: 2026 },
    ])
    expect(r.porLinea).toEqual({ 'Línea 1': 1, 'Línea 2': 1 })
  })
  it('cédula repetida: gana el año más reciente, esté donde esté', () => {
    for (const filas of [
      [f(5, '111', 2024, 'Línea 1'), f(6, '0111', 2026, 'Línea 2')],
      [f(5, '111', 2026, 'Línea 2'), f(6, '111', 2024, 'Línea 1')],
    ]) {
      const r = procesarLineas(filas)
      expect(r.desembolsos).toEqual([{ clave: '111', linea: 'Línea 2', anio: 2026 }])
      expect(r.repetidas).toBe(1)
      expect(r.errores).toEqual([])
    }
  })
  it('mismo año y líneas distintas es un error; con la misma línea no', () => {
    expect(procesarLineas([f(5, '1', 2024, 'Línea 1'), f(6, '1', 2024, 'Línea 2')]).errores).toHaveLength(1)
    expect(procesarLineas([f(5, '1', 2024, 'Línea 1'), f(6, '1', 2024, 'Línea 1')]).errores).toEqual([])
  })
  it('detiene la carga con cédula vacía o línea desconocida, sin repetir datos en el mensaje', () => {
    const r = procesarLineas([f(5, '', 2024, 'Línea 1'), f(6, '999', 2024, 'Línea 3')])
    expect(r.errores).toEqual(['Fila 5: la cédula está vacía.', 'Fila 6: la línea no es "Línea 1" ni "Línea 2".'])
    expect(r.errores.join(' ')).not.toContain('999')
  })
  it('ignora las filas completamente vacías', () => {
    const r = procesarLineas([f(5, null, null, null), f(6, '1', 2024, 'Línea 1')])
    expect(r.leidas).toBe(1)
    expect(r.errores).toEqual([])
  })
  it('un año ilegible no impide cargar', () => {
    expect(procesarLineas([f(5, '1', 'x', 'Línea 1')]).desembolsos[0]!.anio).toBeNull()
  })
})

describe('sqlDeCarga', () => {
  it('reemplaza la tabla en una transacción y comprueba el total', () => {
    const sql = sqlDeCarga([{ clave: '1', linea: 'Línea 1', anio: 2024 }, { clave: "A'B", linea: 'Línea 2', anio: null }])
    expect(sql).toContain('begin;')
    expect(sql).toContain('delete from public.desembolsos where true;')
    expect(sql).toContain("('1', 'Línea 1', 2024)")
    expect(sql).toContain("('A''B', 'Línea 2', null)")
    expect(sql).toContain('<> 2 then raise exception')
    expect(sql.indexOf('begin;')).toBeLessThan(sql.indexOf('commit;'))
  })
  it('parte las cargas grandes en lotes y no acepta una lista vacía', () => {
    const muchos = Array.from({ length: 1200 }, (_, i) => ({ clave: String(i + 1), linea: 'Línea 1' as const, anio: 2024 }))
    expect(sqlDeCarga(muchos).match(/insert into/g)).toHaveLength(3)
    expect(() => sqlDeCarga([])).toThrow()
  })
})

describe('campo linea en las gráficas', () => {
  const fila = (n: number, linea: string | null, satisfaction: string | null): FilaPublica => ({
    id: `a${n}`, beneficiario: `b${n}`, proyecto: 'P', municipio_codigo: null, mes: '2026-10',
    credit_used_as_approved: null, time_to_results: null, results_as_expected: null, financial_records: null,
    resource_manager: null, payments_on_schedule: null, satisfaction, need_another_credit: null, current_employees: null,
    rango_ingreso_mensual: null, rango_costos_fijos: null, rango_costos_variables: null, rango_cuota_mensual: null,
    rango_reserva_emergencia: null, rango_ventas_total: null, rango_clientes_mes: null, rango_ventas_mes: null,
    credit_used_percentage: null, debt_level: null, mejoras: [], canales: [], atipica: false, linea,
  })
  const filas = [fila(1, 'Línea 1', 'Satisfecho'), fila(2, 'Línea 1', 'Satisfecho'), fila(3, 'Línea 2', 'Satisfecho'), fila(4, null, 'Satisfecho')]

  it('existe en el catálogo con sus dos opciones', () => {
    const c = buscarCampo('linea')
    expect(c?.tipo).toBe('categorico')
    expect(c && 'opciones' in c ? c.opciones : []).toEqual(['Línea 1', 'Línea 2'])
  })
  it('quien no tiene línea queda fuera de la gráfica por línea, no del total de los demás', () => {
    const porLinea = calcularGrafica(filas, { campo: 'linea', grafica: 'barras', medida: 'conteo', desglose: null })
    expect(porLinea.categorias).toEqual(['Línea 1', 'Línea 2'])
    expect(porLinea.series[0]!.celdas.map((c) => c.texto)).toEqual(['2', '1'])
    expect(porLinea.base).toBe(3)
    expect(porLinea.total).toBe(4)

    const sat = calcularGrafica(filas, { campo: 'satisfaction', grafica: 'barras', medida: 'conteo', desglose: null })
    expect(sat.base).toBe(4)

    const cruzada = calcularGrafica(filas, { campo: 'satisfaction', grafica: 'barras', medida: 'conteo', desglose: 'linea' })
    expect(cruzada.series.map((s) => s.nombre)).toEqual(['Línea 1', 'Línea 2'])
  })
})
