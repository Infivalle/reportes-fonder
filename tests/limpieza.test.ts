import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COLUMNAS_V1 } from '../src/formato/v1.ts'
import { esMontoAtipico } from '../src/limpieza/atipicos.ts'
import { normalizarCategoria, separarCodigos } from '../src/limpieza/categorias.ts'
import { decidirDuplicados } from '../src/limpieza/duplicados.ts'
import { aHoraColombia, mesColombia, parseFechaUtc } from '../src/limpieza/fechas.ts'
import { limpiarTsv, construirPayloadDb } from '../src/limpieza/index.ts'
import { MUNICIPIOS_VALLE, resolverMunicipio } from '../src/limpieza/municipios.ts'
import { desescaparMysql } from '../src/limpieza/texto.ts'

function fixture(nombre: string): string {
  return readFileSync(new URL(`./fixtures/${nombre}`, import.meta.url), 'utf-8')
}

/** Cambia una celda del TSV. `linea` cuenta el encabezado como 1. */
function modificarCelda(contenido: string, linea: number, columna: string, valor: string): string {
  const lineas = contenido.split('\n')
  const fila = (lineas[linea - 1] ?? '').split('\t')
  fila[COLUMNAS_V1.indexOf(columna as (typeof COLUMNAS_V1)[number])] = valor
  lineas[linea - 1] = fila.join('\t')
  return lineas.join('\n')
}

const VALIDO = fixture('asesorias_v1_sintetico.tsv')

describe('limpiarTsv · fixture sintético', () => {
  const r = limpiarTsv(VALIDO)
  if (!r.ok) throw new Error(r.errores.join('\n'))
  const { resumen, asesorias, beneficiarios, proyectos } = r.resultado

  it('cuenta filas, conservadas y descartadas', () => {
    expect(resumen.filasLeidas).toBe(11)
    expect(resumen.asesoriasConservadas).toBe(8)
    expect(resumen.asesoriasDescartadas).toBe(3)
    expect(resumen.beneficiariosDistintos).toBe(8)
    expect(resumen.beneficiariosConAsesoria).toBe(8)
  })

  it('descarta duplicados exactos y el registro a 11 días, con motivo', () => {
    const descartadas = asesorias.filter((a) => !a.conservada)
    expect(descartadas.map((a) => a.id)).toEqual([4, 5, 7])
    expect(descartadas.every((a) => a.motivoDescarte?.startsWith('duplicado'))).toBe(true)
    expect(descartadas.find((a) => a.id === 7)?.motivoDescarte).toContain('asesoría 6')
  })

  it('conserva el primer registro (menor id) entre duplicados exactos', () => {
    expect(asesorias.find((a) => a.id === 3)?.conservada).toBe(true)
  })

  it('lleva las ciudades a códigos DIVIPOLA y lista las que no reconoce', () => {
    const codigo = (id: number) => beneficiarios.find((b) => b.id === id)?.municipioCodigo
    expect(codigo(9001)).toBe('76001') // Cali
    expect(codigo(9002)).toBe('76001') // SANTIAGO DE CALI
    expect(codigo(9003)).toBe('76111') // "Buga " con espacio
    expect(codigo(9004)).toBe('76111') // Guadalajara de Buga
    expect(codigo(9005)).toBe('76834') // Tulua sin tilde
    expect(codigo(9006)).toBeNull() // Medellín
    expect(codigo(9007)).toBe('76520') // palmira en minúscula
    expect(codigo(9008)).toBeNull()
    expect(resumen.municipiosSinReconocer.map((m) => m.texto).sort()).toEqual([
      'Lugar Inexistente',
      'Medellín',
    ])
  })

  it('marca el monto atípico sin corregirlo', () => {
    expect(resumen.montosAtipicos).toBe(1)
    const a = asesorias.find((x) => x.id === 10)
    expect(a?.atipica).toBe(true)
    expect(a?.totalSalesValue).toBe(900000000)
  })

  it('separa los códigos múltiples en listas', () => {
    expect(asesorias.find((a) => a.id === 2)?.mejoras).toEqual(['AI', 'AA'])
    expect(asesorias.find((a) => a.id === 2)?.canales).toEqual(['TF', 'RS'])
    expect(asesorias.find((a) => a.id === 11)?.mejoras).toEqual([])
  })

  it('trata NULL como nulo y convierte los tipos', () => {
    const a = asesorias.find((x) => x.id === 8)
    expect(a?.monthlyIncome).toBeNull()
    expect(asesorias.find((x) => x.id === 1)?.monthlyIncome).toBe(2500000)
    expect(asesorias.find((x) => x.id === 1)?.creadaEn).toBe('2026-10-16T18:30:12.000Z')
  })

  it('no reporta valores fuera de catálogo en datos de ejemplo válidos', () => {
    expect(resumen.valoresFueraDeCatalogo).toEqual([])
  })

  it('reúne los proyectos', () => {
    expect(proyectos).toEqual([
      'Fonder Valle Primera Convocatoria',
      'Fonder Valle Segunda Convocatoria',
    ])
  })

  it('arma la carga útil para la base con las mismas cifras', () => {
    const p = construirPayloadDb(r.resultado, 'asesorias.tsv')
    expect(p.carga).toMatchObject({ filas_leidas: 11, asesorias_conservadas: 8, asesorias_descartadas: 3 })
    expect(p.asesorias).toHaveLength(11)
    expect(p.beneficiarios).toHaveLength(8)
    expect(p.beneficiarios_proyecto).toHaveLength(8)
    expect(p.asesoria_mejoras.filter((m) => m.asesoria_id === 2)).toHaveLength(2)
    // nada que no exista como columna: idasesor queda fuera del modelo
    expect(Object.keys(p.asesorias[0] ?? {})).not.toContain('idasesor')
  })
})

