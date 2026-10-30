import { describe, expect, it } from 'vitest'
import { calcularIndicadores } from '../indicadores/calcular'
import { claveProyecto, etiquetaProyecto } from '../indicadores/proyectos'
import { MUNICIPIOS_VALLE } from '../limpieza/municipios'
import type { FilaPublica, PublicoJson } from '../publico/tipos'
import { calcularMapa, claseDe, clasesDeColor, convocatoriaDe, detalleMunicipio, ordenarMunicipios } from './datos'
import { GEOMETRIA_VALLE, VIEWBOX_VALLE } from './geometriaValle'
import { BENEFICIARIOS_POR_MUNICIPIO } from './totalesMunicipio'
import { SOMBRA_PLANA, cajaDeVista, matriz3D, puntosDeTrazado } from './proyeccion'

const P1 = 'FonderVallePrimeraConvocatoria'
const P2 = 'FonderValleSegundaConvocatoria'

let contador = 0
function fila(sobre: Partial<FilaPublica> & Pick<FilaPublica, 'beneficiario'>): FilaPublica {
  contador += 1
  return {
    id: `a${contador}`,
    proyecto: P1,
    municipio_codigo: '76001',
    mes: '2026-10',
    credit_used_as_approved: null,
    time_to_results: null,
    results_as_expected: null,
    financial_records: null,
    resource_manager: null,
    payments_on_schedule: null,
    satisfaction: null,
    need_another_credit: null,
    current_employees: null,
    rango_ingreso_mensual: null,
    rango_costos_fijos: null,
    rango_costos_variables: null,
    rango_cuota_mensual: null,
    rango_reserva_emergencia: null,
    rango_ventas_total: null,
    rango_clientes_mes: null,
    rango_ventas_mes: null,
    credit_used_percentage: null,
    debt_level: null,
    mejoras: [],
    canales: [],
    atipica: false,
    linea: null,
    ...sobre,
  }
}

function publico(asesorias: FilaPublica[], fuente: PublicoJson['fuente_municipio'] = 'empresa'): PublicoJson {
  return {
    version: 1,
    generado_en: '2026-10-29T00:00:00Z',
    fecha_corte: '2026-10-28',
    fuente_municipio: fuente,
    totales: { asesorias_conservadas: asesorias.length, asesorias_descartadas: 0, beneficiarios_con_asesoria: 0 },
    denominadores: [],
    asesorias,
    agregados: [],
  }
}

const SIN = { proyecto: null, mes: null } as const

