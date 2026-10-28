import { describe, expect, it } from 'vitest'
import { COLUMNAS_V1 } from '../../src/formato/v1.ts'
import { COLUMNAS_NUEVAS_V2, COLUMNAS_V2, NUM_COLUMNAS_V2 } from '../../src/formato/v2.ts'
import {
  construirPayloadDb,
  limpiarTsv,
  validarTsv,
  validarTsvV1,
  type ResultadoCarga,
} from '../../src/limpieza/index.ts'
import { resolverMunicipio } from '../../src/limpieza/municipios.ts'
import { tsvV1, tsvV2 } from '../fixtures/construirTsvSintetico.ts'

/** Falla la prueba con los errores a la vista si la limpieza rechazó el archivo. */
function limpio(r: ResultadoCarga) {
  if (!r.ok) throw new Error(`Se esperaba un archivo válido: ${r.errores.join(' | ')}`)
  return r.resultado
}

describe('formato v2: definición', () => {
  it('son las 52 columnas de v1 en el mismo orden y 9 más al final', () => {
    expect(NUM_COLUMNAS_V2).toBe(61)
    expect(COLUMNAS_V2.slice(0, COLUMNAS_V1.length)).toEqual([...COLUMNAS_V1])
    expect(COLUMNAS_V2.slice(COLUMNAS_V1.length)).toEqual([...COLUMNAS_NUEVAS_V2])
  })
})

describe('formato v2: reconocimiento y validación', () => {
  it('reconoce v1 y v2 por el encabezado', () => {
    expect(limpio(limpiarTsv(tsvV1([{}]))).resumen.formato).toBe('v1')
    expect(limpio(limpiarTsv(tsvV2([{}]))).resumen.formato).toBe('v2')
  })

  it('v1 no trae ninguna clave de v2 (ni como null) en beneficiarios, payload ni resumen', () => {
    const r = limpio(limpiarTsv(tsvV1([{}])))
    expect(r.beneficiarios[0]).not.toHaveProperty('municipioEmpresa')
    expect(r.beneficiarios[0]).not.toHaveProperty('patrimonio')
    expect(r.resumen.municipiosPorOrigen).toBeUndefined()
    const payload = construirPayloadDb(r, 'v1.tsv')
    expect(payload.carga.formato).toBe('v1')
    for (const columna of ['municipio_empresa', 'patrimonio', 'cuotas', 'tipo_empresa']) {
      expect(payload.beneficiarios[0]).not.toHaveProperty(columna)
    }
  })

  it('un encabezado v2 al que le falta una columna nueva se rechaza diciendo cuál', () => {
    const sinUltima = tsvV2([{}])
      .split('\n')
      .map((l) => l.split('\t').slice(0, -1).join('\t'))
      .join('\n')
    const r = validarTsv(sinUltima)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores).toEqual(['Encabezado: faltan columnas: cuotas'])
  })

  it('un encabezado v2 con las columnas nuevas en otro orden se rechaza', () => {
    const [encabezado, ...resto] = tsvV2([{}]).split('\n')
    const cols = encabezado!.split('\t')
    const i = cols.indexOf('patrimonio')
    ;[cols[i], cols[i + 1]] = [cols[i + 1]!, cols[i]!]
    const r = validarTsv([cols.join('\t'), ...resto].join('\n'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0]).toMatch(/formato v2.*columna 58.*"patrimonio"/)
  })

  it('una fila con 52 columnas dentro de un archivo v2 se rechaza', () => {
    const [encabezado, fila] = tsvV2([{}]).split('\n')
    const corta = fila!.split('\t').slice(0, 52).join('\t')
    const r = validarTsv([encabezado, corta].join('\n') + '\n')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores).toEqual(['Línea 2: tiene 52 columnas, se esperaban 61'])
  })

  it('validarTsvV1 sigue exigiendo v1: un archivo v2 se rechaza', () => {
    const r = validarTsvV1(tsvV2([{}]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0]).toContain('sobran columnas: municipioempresa')
  })

  it('las columnas que ya existían se siguen validando con rigor en v2', () => {
    const r = limpiarTsv(tsvV2([{ monthlyIncome: 'mucho' }]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0]).toContain('monthlyIncome debe ser un número')
  })

  it('duplicados y categorías se comportan igual en v2', () => {
    const r = limpio(
      limpiarTsv(
        tsvV2([
          { idbeneficiario: '500', documento: '2000000001', satisfaction: 'satisfecho ' },
          { idbeneficiario: '500', documento: '2000000001', created_at: '2026-10-20 15:00:07' },
        ]),
      ),
    )
    expect(r.resumen.asesoriasConservadas).toBe(1)
    expect(r.resumen.asesoriasDescartadas).toBe(1)
    expect(r.asesorias[0]!.satisfaction).toBe('Satisfecho')
  })
})

