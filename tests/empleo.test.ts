import { describe, expect, it } from 'vitest'
import { generacionDeEmpleo } from '../src/indicadores/empleo'

const dist = (items: [string, number][], n: number) => ({ n, items: items.map(([valor, conteo]) => ({ valor, conteo, porcentaje: null })) })

describe('generacionDeEmpleo', () => {
  it('cuenta a quienes marcaron "Generación de empleo" sobre quienes respondieron', () => {
    expect(generacionDeEmpleo(dist([['Capital de trabajo', 49], ['Generación de empleo', 20], ['Otras', 5]], 80))).toEqual({ conteo: 20, porcentaje: 25, n: 80 })
  })
  it('si la opción no aparece, son 0 (no "sin dato") siempre que haya respuestas', () => {
    expect(generacionDeEmpleo(dist([['Capital de trabajo', 3]], 3))).toEqual({ conteo: 0, porcentaje: 0, n: 3 })
  })
  it('sin respuestas: porcentaje null', () => {
    expect(generacionDeEmpleo({ n: 0, items: [] })).toEqual({ conteo: 0, porcentaje: null, n: 0 })
  })
})