describe('calcularMapa', () => {
  const datos = publico([
    fila({ beneficiario: 'b1', municipio_codigo: '76001' }),
    fila({ beneficiario: 'b1', municipio_codigo: '76001', mes: '2026-09' }), // 2.ª asesoría de la misma persona
    fila({ beneficiario: 'b2', municipio_codigo: '76001' }),
    fila({ beneficiario: 'b3', municipio_codigo: '76834' }),
    fila({ beneficiario: 'b4', municipio_codigo: null }),
    fila({ beneficiario: 'b5', municipio_codigo: '05001' }), // Medellín: no es del Valle
    fila({ beneficiario: 'b6', municipio_codigo: '76834', proyecto: P2, mes: '2026-08' }),
  ])

  it('devuelve los 42 municipios, con ceros, en orden de código', () => {
    const r = calcularMapa(datos, SIN)
    expect(r.municipios).toHaveLength(42)
    const codigos = r.municipios.map((m) => m.codigo)
    expect(codigos).toEqual([...MUNICIPIOS_VALLE.map((m) => m.codigo)].sort())
    expect(r.municipios.find((m) => m.codigo === '76020')).toMatchObject({ beneficiarios: 0, asesorias: 0 })
  })

  it('cuenta personas distintas y asesorías por municipio', () => {
    const r = calcularMapa(datos, SIN)
    expect(r.municipios.find((m) => m.codigo === '76001')).toMatchObject({ nombre: 'Cali', beneficiarios: 2, asesorias: 3 })
    expect(r.municipios.find((m) => m.codigo === '76834')).toMatchObject({ nombre: 'Tuluá', beneficiarios: 2, asesorias: 2 })
    expect(r.maximo).toBe(2)
    expect(r.visitados).toBe(2)
  })

  it('separa ubicados y sin ubicar (vacío o de otro departamento) y la suma cuadra', () => {
    const r = calcularMapa(datos, SIN)
    expect(r.ubicados).toBe(4)
    expect(r.sinUbicar).toBe(2)
    expect(r.total).toBe(6)
    expect(r.ubicados + r.sinUbicar).toBe(r.total)
    expect(r.fuente).toBe('empresa')
  })

  it('respeta convocatoria y mes', () => {
    const r1 = calcularMapa(datos, { proyecto: claveProyecto(P2), mes: null })
    expect(r1.total).toBe(1)
    expect(r1.visitados).toBe(1)
    const r2 = calcularMapa(datos, { proyecto: null, mes: '2026-09' })
    expect(r2.total).toBe(1)
    expect(r2.municipios.find((m) => m.codigo === '76001')?.beneficiarios).toBe(1)
  })

  it('una persona con asesorías en dos municipios cuenta en ambos, pero una sola vez en el total', () => {
    const r = calcularMapa(
      publico([fila({ beneficiario: 'x', municipio_codigo: '76001' }), fila({ beneficiario: 'x', municipio_codigo: '76834' })]),
      SIN,
    )
    expect(r.municipios.filter((m) => m.beneficiarios === 1)).toHaveLength(2)
    expect(r.ubicados).toBe(1)
    expect(r.total).toBe(1)
    expect(r.sinUbicar).toBe(0)
  })

  it('una persona con una asesoría ubicada y otra sin ubicar está ubicada', () => {
    const r = calcularMapa(
      publico([fila({ beneficiario: 'x', municipio_codigo: null }), fila({ beneficiario: 'x', municipio_codigo: '76520' })]),
      SIN,
    )
    expect(r.ubicados).toBe(1)
    expect(r.sinUbicar).toBe(0)
  })

  it('sin datos: todo en cero y sin máximo', () => {
    const r = calcularMapa(publico([]), SIN)
    expect(r).toMatchObject({ maximo: 0, visitados: 0, ubicados: 0, sinUbicar: 0, total: 0 })
    expect(r.municipios).toHaveLength(42)
  })
})