describe('formato v2: columnas nuevas', () => {
  it('se leen con su tipo y llegan al payload con nombres de columna de la base', () => {
    const r = limpio(
      limpiarTsv(
        tsvV2([
          {
            municipioempresa: 'Toro',
            tipoempresa: 'Persona natural',
            aniofundacion: '2018',
            empleosgenerado: '2',
            empleosagenerar: '3.0',
            patrimonio: '15000000',
            pasivos: '2000000.50',
            dinerosolicitado: '5000000',
            cuotas: '12',
          },
        ]),
      ),
    )
    expect(r.resumen.advertencias).toEqual([])
    const payload = construirPayloadDb(r, 'v2.tsv')
    expect(payload.carga.formato).toBe('v2')
    expect(payload.beneficiarios[0]).toMatchObject({
      municipio_empresa: 'Toro',
      tipo_empresa: 'Persona natural',
      anio_fundacion: 2018,
      empleos_generados: 2,
      empleos_a_generar: 3,
      patrimonio: 15000000,
      pasivos: 2000000.5,
      dinero_solicitado: 5000000,
      cuotas: 12,
    })
  })

  it('vacío y NULL quedan en null sin advertencia', () => {
    const r = limpio(
      limpiarTsv(tsvV2([{ tipoempresa: 'NULL', aniofundacion: '', patrimonio: 'NULL', cuotas: '   ' }])),
    )
    expect(r.resumen.advertencias).toEqual([])
    expect(r.beneficiarios[0]).toMatchObject({
      tipoEmpresa: null,
      anioFundacion: null,
      patrimonio: null,
      cuotas: null,
    })
  })

  it('un valor ilegible se deja vacío y se avisa, pero no rechaza el archivo', () => {
    const r = limpio(
      limpiarTsv(
        tsvV2([
          {
            patrimonio: 'abc',
            cuotas: '12 cuotas',
            aniofundacion: '0',
            empleosgenerado: '-1',
            empleosagenerar: '2.5',
          },
        ]),
      ),
    )
    expect(r.beneficiarios[0]).toMatchObject({
      patrimonio: null,
      cuotas: null,
      anioFundacion: null,
      empleosGenerados: null,
      empleosAGenerar: null,
    })
    const avisos = r.resumen.advertencias.join('\n')
    for (const col of ['patrimonio', 'cuotas', 'aniofundacion', 'empleosgenerado', 'empleosagenerar']) {
      expect(avisos).toContain(col)
    }
    expect(avisos).toContain('Línea 2')
  })

  it('con muchas advertencias se listan las primeras y se resume el resto', () => {
    const filas = Array.from({ length: 13 }, () => ({ patrimonio: 'x' }))
    const { resumen } = limpio(limpiarTsv(tsvV2(filas)))
    expect(resumen.advertencias).toHaveLength(11)
    expect(resumen.advertencias.at(-1)).toBe('… y 3 advertencias más sobre las columnas de v2')
  })
})

