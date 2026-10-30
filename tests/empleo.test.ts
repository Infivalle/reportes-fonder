import { describe, expect, it } from 'vitest'
import { empleosMinimos, limiteInferior } from '../src/indicadores/empleo'

const dist = (items: [string, number][]) => ({
  n: items.reduce((s, [, c]) => s + c, 0),
  items: items.map(([valor, conteo]) => ({ valor, conteo, porcentaje: null })),
})

describe('limiteInferior', () => {
  it.each([
    ['0', 0],
    ['1 a 2', 1],
    ['De 1 a 5', 1],
    ['De 5 a 10', 5],
    ['De 10 a 15', 10],
    ['Entre 3 y 5', 3],
    ['Más de 5', 6],
    ['mas de 15', 16],
    ['10 o más', 10],
  ])('%s → %s', (texto, esperado) => expect(limiteInferior(texto)).toBe(esperado))

  it('lo que no es rango da null', () => {
    expect(limiteInferior('')).toBeNull()
    expect(limiteInferior('Ninguno')).toBeNull()
  })
})

describe('empleosMinimos', () => {
  it('suma extremo inferior × personas', () => {
    expect(empleosMinimos(dist([['De 1 a 5', 100], ['De 5 a 10', 20], ['De 10 a 15', 3]]))).toEqual({ minimo: 100 + 100 + 30, personas: 123, sinInterpretar: 0 })
  })
  it('un rango desconocido no suma y se cuenta aparte', () => {
    expect(empleosMinimos(dist([['De 1 a 5', 2], ['Otro', 4]]))).toEqual({ minimo: 2, personas: 2, sinInterpretar: 4 })
  })
  it('sin respuestas: cero', () => {
    expect(empleosMinimos({ n: 0, items: [] })).toEqual({ minimo: 0, personas: 0, sinInterpretar: 0 })
  })
})
