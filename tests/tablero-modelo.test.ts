import { describe, expect, it } from 'vitest'
import {
  MAX_TARJETAS,
  VERSION_TABLERO,
  agregarTarjeta,
  duplicarTarjeta,
  leerTablero,
  moverTarjeta,
  nuevaTarjeta,
  quitarTarjeta,
  reemplazarTarjeta,
  serializarTablero,
  tableroInicial,
  tableroVacio,
} from '../src/tablero/modelo'
import { nuevaDef } from '../src/graficas/definicion'
import { resumenFiltros } from '../src/tablero/resumen'

const con = (...campos: string[]) => campos.reduce((t, c) => agregarTarjeta(t, nuevaTarjeta(nuevaDef(c))), tableroVacio())
const campos = (t: ReturnType<typeof tableroVacio>) => t.tarjetas.map((x) => x.def.campo)

describe('operaciones del tablero', () => {
  it('la primera visita trae una gráfica de ejemplo', () => {
    expect(campos(tableroInicial())).toEqual(['satisfaction'])
  })

  it('agrega al final y respeta el máximo', () => {
    let t = tableroVacio()
    for (let i = 0; i < MAX_TARJETAS + 3; i++) t = agregarTarjeta(t, nuevaTarjeta())
    expect(t.tarjetas).toHaveLength(MAX_TARJETAS)
  })

  it('duplica justo después de la original, con id nuevo y sin compartir los filtros', () => {
    const t = agregarTarjeta(con('satisfaction'), nuevaTarjeta(nuevaDef('debt_level'), { proyecto: ['A'] }))
    const id = t.tarjetas[1]!.id
    const d = duplicarTarjeta(t, id)
    expect(campos(d)).toEqual(['satisfaction', 'debt_level', 'debt_level'])
    expect(d.tarjetas[2]!.id).not.toBe(id)
    expect(d.tarjetas[2]!.filtros.proyecto).toEqual(['A'])
    expect(d.tarjetas[2]!.filtros.proyecto).not.toBe(d.tarjetas[1]!.filtros.proyecto)
  })

  it('mueve una posición y no se sale de los extremos', () => {
    const t = con('satisfaction', 'debt_level', 'mejoras')
    const [a, b, c] = t.tarjetas.map((x) => x.id) as [string, string, string]
    expect(moverTarjeta(t, c, -1).tarjetas.map((x) => x.id)).toEqual([a, c, b])
    expect(moverTarjeta(t, a, 1).tarjetas.map((x) => x.id)).toEqual([b, a, c])
    expect(moverTarjeta(t, a, -1)).toBe(t)
    expect(moverTarjeta(t, c, 1)).toBe(t)
  })

  it('quita y reemplaza por id sin tocar las demás', () => {
    const t = con('satisfaction', 'debt_level')
    const [a, b] = t.tarjetas.map((x) => x.id) as [string, string]
    expect(campos(quitarTarjeta(t, a))).toEqual(['debt_level'])
    const r = reemplazarTarjeta(t, b, nuevaDef('mejoras'), { mes: ['2026-10'] })
    expect(campos(r)).toEqual(['satisfaction', 'mejoras'])
    expect(r.tarjetas[1]!.id).toBe(b)
    expect(r.tarjetas[1]!.filtros).toEqual({ mes: ['2026-10'] })
  })
})

