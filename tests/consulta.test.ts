import { describe, expect, it } from 'vitest'
import { CATALOGO, GRAFICAS_POR_TIPO, MEDIDAS_POR_TIPO, buscarCampo } from '../src/catalogo/campos'
import { cruzar, distribuir, etiquetaCategoria, etiquetaMes, filtrarPorCampos, resumirNumerico, textoCelda } from '../src/indicadores/consulta'
import { ultimaPorBeneficiario } from '../src/indicadores/calcular'
import type { FilaPublica } from '../src/publico/tipos'

let seq = 0
function fila(p: Partial<FilaPublica> = {}): FilaPublica {
  seq++
  return {
    id: `a${seq}`, beneficiario: `b${seq}`, proyecto: 'Primera convocatoria', municipio_codigo: '76001', mes: '2026-10',
    credit_used_as_approved: null, time_to_results: null, results_as_expected: null, financial_records: null,
    resource_manager: null, payments_on_schedule: null, satisfaction: null, need_another_credit: null,
    current_employees: null, rango_ingreso_mensual: null, rango_costos_fijos: null, rango_costos_variables: null,
    rango_cuota_mensual: null, rango_reserva_emergencia: null, rango_ventas_total: null, rango_clientes_mes: null,
    rango_ventas_mes: null, credit_used_percentage: null, debt_level: null, mejoras: [], canales: [], atipica: false, ...p,
  }
}

describe('catálogo', () => {
  it('claves únicas y existentes en FilaPublica', () => {
    const claves = CATALOGO.map((c) => c.clave)
    expect(new Set(claves).size).toBe(claves.length)
    const muestra = fila()
    for (const c of claves) expect(c in muestra, c).toBe(true)
  })
  it('todo campo es público y cada tipo tiene gráficas y medidas', () => {
    for (const c of CATALOGO) {
      expect(c.capa).toBe('publica')
      expect(GRAFICAS_POR_TIPO[c.tipo].length).toBeGreaterThan(0)
      expect(MEDIDAS_POR_TIPO[c.tipo].length).toBeGreaterThan(0)
    }
  })
  it('no expone campos de texto libre ni identificadores', () => {
    for (const c of CATALOGO) expect(['id', 'beneficiario', 'atipica']).not.toContain(c.clave)
  })
})

describe('filtros', () => {
  const filas = [
    fila({ proyecto: 'A', mes: '2026-09', mejoras: ['AI'] }),
    fila({ proyecto: 'A', mes: '2026-10', mejoras: ['CT', 'AI'] }),
    fila({ proyecto: 'B', mes: '2026-10' }),
  ]
  it('sin filtros devuelve todo; AND entre campos; OR dentro del campo', () => {
    expect(filtrarPorCampos(filas, {})).toHaveLength(3)
    expect(filtrarPorCampos(filas, { proyecto: ['A'], mes: ['2026-10'] })).toHaveLength(1)
    expect(filtrarPorCampos(filas, { proyecto: ['A', 'B'] })).toHaveLength(3)
    expect(filtrarPorCampos(filas, { proyecto: [] })).toHaveLength(3)
  })
  it('filtra por campo multivalor y descarta claves desconocidas', () => {
    expect(filtrarPorCampos(filas, { mejoras: ['CT'] })).toHaveLength(1)
    expect(filtrarPorCampos(filas, { inventado: ['x'] })).toHaveLength(0)
  })
})