describe('detalleMunicipio', () => {
  const datos = publico([
    fila({ beneficiario: 'b1', satisfaction: 'Muy satisfecho', results_as_expected: 'Sí', need_another_credit: 'No' }),
    fila({ beneficiario: 'b2', satisfaction: 'Insatisfecho', results_as_expected: 'Parcialmente', need_another_credit: 'Sí' }),
    fila({ beneficiario: 'b3', satisfaction: 'Satisfecho', results_as_expected: null, need_another_credit: null, proyecto: P2 }),
    fila({ beneficiario: 'b4', municipio_codigo: '76834', satisfaction: 'Satisfecho' }),
  ])

  it('coincide con calcularIndicadores filtrado por ese municipio (pestaña Indicadores)', () => {
    const d = detalleMunicipio(datos, SIN, '76001')
    const r = calcularIndicadores(datos, { proyecto: null, municipio: '76001', mes: null })
    expect(d.beneficiarios).toBe(r.beneficiarios)
    expect(d.asesorias).toBe(r.asesorias)
    expect(d.satisfaccion).toEqual({ valor: r.satisfaccion.valor, n: r.satisfaccion.n, oculto: false })
    expect(d.resultados).toEqual({ valor: r.resultados.valor, n: r.resultados.n, oculto: false })
    expect(d.nuevoCredito).toEqual({ valor: r.nuevoCredito.valor, n: r.nuevoCredito.n, oculto: false })
  })

  it('muestra las cifras pequeñas con su n (decisión: mostrar todo)', () => {
    const d = detalleMunicipio(datos, SIN, '76834')
    expect(d.beneficiarios).toBe(1)
    expect(d.satisfaccion).toEqual({ valor: 100, n: 1, oculto: false })
    expect(d.resultados).toEqual({ valor: null, n: 0, oculto: false }) // nadie respondió: sin dato, no oculto
  })

  it('reparte los beneficiarios por convocatoria, de mayor a menor', () => {
    const d = detalleMunicipio(datos, SIN, '76001')
    expect(d.porConvocatoria).toEqual([
      { clave: claveProyecto(P1), etiqueta: etiquetaProyecto(P1), beneficiarios: 2 },
      { clave: claveProyecto(P2), etiqueta: etiquetaProyecto(P2), beneficiarios: 1 },
    ])
  })

  it('un municipio sin beneficiarios devuelve ceros y sin convocatorias', () => {
    const d = detalleMunicipio(datos, SIN, '76020')
    expect(d).toMatchObject({ nombre: 'Alcalá', beneficiarios: 0, asesorias: 0, porConvocatoria: [] })
    expect(d.satisfaccion).toEqual({ valor: null, n: 0, oculto: false })
  })

  describe('cobertura', () => {
    const totales = {
      '76001': { primera: 5, segunda: 4, total: 8 }, // 3 atendidos en Cali: 2 en la primera y 1 en la segunda
      '76834': { primera: 1, segunda: 0, total: 1 },
      '76020': { primera: 0, segunda: 0, total: 0 },
    }
    const P1_ = { proyecto: claveProyecto(P1), mes: null }
    const P2_ = { proyecto: claveProyecto(P2), mes: null }

    it('sin filtros: beneficiarios sobre el total de las dos convocatorias', () => {
      const d = detalleMunicipio(datos, SIN, '76001', totales)
      expect(d.cobertura).toEqual({ estado: 'ok', total: 8, porcentaje: (3 / 8) * 100, inconsistente: false })
    })
    it('con una convocatoria: atendidos y total de esa convocatoria', () => {
      expect(detalleMunicipio(datos, P1_, '76001', totales).cobertura).toEqual({ estado: 'ok', total: 5, porcentaje: (2 / 5) * 100, inconsistente: false })
      expect(detalleMunicipio(datos, P2_, '76001', totales).cobertura).toEqual({ estado: 'ok', total: 4, porcentaje: (1 / 4) * 100, inconsistente: false })
    })
    it('un total en 0 (sin beneficiarios en el listado) no sirve: sin_total', () => {
      expect(detalleMunicipio(datos, SIN, '76020', totales).cobertura.estado).toBe('sin_total')
      expect(detalleMunicipio(datos, P2_, '76834', totales).cobertura.estado).toBe('sin_total')
    })
    it('sin entrada del municipio o con totales vacíos: sin_total', () => {
      expect(detalleMunicipio(datos, SIN, '76001', {}).cobertura.estado).toBe('sin_total')
      expect(detalleMunicipio(datos, SIN, '76520', totales).cobertura.estado).toBe('sin_total')
    })
    it('una convocatoria que no es primera ni segunda: sin_total', () => {
      expect(detalleMunicipio(datos, { proyecto: 'otraconvocatoria', mes: null }, '76001', totales).cobertura.estado).toBe('sin_total')
    })
    it('con un mes filtrado no se calcula (el total es de todos los meses)', () => {
      expect(detalleMunicipio(datos, { proyecto: null, mes: '2026-10' }, '76001', totales).cobertura).toMatchObject({ estado: 'con_mes', porcentaje: null })
      expect(detalleMunicipio(datos, { proyecto: claveProyecto(P1), mes: '2026-10' }, '76001', totales).cobertura.estado).toBe('con_mes')
    })
    it('más atendidos que el total: se marca inconsistente (el total está desactualizado)', () => {
      expect(detalleMunicipio(datos, SIN, '76001', { '76001': { primera: 1, segunda: 1, total: 2 } }).cobertura).toMatchObject({ estado: 'ok', inconsistente: true })
    })
    it('convocatoriaDe reconoce la clave de proyecto', () => {
      expect(convocatoriaDe('fondervalleprimeraconvocatoria')).toBe('primera')
      expect(convocatoriaDe(claveProyecto(P2))).toBe('segunda')
      expect(convocatoriaDe('tercera')).toBeNull()
    })
  })

  it('aplica convocatoria y mes', () => {
    const d = detalleMunicipio(datos, { proyecto: claveProyecto(P2), mes: null }, '76001')
    expect(d.beneficiarios).toBe(1)
    expect(d.porConvocatoria).toHaveLength(1)
  })
})