describe('limpiarTsv · rechazos', () => {
  it('rechaza una línea con menos columnas e indica cuál', () => {
    const r = limpiarTsv(fixture('asesorias_v1_linea_rota.tsv'))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errores[0]).toContain('Línea 6')
      expect(r.errores[0]).toContain('51 columnas')
    }
  })

  it('rechaza un encabezado desconocido e indica la columna que falta', () => {
    const r = limpiarTsv(fixture('asesorias_encabezado_desconocido.tsv'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores.join(' ')).toContain('faltan columnas: nit')
  })

  it('rechaza columnas sobrantes', () => {
    const [cab = '', ...resto] = VALIDO.split('\n')
    const r = limpiarTsv([cab + '\tcolumna_extra', ...resto].join('\n'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores.join(' ')).toContain('sobran columnas: columna_extra')
  })

  it('rechaza el mismo encabezado en otro orden', () => {
    const lineas = VALIDO.split('\n')
    const cab = (lineas[0] ?? '').split('\t')
    ;[cab[0], cab[1]] = [cab[1] ?? '', cab[0] ?? '']
    lineas[0] = cab.join('\t')
    const r = limpiarTsv(lineas.join('\n'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0]).toContain('orden')
  })

  it('rechaza un archivo vacío', () => {
    expect(limpiarTsv('').ok).toBe(false)
  })

  it('rechaza una fecha imposible', () => {
    const r = limpiarTsv(modificarCelda(VALIDO, 2, 'created_at', '2026-02-31 10:00:00'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0]).toContain('Línea 2')
  })

  it('rechaza un número que no lo es', () => {
    const r = limpiarTsv(modificarCelda(VALIDO, 3, 'monthlyIncome', '2.500.000'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0]).toContain('monthlyIncome')
  })

  it('rechaza un id que no es entero', () => {
    const r = limpiarTsv(modificarCelda(VALIDO, 2, 'idbeneficiario', 'abc'))
    expect(r.ok).toBe(false)
  })

  it('rechaza una asesoría sin beneficiario', () => {
    const r = limpiarTsv(modificarCelda(VALIDO, 2, 'documento', 'NULL'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0]).toContain('documento vacío')
  })

  it('rechaza ids de asesoría repetidos', () => {
    const r = limpiarTsv(modificarCelda(VALIDO, 3, 'id', '1'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0]).toContain('repetido')
  })

  it('acepta finales de línea de Windows', () => {
    expect(limpiarTsv(VALIDO.replace(/\n/g, '\r\n')).ok).toBe(true)
  })
})