describe('distribuir', () => {
  it('ordena como el formulario, incluye desconocidas al final y calcula % sobre respondieron', () => {
    const filas = [
      fila({ satisfaction: 'Satisfecho' }), fila({ satisfaction: 'Muy satisfecho' }), fila({ satisfaction: 'Muy satisfecho' }),
      fila({ satisfaction: 'Raro' }), fila({ satisfaction: null }),
    ]
    const s = distribuir(filas, 'satisfaction', 'porcentaje')
    expect(s.categorias.map((c) => c.valor)).toEqual(['Muy satisfecho', 'Satisfecho', 'Raro'])
    expect(s.respondieron).toBe(4)
    expect(s.total).toBe(5)
    expect(s.categorias[0]?.porcentaje).toBe(50)
  })
  it('multivalor: una vez por beneficiario y por código; % puede pasar de 100', () => {
    const filas = [fila({ mejoras: ['AI', 'CT'] }), fila({ mejoras: ['AI'] })]
    const s = distribuir(filas, 'mejoras', 'porcentaje')
    expect(s.categorias.find((c) => c.valor === 'AI')?.porcentaje).toBe(100)
    expect(s.categorias.reduce((t, c) => t + (c.porcentaje ?? 0), 0)).toBeGreaterThan(100)
  })
  it('usa la asesoría más reciente por beneficiario', () => {
    const viejo = fila({ beneficiario: 'x', mes: '2026-09', satisfaction: 'Insatisfecho' })
    const nuevo = fila({ beneficiario: 'x', mes: '2026-10', satisfaction: 'Satisfecho' })
    expect(ultimaPorBeneficiario([viejo, nuevo])).toEqual([nuevo])
    expect(distribuir([nuevo, viejo], 'satisfaction').categorias).toEqual([{ valor: 'Satisfecho', n: 1, porcentaje: null }])
  })
  it('rechaza campos numéricos', () => {
    expect(() => distribuir([], 'debt_level')).toThrow()
  })
  it('lista vacía no divide por cero', () => {
    const s = distribuir([], 'satisfaction', 'porcentaje')
    expect(s).toMatchObject({ respondieron: 0, total: 0, categorias: [] })
  })
})

describe('numérico y cruce', () => {
  it('mediana par e impar, ignora nulos', () => {
    const f = (x: number | null) => fila({ credit_used_percentage: x })
    expect(resumirNumerico([f(10), f(30), f(20), f(null)], 'credit_used_percentage')).toMatchObject({ n: 3, mediana: 20, promedio: 20, minimo: 10, maximo: 30 })
    expect(resumirNumerico([f(10), f(20), f(30), f(40)], 'credit_used_percentage').mediana).toBe(25)
    expect(resumirNumerico([], 'credit_used_percentage').promedio).toBeNull()
  })
  it('suprime celdas de 1 a 4 y muestra "<5"', () => {
    const filas = [
      ...Array.from({ length: 6 }, () => fila({ satisfaction: 'Satisfecho', proyecto: 'A' })),
      ...Array.from({ length: 3 }, () => fila({ satisfaction: 'Satisfecho', proyecto: 'B' })),
    ]
    const c = cruzar(filas, 'proyecto', 'satisfaction')
    expect(textoCelda(c.find((x) => x.fila === 'A')!)).toBe('6')
    expect(textoCelda(c.find((x) => x.fila === 'B')!)).toBe('<5')
  })
  it('la convocatoria se unifica aunque el origen la escriba distinto', () => {
    const filas = [
      fila({ proyecto: 'FONDERVALLE SEGUNDA CONVOCATORIA' }),
      fila({ proyecto: 'Fonder Valle Segunda Convocatoria' }),
      fila({ proyecto: 'Fonder Valle Primera Convocatoria' }),
    ]
    const s = distribuir(filas, 'proyecto')
    expect(s.categorias.map((c) => [c.valor, c.n]).sort()).toEqual([['Primera convocatoria', 1], ['Segunda convocatoria', 2]])
  })
  it('etiquetas legibles', () => {
    expect(etiquetaCategoria('municipio_codigo', '76834')).toBe('Tuluá')
    expect(etiquetaCategoria('mejoras', 'CT')).toBe('Capital de trabajo')
    expect(etiquetaCategoria('mejoras', 'ZZ')).toBe('ZZ')
    expect(etiquetaCategoria('mes', '2026-10')).toBe('Octubre de 2026')
    expect(etiquetaMes('raro')).toBe('raro')
  })
  it('buscarCampo', () => {
    expect(buscarCampo('mejoras')?.tipo).toBe('multivalor')
    expect(buscarCampo('nada')).toBeUndefined()
  })
})
