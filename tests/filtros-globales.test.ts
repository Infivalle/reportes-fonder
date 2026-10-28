import { describe, expect, it } from 'vitest'
import { aplicarFiltros, calcularIndicadores } from '../src/indicadores/calcular'
import { claveProyecto } from '../src/indicadores/proyectos'
import type { FilaPublica, PublicoJson } from '../src/publico/tipos'
import {
  SIN_FILTROS_GLOBALES,
  construirHash,
  hayFiltros,
  leerHash,
  opcionesDe,
  sanearFiltros,
} from '../src/interfaz/ruta'

const P1 = 'Fonder Valle Primera Convocatoria'
const P2 = 'FONDERVALLE SEGUNDA CONVOCATORIA'

let n = 0
function fila(o: Partial<FilaPublica> = {}): FilaPublica {
  n += 1
  return {
    id: `a${String(n).padStart(4, '0')}`, beneficiario: `b${String(n).padStart(4, '0')}`, proyecto: P1,
    municipio_codigo: '76001', mes: '2026-10', credit_used_as_approved: null, time_to_results: null,
    results_as_expected: null, financial_records: null, resource_manager: null, payments_on_schedule: null,
    satisfaction: 'Satisfecho', need_another_credit: null, current_employees: null, rango_ingreso_mensual: null,
    rango_costos_fijos: null, rango_costos_variables: null, rango_cuota_mensual: null, rango_reserva_emergencia: null,
    rango_ventas_total: null, rango_clientes_mes: null, rango_ventas_mes: null, credit_used_percentage: null,
    debt_level: null, mejoras: [], canales: [], atipica: false, ...o,
  }
}
function publico(asesorias: FilaPublica[], denominadores: PublicoJson['denominadores'] = []): PublicoJson {
  return {
    version: 1, generado_en: 'x', fecha_corte: null, fuente_municipio: 'empresa',
    totales: { asesorias_conservadas: asesorias.length, asesorias_descartadas: 0, beneficiarios_con_asesoria: asesorias.length },
    denominadores, asesorias, agregados: [],
  }
}

describe('filtros globales en los cálculos', () => {
  const filas = [
    fila({ proyecto: P1, municipio_codigo: '76001', mes: '2026-10' }),
    fila({ proyecto: P1, municipio_codigo: '76834', mes: '2026-10' }),
    fila({ proyecto: P2, municipio_codigo: '76834', mes: '2026-11' }),
    fila({ proyecto: P2, municipio_codigo: null, mes: '2026-11' }),
  ]
  it('se combinan con AND y ausentes equivalen a sin filtro', () => {
    expect(aplicarFiltros(filas, { proyecto: null })).toHaveLength(4)
    expect(aplicarFiltros(filas, { proyecto: null, municipio: '76834' })).toHaveLength(2)
    expect(aplicarFiltros(filas, { proyecto: claveProyecto(P2), municipio: '76834' })).toHaveLength(1)
    expect(aplicarFiltros(filas, { proyecto: null, mes: '2026-11' })).toHaveLength(2)
    expect(aplicarFiltros(filas, { proyecto: claveProyecto(P1), municipio: '76834', mes: '2026-11' })).toHaveLength(0)
  })
  it('con municipio filtrado la cobertura es "Sin dato" y lo dice (no inventa un denominador)', () => {
    const d = [{ proyecto: P1, total_beneficiarios: 10 }, { proyecto: P2, total_beneficiarios: 10 }]
    const r = calcularIndicadores(publico(filas, d), { proyecto: null, municipio: '76834' })
    expect(r.cobertura).toMatchObject({ atendidos: 2, total: null, porcentaje: null, porMunicipio: true })
    expect(r.municipios.visitados).toBe(1)
    const sin = calcularIndicadores(publico(filas, d), { proyecto: null })
    expect(sin.cobertura).toMatchObject({ total: 20, porMunicipio: false })
  })
  it('con mes filtrado conserva el denominador de la convocatoria', () => {
    const r = calcularIndicadores(publico(filas, [{ proyecto: P1, total_beneficiarios: 10 }]), { proyecto: claveProyecto(P1), mes: '2026-10' })
    expect(r.cobertura).toMatchObject({ atendidos: 2, total: 10 })
  })
})

describe('ruta y filtros en la URL', () => {
  it('ida y vuelta, con orden estable y solo filtros activos', () => {
    const f = { proyecto: 'fondervalleprimeraconvocatoria', municipio: '76834', mes: '2026-10' }
    const h = construirHash('graficas', f)
    expect(h).toBe('#/graficas?conv=fondervalleprimeraconvocatoria&mun=76834&mes=2026-10')
    expect(leerHash(h)).toEqual({ ruta: 'graficas', filtros: f })
    expect(construirHash('indicadores', SIN_FILTROS_GLOBALES)).toBe('#/indicadores')
    expect(hayFiltros(SIN_FILTROS_GLOBALES)).toBe(false)
    expect(hayFiltros(f)).toBe(true)
  })
  it('lo desconocido o ilegible vuelve a los valores por defecto', () => {
    expect(leerHash('')).toEqual({ ruta: 'indicadores', filtros: SIN_FILTROS_GLOBALES })
    expect(leerHash('#/no-existe')).toEqual({ ruta: 'indicadores', filtros: SIN_FILTROS_GLOBALES })
    expect(leerHash('#/graficas/').ruta).toBe('graficas')
  })
  it('la URL es entrada no confiable: descarta parámetros con formato inválido', () => {
    const e = leerHash('#/indicadores?conv=<script>alert(1)</script>&mun=99999&mes=2026-13')
    expect(e.filtros).toEqual(SIN_FILTROS_GLOBALES)
    expect(leerHash('#/indicadores?conv=' + 'a'.repeat(200)).filtros.proyecto).toBeNull()
    expect(leerHash('#/indicadores?mun=76001&mun=76834').filtros.municipio).toBe('76001')
  })
  it('opciones: solo lo que existe en los datos, con nombres y meses legibles', () => {
    const o = opcionesDe(publico([
      fila({ municipio_codigo: '76834', mes: '2026-10' }), fila({ municipio_codigo: '76001', mes: '2026-11' }),
      fila({ municipio_codigo: null, proyecto: P2 }),
    ]))
    expect(o.proyectos.map((p) => p.etiqueta)).toEqual(['Primera convocatoria', 'Segunda convocatoria'])
    expect(o.municipios.map((m) => m.nombre)).toEqual(['Cali', 'Tuluá'])
    expect(o.meses.map((m) => m.etiqueta)).toEqual(['Noviembre de 2026', 'Octubre de 2026'])
  })
  it('sanear quita filtros que ya no existen en los datos', () => {
    const o = opcionesDe(publico([fila({ municipio_codigo: '76001' })]))
    const f = sanearFiltros({ proyecto: 'otroproyecto', municipio: '76834', mes: '2020-01' }, o)
    expect(f).toEqual(SIN_FILTROS_GLOBALES)
    const bueno = { proyecto: claveProyecto(P1), municipio: '76001', mes: '2026-10' }
    expect(sanearFiltros(bueno, o)).toEqual(bueno)
  })
})