describe('decidirDuplicados', () => {
  const dia = 24 * 60 * 60 * 1000
  const t0 = Date.parse('2026-10-01T12:00:00Z')
  const e = (id: number, dias: number, benef = 1) => ({
    id,
    beneficiarioId: benef,
    creadaEn: new Date(t0 + dias * dia).toISOString(),
  })

  it('exactamente 30 días se conserva; un segundo menos se descarta', () => {
    const justo = decidirDuplicados([e(1, 0), e(2, 30)])
    expect(justo.get(2)?.conservada).toBe(true)
    const casi = decidirDuplicados([
      e(1, 0),
      { id: 2, beneficiarioId: 1, creadaEn: new Date(t0 + 30 * dia - 1000).toISOString() },
    ])
    expect(casi.get(2)?.conservada).toBe(false)
  })

  it('compara contra el último CONSERVADO, no contra el último descartado', () => {
    const d = decidirDuplicados([e(1, 0), e(2, 20), e(3, 35), e(4, 50)])
    expect(d.get(1)?.conservada).toBe(true)
    expect(d.get(2)?.conservada).toBe(false)
    expect(d.get(3)?.conservada).toBe(true) // 35 días desde la 1
    expect(d.get(4)?.conservada).toBe(false) // 15 días desde la 3
  })

  it('no mezcla beneficiarios distintos', () => {
    const d = decidirDuplicados([e(1, 0, 1), e(2, 1, 2)])
    expect(d.get(2)?.conservada).toBe(true)
  })

  it('con la misma fecha conserva el menor id sin importar el orden de entrada', () => {
    const d = decidirDuplicados([e(9, 0), e(3, 0), e(5, 0)])
    expect(d.get(3)?.conservada).toBe(true)
    expect(d.get(5)?.conservada).toBe(false)
    expect(d.get(9)?.conservada).toBe(false)
  })
})

describe('fechas', () => {
  it('parsea fechas válidas como UTC', () => {
    expect(parseFechaUtc('2026-10-16 18:30:12')).toBe('2026-10-16T18:30:12.000Z')
  })

  it('rechaza fechas imposibles o mal formadas', () => {
    expect(parseFechaUtc('2026-02-31 10:00:00')).toBeNull()
    expect(parseFechaUtc('2026-10-16 25:00:00')).toBeNull()
    expect(parseFechaUtc('2026-10-16')).toBeNull()
    expect(parseFechaUtc('16/10/2026 10:00:00')).toBeNull()
  })

  it('convierte a hora de Colombia (UTC−5), incluso al cambiar de mes', () => {
    expect(aHoraColombia('2026-10-16T18:30:12.000Z')).toBe('2026-10-16 13:30:12')
    expect(mesColombia('2026-11-01T02:00:00.000Z')).toBe('2026-10')
    expect(mesColombia('2026-11-01T05:00:00.000Z')).toBe('2026-11')
  })
})