describe('leerTablero', () => {
  it('ida y vuelta: lo exportado se importa igual', () => {
    const t = agregarTarjeta(con('satisfaction'), nuevaTarjeta({ ...nuevaDef('mejoras'), desglose: 'proyecto' }, { municipio_codigo: ['76001', '76109'] }))
    const lectura = leerTablero(serializarTablero(t))
    expect(lectura).toEqual({ ok: true, tablero: t, descartadas: 0 })
  })

  it.each([
    ['no es JSON', '{{', /JSON válido/],
    ['no es un objeto de tablero', '[]', /formato/],
    ['sin tarjetas', '{"version":1}', /formato/],
    ['sin versión', '{"tarjetas":[]}', /versión/],
    ['de una versión futura', `{"version":${VERSION_TABLERO + 1},"tarjetas":[]}`, /más nueva/],
  ])('rechaza un archivo que %s', (_caso, texto, motivo) => {
    const l = leerTablero(texto)
    expect(l.ok).toBe(false)
    if (!l.ok) expect(l.motivo).toMatch(motivo)
  })

  it('rechaza un archivo demasiado grande', () => {
    expect(leerTablero(' '.repeat(300_000)).ok).toBe(false)
  })

  it('descarta tarjetas con campos desconocidos y cuenta cuántas', () => {
    const texto = JSON.stringify({
      version: 1,
      tarjetas: [
        { id: 'a', def: { campo: 'satisfaction', grafica: 'barras', medida: 'conteo', desglose: null }, filtros: {} },
        { id: 'b', def: { campo: 'nombre_beneficiario', grafica: 'barras', medida: 'conteo', desglose: null }, filtros: {} },
        { id: 'c', def: 'basura' },
        null,
      ],
    })
    const l = leerTablero(texto)
    expect(l.ok && l.tablero.tarjetas.map((t) => t.id)).toEqual(['a'])
    expect(l.ok && l.descartadas).toBe(3)
  })

  it('corrige combinaciones inválidas con las reglas del catálogo', () => {
    const texto = JSON.stringify({
      version: 1,
      tarjetas: [{ id: 'a', def: { campo: 'satisfaction', grafica: 'dona', medida: 'promedio', desglose: 'debt_level' }, filtros: {} }],
    })
    const l = leerTablero(texto)
    expect(l.ok && l.tablero.tarjetas[0]!.def).toEqual({ campo: 'satisfaction', grafica: 'barras', medida: 'conteo', desglose: null })
  })

  it('en los filtros deja solo campos filtrables y valores de texto acotados, y quita lo que sobra', () => {
    const texto = JSON.stringify({
      version: 1,
      tarjetas: [
        {
          id: 'a',
          def: { campo: 'satisfaction', grafica: 'barras', medida: 'conteo', desglose: null },
          filtros: { proyecto: ['P', 'P', '', 3, 'x'.repeat(500)], debt_level: ['1'], campo_falso: ['x'], mes: 'no-es-lista' },
          extra: 'se ignora',
        },
      ],
    })
    const l = leerTablero(texto)
    expect(l.ok && l.tablero.tarjetas[0]).toEqual({
      id: 'a',
      def: { campo: 'satisfaction', grafica: 'barras', medida: 'conteo', desglose: null },
      filtros: { proyecto: ['P'] },
    })
  })

  it('genera ids nuevos si faltan, son raros o se repiten', () => {
    const def = { campo: 'satisfaction', grafica: 'barras', medida: 'conteo', desglose: null }
    const l = leerTablero(JSON.stringify({ version: 1, tarjetas: [{ id: 'x', def }, { id: 'x', def }, { id: '<script>', def }, { def }] }))
    const ids = l.ok ? l.tablero.tarjetas.map((t) => t.id) : []
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
    expect(ids[0]).toBe('x')
    expect(ids.every((i) => /^[A-Za-z0-9_-]+$/.test(i))).toBe(true)
  })

  it('lee como máximo MAX_TARJETAS', () => {
    const def = { campo: 'satisfaction', grafica: 'barras', medida: 'conteo', desglose: null }
    const l = leerTablero(JSON.stringify({ version: 1, tarjetas: Array.from({ length: 40 }, () => ({ def })) }))
    expect(l.ok && l.tablero.tarjetas).toHaveLength(MAX_TARJETAS)
  })
})

describe('resumenFiltros', () => {
  it('nombra el campo y el valor, o cuenta las opciones', () => {
    expect(resumenFiltros({})).toBe('')
    expect(resumenFiltros({ municipio_codigo: ['76001'], mes: ['2026-10', '2026-11'] })).toBe('Municipio: Cali · Mes de la asesoría: 2 opciones')
  })
})