describe('formato v2: municipio', () => {
  it('usa el municipio de la empresa aunque la residencia sea otra', () => {
    const r = limpio(limpiarTsv(tsvV2([{ municipioempresa: 'Toro', ciudad: 'Cali' }])))
    expect(r.beneficiarios[0]).toMatchObject({ municipioCodigo: '76823', municipioOrigen: 'empresa' })
    expect(r.resumen.municipiosPorOrigen).toEqual({ empresa: 1, residencia: 0, sin_ubicar: 0 })
    expect(r.resumen.municipiosSinReconocer).toEqual([])
  })

  it('si la empresa está vacía usa la residencia', () => {
    const r = limpio(limpiarTsv(tsvV2([{ municipioempresa: 'NULL', ciudad: 'Cartago' }])))
    expect(r.beneficiarios[0]).toMatchObject({ municipioCodigo: '76147', municipioOrigen: 'residencia' })
    expect(r.resumen.municipiosSinReconocer).toEqual([])
  })

  it('si la empresa no es del Valle cae a la residencia y el texto se reporta para poder agregar un alias', () => {
    const r = limpio(limpiarTsv(tsvV2([{ municipioempresa: 'Popayán', ciudad: 'Cali' }])))
    expect(r.beneficiarios[0]).toMatchObject({ municipioCodigo: '76001', municipioOrigen: 'residencia' })
    expect(r.resumen.municipiosSinReconocer).toEqual([
      { texto: 'Popayán', motivo: 'no_reconocido', beneficiarios: 1, campo: 'municipioempresa' },
    ])
  })

  it('si ninguno sirve queda sin ubicar y se reportan los dos textos', () => {
    const r = limpio(
      limpiarTsv(tsvV2([{ municipioempresa: 'Popayán', ciudad: 'Pueblo Inventado', departamento: 'Valle' }])),
    )
    expect(r.beneficiarios[0]).toMatchObject({ municipioCodigo: null, municipioOrigen: 'sin_ubicar' })
    expect(r.resumen.municipiosPorOrigen).toEqual({ empresa: 0, residencia: 0, sin_ubicar: 1 })
    // Con igual número de beneficiarios el resumen ordena por texto.
    expect(r.resumen.municipiosSinReconocer.map((m) => [m.campo, m.texto])).toEqual([
      ['municipioempresa', 'Popayán'],
      ['ciudad', 'Pueblo Inventado'],
    ])
  })

  it('el mismo texto en columnas distintas se cuenta por separado', () => {
    const r = limpio(
      limpiarTsv(
        tsvV2([
          { municipioempresa: 'Nowhere', ciudad: 'Cali' },
          { municipioempresa: 'NULL', ciudad: 'Nowhere' },
        ]),
      ),
    )
    expect(r.resumen.municipiosSinReconocer).toHaveLength(2)
  })

  it('reconoce los 19 valores reales de municipioempresa, incluidos los de letra dañada', () => {
    // Valores y frecuencias tal como los devolvió la base de producción (el "�" es el
    // carácter dañado en origen). Ningún dato personal.
    const esperado: [string, string][] = [
      ['CALI', '76001'],
      ['TORO', '76823'],
      ['CARTAGO', '76147'],
      ['ROLDANILLO', '76622'],
      ['LA UNI�N', '76400'],
      ['LA VICTORIA', '76403'],
      ['BUENAVENTURA', '76109'],
      ['BUGALAGRANDE', '76113'],
      ['Zarzal', '76895'],
      ['El Cairo', '76246'],
      ['Ulloa', '76845'],
      ['ANSERMANUEVO', '76041'],
      ['EL DOVIO', '76250'],
      ['BOL�VAR', '76100'],
      ['Versalles', '76863'],
      ['EL �GUILA', '76243'],
      ['TULU�', '76834'],
      ['Argelia', '76054'],
      ['PALMIRA', '76520'],
    ]
    const r = limpio(limpiarTsv(tsvV2(esperado.map(([municipioempresa]) => ({ municipioempresa })))))
    expect(r.resumen.municipiosSinReconocer).toEqual([])
    expect(r.beneficiarios.map((b) => b.municipioCodigo)).toEqual(esperado.map(([, codigo]) => codigo))
    expect(r.beneficiarios.every((b) => b.municipioOrigen === 'empresa')).toBe(true)
  })

  it('los municipios con tilde con la letra dañada también tienen alias', () => {
    const casos: [string, string][] = [
      ['ALCAL�', '76020'],
      ['ANDALUC�A', '76036'],
      ['GUACAR�', '76318'],
      ['JAMUND�', '76364'],
      ['RIOFR�O', '76616'],
      ['TULU�', '76834'],
    ]
    for (const [texto, codigo] of casos) {
      expect(resolverMunicipio(texto, null), texto).toEqual({ codigo, motivo: 'ok' })
    }
  })
})