describe('municipios', () => {
  it('son 42, con códigos únicos del departamento 76', () => {
    expect(MUNICIPIOS_VALLE).toHaveLength(42)
    expect(new Set(MUNICIPIOS_VALLE.map((m) => m.codigo)).size).toBe(42)
    expect(MUNICIPIOS_VALLE.every((m) => /^76\d{3}$/.test(m.codigo))).toBe(true)
  })

  it('reconoce todos los nombres oficiales', () => {
    for (const m of MUNICIPIOS_VALLE) {
      expect(resolverMunicipio(m.nombre, 'Valle del Cauca').codigo).toBe(m.codigo)
    }
  })

  it('ignora tildes, mayúsculas, espacios y sufijo de departamento', () => {
    expect(resolverMunicipio('  tuluá ', null).codigo).toBe('76834')
    expect(resolverMunicipio('Cali, Valle del Cauca', null).codigo).toBe('76001')
    expect(resolverMunicipio('JAMUNDI', 'VALLE').codigo).toBe('76364')
    expect(resolverMunicipio('El Aguila', null).codigo).toBe('76243')
  })

  it('no confunde homónimos de otros departamentos', () => {
    expect(resolverMunicipio('La Unión', 'Nariño')).toEqual({ codigo: null, motivo: 'otro_departamento' })
    expect(resolverMunicipio('La Unión', 'Valle del Cauca').codigo).toBe('76400')
    expect(resolverMunicipio('Florida', 'Antioquia').motivo).toBe('otro_departamento')
  })

  it('reconoce municipios con la letra acentuada dañada en el origen ("�")', () => {
    expect(resolverMunicipio('LA UNI�N', 'Valle del Cauca').codigo).toBe('76400')
    expect(resolverMunicipio('La Uni�n', null).codigo).toBe('76400')
    expect(resolverMunicipio('Bol�var', null).codigo).toBe('76100')
    expect(resolverMunicipio('BOL�VAR', 'Valle').codigo).toBe('76100')
    expect(resolverMunicipio('EL �GUILA', null).codigo).toBe('76243')
    // el departamento sigue mandando
    expect(resolverMunicipio('LA UNI�N', 'Nariño').motivo).toBe('otro_departamento')
  })

  it('distingue vacío de no reconocido', () => {
    expect(resolverMunicipio(null, null).motivo).toBe('vacio')
    expect(resolverMunicipio('   ', null).motivo).toBe('vacio')
    expect(resolverMunicipio('Atlantis', null).motivo).toBe('no_reconocido')
  })
})

describe('categorías y códigos', () => {
  const opciones = ['Sí', 'No', 'Parcialmente']

  it('lleva variantes a la opción canónica', () => {
    expect(normalizarCategoria('si', opciones)).toEqual({ valor: 'Sí', fueraDeCatalogo: false })
    expect(normalizarCategoria(' PARCIALMENTE ', opciones).valor).toBe('Parcialmente')
  })

  it('conserva y marca un valor desconocido', () => {
    expect(normalizarCategoria('Tal vez', opciones)).toEqual({ valor: 'Tal vez', fueraDeCatalogo: true })
  })

  it('nulo y vacío siguen siendo nulo', () => {
    expect(normalizarCategoria(null, opciones).valor).toBeNull()
    expect(normalizarCategoria('  ', opciones).valor).toBeNull()
  })

  it('separa códigos sin vacíos ni repetidos', () => {
    expect(separarCodigos('CT,AA')).toEqual(['CT', 'AA'])
    expect(separarCodigos(' ct , aa ,CT,')).toEqual(['CT', 'AA'])
    expect(separarCodigos(null)).toEqual([])
  })
})

describe('desescaparMysql', () => {
  it('restaura saltos, tabulaciones y barras', () => {
    expect(desescaparMysql('línea 1\\nlínea 2')).toBe('línea 1\nlínea 2')
    expect(desescaparMysql('a\\tb')).toBe('a\tb')
    expect(desescaparMysql('ruta\\\\n')).toBe('ruta\\n') // barra escapada seguida de "n", no un salto
  })

  it('no toca el texto sin barras', () => {
    expect(desescaparMysql('hola')).toBe('hola')
  })
})

describe('esMontoAtipico', () => {
  it('marca solo cuando las ventas superan 100 veces el ingreso', () => {
    expect(esMontoAtipico(1000, 100001)).toBe(true)
    expect(esMontoAtipico(1000, 100000)).toBe(false)
    expect(esMontoAtipico(null, 5)).toBe(false)
    expect(esMontoAtipico(0, 5)).toBe(false)
    expect(esMontoAtipico(1000, null)).toBe(false)
  })
})