describe('escala de color', () => {
  it('sin beneficiarios no hay clases y el 0 no tiene color', () => {
    expect(clasesDeColor([])).toEqual([])
    expect(clasesDeColor([0, 0, 0])).toEqual([])
    expect(claseDe(0, clasesDeColor([1, 2, 3]))).toBeNull()
  })

  it('con pocos valores distintos hay un tramo por valor, sin tramos vacíos', () => {
    expect(clasesDeColor([0, 1, 1, 1])).toEqual([{ desde: 1, hasta: 1, indice: 0 }])
    expect(clasesDeColor([1, 2, 3]).map((c) => [c.desde, c.hasta])).toEqual([[1, 1], [2, 2], [3, 3]])
  })

  it('un municipio enorme no deja a los demás en un solo color (cuantiles)', () => {
    const conteos = [40, 22, 17, 6, 6, 5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1]
    const clases = clasesDeColor(conteos)
    expect(clases.length).toBe(5)
    const porClase = clases.map((_, i) => conteos.filter((n) => claseDe(n, clases) === i).length)
    expect(Math.max(...porClase)).toBeLessThanOrEqual(8) // con tramos iguales (1 a 8) habría 16 en el primero
    expect(porClase.every((n) => n > 0)).toBe(true)
  })

  const casos: [string, number[]][] = [
    ['uno solo', [7]],
    ['repetidos', [2, 2, 2, 2]],
    ['pocos', [1, 3]],
    ['muchos y sesgados', [173, 1, 1, 1, 2, 2, 3, 5, 8, 13, 21, 34, 55, 89]],
    ['parejos', [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]],
  ]
  it.each(casos)('%s: los tramos cubren de 1 al máximo sin huecos ni solapes', (_, conteos) => {
    const maximo = Math.max(...conteos)
    const clases = clasesDeColor(conteos)
    expect(clases.length).toBeGreaterThan(0)
    expect(clases.length).toBeLessThanOrEqual(5)
    expect(clases[0]?.desde).toBe(1)
    expect(clases[clases.length - 1]?.hasta).toBe(maximo)
    clases.forEach((c, i) => {
      expect(c.indice).toBe(i)
      expect(c.hasta).toBeGreaterThanOrEqual(c.desde)
      if (i > 0) expect(c.desde).toBe((clases[i - 1]?.hasta ?? 0) + 1)
    })
    for (let n = 1; n <= maximo; n++) expect(claseDe(n, clases)).not.toBeNull()
  })
})

describe('ordenarMunicipios', () => {
  const lista = [
    { codigo: '1', nombre: 'Zarzal', beneficiarios: 2, asesorias: 5 },
    { codigo: '2', nombre: 'Alcalá', beneficiarios: 2, asesorias: 1 },
    { codigo: '3', nombre: 'Buga', beneficiarios: 9, asesorias: 3 },
  ]
  it('por beneficiarios descendente, empate por nombre', () => {
    expect(ordenarMunicipios(lista, 'beneficiarios', false).map((m) => m.nombre)).toEqual(['Buga', 'Alcalá', 'Zarzal'])
  })
  it('por nombre, con acentos en su sitio', () => {
    expect(ordenarMunicipios(lista, 'nombre', true).map((m) => m.nombre)).toEqual(['Alcalá', 'Buga', 'Zarzal'])
  })
  it('no modifica la lista original', () => {
    const copia = [...lista]
    ordenarMunicipios(lista, 'asesorias', true)
    expect(lista).toEqual(copia)
  })
})

