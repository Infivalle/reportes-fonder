import { describe, expect, it } from 'vitest'
import { calcularCruce, formatoUtc, type FilaCartera } from '../src/privado/cruce'

const fila = (cedula: string, extra: Partial<FilaCartera> = {}): FilaCartera => ({
  cedula, nombre: `Persona ${cedula}`, anio: 2024, estado: 'Vigente', municipio: 'Cali', equipo: '', ...extra,
})

describe('calcularCruce', () => {
  const cartera = [
    fila('100'), fila('200', { anio: 2026, estado: 'Mora' }), fila('300', { anio: 2026, estado: 'Pagado / saldo cero' }),
    fila('300', { anio: 2026, estado: 'Pagado / saldo cero' }), fila('', { nombre: 'Sin cédula' }),
  ]
  const asesorias = [
    { documento: '100', creadaEn: '2026-11-03T00:04:16Z' },
    { documento: ' 100 ', creadaEn: '2026-11-01T10:00:00.000Z' },
    { documento: '100', creadaEn: '2026-11-03T00:04:16Z' },
    { documento: '300', creadaEn: '2026-11-05T09:00:00Z' },
    { documento: '999', creadaEn: '2026-11-06T09:00:00Z' },
  ]
  const r = calcularCruce(cartera, asesorias, [{ documento: '999', nombres: 'Ana', apellidos: ' Pérez ' }])

  it('cuenta todas las filas (sin quitar duplicados) y toma primera y última en UTC', () => {
    expect(r.filas[0]).toMatchObject({ tieneAsesoria: true, registros: 3, primera: '2026-11-01 10:00:00', ultima: '2026-11-03 00:04:16' })
    expect(r.filas[1]).toMatchObject({ tieneAsesoria: false, registros: 0, primera: null, ultima: null })
  })
  it('las cédulas repetidas en la cartera conservan sus dos filas y la misma marca', () => {
    expect(r.filas[2]?.tieneAsesoria).toBe(true)
    expect(r.filas[3]?.tieneAsesoria).toBe(true)
  })
  it('totales: filas, cédulas distintas, con y sin asesoría', () => {
    expect(r.filasExcel).toBe(5)
    expect(r.cedulasDistintas).toBe(3)
    expect(r.cedulasConAsesoria).toBe(2)
    expect(r.cedulasSinAsesoria).toBe(1)
  })
  it('una fila sin cédula nunca cruza', () => {
    expect(r.filas[4]).toMatchObject({ tieneAsesoria: false, registros: 0 })
  })
  it('lista los documentos con asesoría que no están en la cartera', () => {
    expect(r.sinMatch).toEqual([{ documento: '999', nombre: 'Ana Pérez', registros: 1 }])
  })
  it('por estado y por año cuentan filas, no cédulas', () => {
    expect(r.porEstado.map((g) => [g.grupo, g.filas, g.conAsesoria])).toEqual([['Vigente', 2, 1], ['Pagado / saldo cero', 2, 2], ['Mora', 1, 0]])
    expect(r.porAnio.map((g) => [g.grupo, g.filas, g.conAsesoria, g.proporcion])).toEqual([[2024, 2, 1, 0.5], [2026, 3, 2, 0.667]])
  })
  it('no normaliza puntos ni ceros a la izquierda', () => {
    const x = calcularCruce([fila('0123'), fila('1.234')], [{ documento: '123', creadaEn: '2026-01-01T00:00:00Z' }, { documento: '1234', creadaEn: '2026-01-01T00:00:00Z' }], [])
    expect(x.filas.map((f) => f.tieneAsesoria)).toEqual([false, false])
    expect(x.sinMatch).toHaveLength(2)
  })
  it('fechas ilegibles no rompen el conteo', () => {
    const x = calcularCruce([fila('1')], [{ documento: '1', creadaEn: 'no es fecha' }], [])
    expect(x.filas[0]).toMatchObject({ tieneAsesoria: true, registros: 1, primera: null })
    expect(formatoUtc('no es fecha')).toBeNull()
  })
})
