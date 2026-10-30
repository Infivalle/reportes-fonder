import { describe, expect, it } from 'vitest'
import { buscarCampo } from '../src/catalogo/campos'
import { normalizar } from '../src/graficas/definicion'
import { DEFS_EJEMPLO, MAX_TARJETAS, tableroInicial } from '../src/tablero/modelo'

describe('gráficas de ejemplo del tablero', () => {
  it('son las seis acordadas, en orden', () => {
    expect(DEFS_EJEMPLO.map((d) => `${d.campo}:${d.grafica}`)).toEqual([
      'municipio_codigo:dona',
      'mejoras:barras_horizontales',
      'satisfaction:barras',
      'canales:barras_horizontales',
      'financial_records:dona',
      'current_employees:barras',
    ])
  })

  it.each(DEFS_EJEMPLO.map((d) => [d.campo, d] as const))('%s: ya es válida (normalizar no la cambia)', (_campo, def) => {
    expect(buscarCampo(def.campo)).toBeDefined()
    expect(normalizar({ ...def })).toEqual(def)
  })

  it('la satisfacción va en porcentaje y el destino se desglosa por municipio', () => {
    expect(DEFS_EJEMPLO.find((d) => d.campo === 'satisfaction')?.medida).toBe('porcentaje')
    expect(DEFS_EJEMPLO.find((d) => d.campo === 'mejoras')?.desglose).toBe('municipio_codigo')
  })

  it('el tablero inicial tiene una tarjeta por gráfica, con ids distintos y sin filtros propios', () => {
    const t = tableroInicial()
    expect(t.tarjetas).toHaveLength(DEFS_EJEMPLO.length)
    expect(t.tarjetas.length).toBeLessThanOrEqual(MAX_TARJETAS)
    expect(new Set(t.tarjetas.map((x) => x.id)).size).toBe(t.tarjetas.length)
    expect(t.tarjetas.every((x) => Object.keys(x.filtros).length === 0)).toBe(true)
  })
})