describe('totales por municipio (datos cargados del Excel)', () => {
  const t = BENEFICIARIOS_POR_MUNICIPIO
  it('traen los 42 municipios del Valle por código DIVIPOLA', () => {
    expect(Object.keys(t).sort()).toEqual(MUNICIPIOS_VALLE.map((m) => m.codigo).sort())
  })
  it('son enteros no negativos y total está entre el mayor de las convocatorias y su suma', () => {
    for (const [codigo, v] of Object.entries(t)) {
      for (const n of [v.primera, v.segunda, v.total]) expect(Number.isInteger(n) && n >= 0, codigo).toBe(true)
      expect(v.total, codigo).toBeGreaterThanOrEqual(Math.max(v.primera, v.segunda))
      expect(v.total, codigo).toBeLessThanOrEqual(v.primera + v.segunda)
    }
  })
  it('suman 1.025 en la primera, 718 en la segunda y 1.741 personas distintas', () => {
    const suma = (k: 'primera' | 'segunda' | 'total') => Object.values(t).reduce((s, v) => s + v[k], 0)
    expect([suma('primera'), suma('segunda'), suma('total')]).toEqual([1025, 718, 1741])
  })
})

describe('geometría y vista 3D', () => {
  it('trae los 42 municipios del Valle, por código DIVIPOLA', () => {
    expect(GEOMETRIA_VALLE.map((g) => g.codigo).sort()).toEqual(MUNICIPIOS_VALLE.map((m) => m.codigo).sort())
  })
  it('cada trazado es válido y cada centroide cae dentro del viewBox', () => {
    for (const g of GEOMETRIA_VALLE) {
      expect(g.d.startsWith('M')).toBe(true)
      expect(g.d.endsWith('z')).toBe(true)
      expect(g.cx).toBeGreaterThanOrEqual(0)
      expect(g.cx).toBeLessThanOrEqual(VIEWBOX_VALLE.ancho)
      expect(g.cy).toBeGreaterThanOrEqual(0)
      expect(g.cy).toBeLessThanOrEqual(VIEWBOX_VALLE.alto)
    }
  })
  it('pesa poco (< 300 KB)', () => {
    const bytes = GEOMETRIA_VALLE.reduce((s, g) => s + g.d.length, 0)
    expect(bytes).toBeLessThan(300_000)
  })
  it('lee los vértices de un trazado (M absoluto, l relativo, z)', () => {
    expect(puntosDeTrazado('M10 20l5 -2.5l-1 4zM0 0l1 1z')).toEqual([[10, 20], [15, 17.5], [14, 21.5], [0, 0], [1, 1]])
  })
  it('la caja 3D contiene todos los vértices girados y aplastados, con su pared', () => {
    const puntos = GEOMETRIA_VALLE.flatMap((g) => puntosDeTrazado(g.d))
    expect(puntos.length).toBeGreaterThan(1000)
    const caja = cajaDeVista(puntos, '3d')
    const [a, b, c, d] = matriz3D()
    for (const [x, y] of puntos) {
      const px = a * x + c * y
      const py = b * x + d * y
      expect(px).toBeGreaterThan(caja.x)
      expect(px).toBeLessThan(caja.x + caja.ancho)
      expect(py - 7).toBeGreaterThan(caja.y) // el municipio elegido sube 7
      expect(py + 16).toBeLessThan(caja.y + caja.alto) // la pared baja 16
    }
  })
  it('la caja plana se ajusta al mapa (≈ el viewBox) con un margen', () => {
    const puntos = GEOMETRIA_VALLE.flatMap((g) => puntosDeTrazado(g.d))
    const caja = cajaDeVista(puntos, 'plana')
    expect(caja.ancho).toBeGreaterThan(VIEWBOX_VALLE.ancho)
    expect(caja.ancho).toBeLessThan(VIEWBOX_VALLE.ancho + 100)
    expect(caja.alto).toBeGreaterThan(VIEWBOX_VALLE.alto)
    expect(caja.alto).toBeLessThan(VIEWBOX_VALLE.alto + 100)
  })
  it('la caja plana deja sitio a la sombra (a la derecha y abajo)', () => {
    const puntos = GEOMETRIA_VALLE.flatMap((g) => puntosDeTrazado(g.d))
    const caja = cajaDeVista(puntos, 'plana')
    const { dx, dy, difuminado } = SOMBRA_PLANA
    const maxX = Math.max(...puntos.map(([x]) => x))
    const maxY = Math.max(...puntos.map(([, y]) => y))
    expect(maxX + dx + difuminado * 2).toBeLessThan(caja.x + caja.ancho)
    expect(maxY + dy + difuminado * 2).toBeLessThan(caja.y + caja.alto)
  })
})
