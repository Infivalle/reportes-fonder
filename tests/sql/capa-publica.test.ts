import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { construirPayloadDb, limpiarTsv } from '../../src/limpieza/index.ts'
import { ensamblarPublico } from '../../src/publico/ensamblar.ts'
import { generarPublico } from '../../src/publico/generar.ts'
import { RANGOS_CONTEO, RANGOS_MONTO } from '../../src/publico/rangos.ts'
import type {
  FilaAgregadoVista,
  FilaDenominadorVista,
  FilaMetaVista,
  FilaVista,
} from '../../src/publico/tipos.ts'
import { CLAVES_PROHIBIDAS, verificarPublico } from '../../src/publico/verificar.ts'
import { comoRol, crearBaseSupabase, crearRolPublico, tsvSintetico, type FilaSintetica } from './ayuda.ts'

const A = 'Fonder Valle Primera Convocatoria'
const B = 'Fonder Valle Segunda Convocatoria'

/**
 * Datos con volumen suficiente para que existan grupos de 5 o más:
 *  - Proyecto A: 12 beneficiarios en Cali (el 12 con un monto atípico)
 *  - Proyecto B: 6 en Buga y 3 en Tuluá (grupo pequeño: no debe tener agregado municipal)
 *  - Un beneficiario repite asesoría a los 5 días (se descarta y no debe salir)
 *  - Una asesoría creada el 1 de nov. a las 03:00 UTC (= 31 de oct. en Colombia)
 */
function datos(): FilaSintetica[] {
  const filas: FilaSintetica[] = []
  for (let i = 1; i <= 12; i++) {
    filas.push({
      id: i, beneficiario: 100 + i, ciudad: 'Cali', proyecto: A,
      columnas: i === 12
        ? { monthlyIncome: 1000000, totalSalesValue: 900000000 } // atípico
        : { monthlyIncome: 1000000 + i * 100000, totalSalesValue: 2000000 },
    })
  }
  for (let i = 1; i <= 6; i++) filas.push({ id: 20 + i, beneficiario: 200 + i, ciudad: 'Buga', proyecto: B })
  for (let i = 1; i <= 3; i++) filas.push({ id: 30 + i, beneficiario: 300 + i, ciudad: 'Tulua', proyecto: B })
  filas.push({ id: 40, beneficiario: 101, ciudad: 'Cali', proyecto: A, creadaEn: '2026-10-25 12:00:00' }) // duplicado
  filas.push({
    id: 41, beneficiario: 401, ciudad: 'Cali', proyecto: A, creadaEn: '2026-11-01 03:00:00',
    columnas: { monthlyClients: 5, monthlySales: 60 },
  })
  return filas
}

let db: PGlite
let ensamblar: (semilla: number) => ReturnType<typeof ensamblarPublico>

/** Generador pseudoaleatorio determinista (mulberry32) para pruebas. */
function conSemilla(semilla: number) {
  let a = semilla
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

beforeAll(async () => {
  db = await crearBaseSupabase()
  await crearRolPublico(db)

  const r = limpiarTsv(tsvSintetico(datos()))
  if (!r.ok) throw new Error(r.errores.join('\n'))
  expect(r.resultado.resumen.asesoriasDescartadas).toBe(1)
  await db.query('select public.reemplazar_datos($1::jsonb, null)', [
    JSON.stringify(construirPayloadDb(r.resultado, 'sintetico.tsv')),
  ])
  await db.exec(
    `insert into public.denominadores (proyecto_id, total_beneficiarios)
       select id, 1300 from public.proyectos where nombre = '${A}'`,
  )

  const leer = async <T>(vista: string) => (await db.query<T>(`select * from public.${vista}`)).rows
  const filas = await leer<FilaVista>('vista_publica_asesorias')
  const agregados = await leer<FilaAgregadoVista>('vista_publica_agregados')
  const denominadores = await leer<FilaDenominadorVista>('vista_publica_denominadores')
  const [meta] = await leer<FilaMetaVista>('vista_publica_meta')

  ensamblar = (semilla) =>
    ensamblarPublico(filas, agregados, denominadores, meta, {
      generadoEn: '2026-10-28T10:00:00.000Z',
      aleatorio: conSemilla(semilla),
    })
})

describe('rangos SQL = rangos TS', () => {
  const montos: [number, number][] = [
    [0, 0], [499999, 0], [500000, 1], [999999, 1], [1000000, 2], [1999999, 2], [2000000, 3],
    [4999999, 3], [5000000, 4], [9999999, 4], [10000000, 5], [19999999, 5], [20000000, 6], [9e9, 6],
  ]
  it('rango_monto coincide con RANGOS_MONTO en cada límite', async () => {
    for (const [valor, indice] of montos) {
      const r = await db.query<{ r: string }>('select public.rango_monto($1::numeric) as r', [valor])
      expect(r.rows[0]?.r, `monto ${valor}`).toBe(RANGOS_MONTO[indice])
    }
  })

  const conteos: [number, number][] = [[0, 0], [10, 0], [11, 1], [25, 1], [26, 2], [50, 2], [51, 3], [100, 3], [101, 4]]
  it('rango_conteo coincide con RANGOS_CONTEO en cada límite', async () => {
    for (const [valor, indice] of conteos) {
      const r = await db.query<{ r: string }>('select public.rango_conteo($1::integer) as r', [valor])
      expect(r.rows[0]?.r, `conteo ${valor}`).toBe(RANGOS_CONTEO[indice])
    }
  })

  it('nulo y negativo no tienen rango', async () => {
    const r = await db.query<{ a: string | null; b: string | null }>(
      'select public.rango_monto(null) as a, public.rango_conteo(-1) as b',
    )
    expect(r.rows[0]).toEqual({ a: null, b: null })
  })
})

describe('vista_publica_asesorias', () => {
  it('solo trae asesorías conservadas (22 de 23 filas leídas)', async () => {
    const r = await db.query<{ n: string }>('select count(*)::text as n from public.vista_publica_asesorias')
    expect(r.rows[0]?.n).toBe('22')
  })

  it('no expone ninguna columna prohibida', async () => {
    const r = await db.query('select * from public.vista_publica_asesorias limit 1')
    const columnas = r.fields.map((f) => f.name)
    expect(columnas.filter((c) => CLAVES_PROHIBIDAS.has(c.toLowerCase()))).toEqual([])
    // y tampoco números de contacto, documentos o correos en los VALORES
    const todo = JSON.stringify((await db.query('select * from public.vista_publica_asesorias')).rows)
    expect(todo).not.toMatch(/ejemplo\.invalid/)
    expect(todo).not.toMatch(/99\d{6}/)
    expect(todo).not.toContain('texto libre de prueba')
    expect(todo).not.toContain('Persona')
  })

  it('el mes se calcula en hora de Colombia', async () => {
    const r = await db.query<{ mes: string }>(
      `select v.mes from public.vista_publica_asesorias v
        where v.rango_clientes_mes = '0 a 10' and v.rango_ventas_mes = '51 a 100'`,
    )
    expect(r.rows).toEqual([{ mes: '2026-10' }]) // 1 nov 03:00 UTC = 31 oct 22:00 en Colombia
  })

  it('publica montos en rangos y marca el atípico', async () => {
    const r = await db.query<{ rango_ventas_total: string; atipica: boolean }>(
      `select rango_ventas_total, atipica from public.vista_publica_asesorias where atipica`,
    )
    expect(r.rows).toEqual([{ rango_ventas_total: 'Más de $20 millones', atipica: true }])
  })

  it('los códigos múltiples salen como lista', async () => {
    const r = await db.query<{ mejoras: string[] }>('select mejoras from public.vista_publica_asesorias limit 1')
    expect(r.rows[0]?.mejoras).toEqual(['CT'])
  })
})

describe('vista_publica_agregados', () => {
  it('solo existen grupos con 5 o más beneficiarios', async () => {
    const r = await db.query<{ proyecto: string; nivel: string; municipio_codigo: string | null; n_beneficiarios: number }>(
      'select proyecto, nivel, municipio_codigo, n_beneficiarios from public.vista_publica_agregados order by 1, 2, 3',
    )
    expect(r.rows).toEqual([
      { proyecto: A, nivel: 'municipio', municipio_codigo: '76001', n_beneficiarios: 13 }, // 12 + el beneficiario 401
      { proyecto: A, nivel: 'proyecto', municipio_codigo: null, n_beneficiarios: 13 },
      { proyecto: B, nivel: 'municipio', municipio_codigo: '76111', n_beneficiarios: 6 },
      { proyecto: B, nivel: 'proyecto', municipio_codigo: null, n_beneficiarios: 9 },
      // Tuluá (3 beneficiarios) no aparece
    ])
  })

  it('el promedio excluye los montos atípicos', async () => {
    // ingresos del proyecto A, sin el atípico (i = 12): 1.1M … 2.1M (i = 1..11) y el beneficiario 401 con 2.5M
    const ingresos = [...Array.from({ length: 11 }, (_, i) => 1000000 + (i + 1) * 100000), 2500000]
    const esperado = Math.round(ingresos.reduce((a, b) => a + b, 0) / ingresos.length)
    const r = await db.query<{ p: string }>(
      `select promedio_ingreso_mensual::text as p from public.vista_publica_agregados
        where proyecto = '${A}' and nivel = 'proyecto'`,
    )
    expect(Number(r.rows[0]?.p)).toBe(esperado)
  })
})

describe('permisos de las vistas', () => {
  const vistas = ['vista_publica_asesorias', 'vista_publica_agregados', 'vista_publica_denominadores', 'vista_publica_meta']

  it('publico_ro lee las vistas', async () => {
    for (const v of vistas) {
      const r = await comoRol(db, 'publico_ro', null, () => db.query(`select * from public.${v} limit 1`))
      expect(r.rows.length).toBeGreaterThanOrEqual(0)
    }
  })

  it('publico_ro NO puede leer tablas con datos personales ni escribir', async () => {
    for (const t of ['asesorias', 'beneficiarios', 'cargas', 'bitacora', 'denominadores']) {
      await expect(comoRol(db, 'publico_ro', null, () => db.query(`select * from public.${t}`))).rejects.toThrow(/permission denied/i)
    }
    await expect(
      comoRol(db, 'publico_ro', null, () => db.query('delete from public.denominadores where true')),
    ).rejects.toThrow(/permission denied/i)
  })

  it('publico_ro no puede ejecutar la carga ni leer auth', async () => {
    await expect(
      comoRol(db, 'publico_ro', null, () => db.query(`select public.reemplazar_datos('{}'::jsonb, null)`)),
    ).rejects.toThrow(/permission denied/i)
    await expect(comoRol(db, 'publico_ro', null, () => db.query('select * from auth.users'))).rejects.toThrow(/permission denied/i)
  })

  it('anon y authenticated (incluido admin) no ven las vistas', async () => {
    for (const v of vistas) {
      await expect(comoRol(db, 'anon', null, () => db.query(`select * from public.${v}`))).rejects.toThrow(/permission denied/i)
      await expect(
        comoRol(db, 'authenticated', { sub: '1', app_metadata: { rol: 'admin' } }, () => db.query(`select * from public.${v}`)),
      ).rejects.toThrow(/permission denied/i)
    }
  })
})

describe('publico.json ensamblado desde la base', () => {
  it('pasa la verificación de publicación', () => {
    expect(() => verificarPublico(ensamblar(1))).not.toThrow()
  })

  it('tiene la forma esperada', () => {
    const p = ensamblar(1)
    expect(p.totales).toEqual({ asesorias_conservadas: 22, asesorias_descartadas: 1, beneficiarios_con_asesoria: 22 })
    expect(p.asesorias).toHaveLength(22)
    expect(p.agregados).toHaveLength(4)
    expect(p.denominadores).toEqual([{ proyecto: A, total_beneficiarios: 1300 }])
    expect(p.fecha_corte).toMatch(/^2026-/)
    expect(p.fuente_municipio).toBe('residencia')
  })

  it('no contiene datos personales ni textos libres en ninguna parte del archivo', () => {
    const texto = JSON.stringify(ensamblar(1))
    for (const prohibido of ['ejemplo.invalid', 'Persona', 'Negocio ficticio', 'texto libre de prueba', 'explicación de prueba', '"documento"', '"email"', '"celular"', '"nit"']) {
      expect(texto, prohibido).not.toContain(prohibido)
    }
    expect(texto).not.toMatch(/\b99\d{6}\b/) // documentos
    expect(texto).not.toMatch(/\b3000\d{6}\b/) // celulares
  })

  it('los identificadores no se pueden cruzar con los de la base ni entre generaciones', () => {
    const a = ensamblar(1)
    const b = ensamblar(2)
    // El orden del archivo no sigue el de la base: con otra semilla, la fila "a0001" es otra
    const secuencia = (p: typeof a) =>
      p.asesorias.map((f) => [f.proyecto, f.municipio_codigo, f.rango_ingreso_mensual, f.mes].join('|'))
    expect(secuencia(a)).not.toEqual(secuencia(b))
    // el id de asesoría y el de beneficiario se mezclan por separado
    expect(a.asesorias.map((f) => f.id.slice(1))).not.toEqual(a.asesorias.map((f) => f.beneficiario.slice(1)))
    // mismo beneficiario con identificadores distintos en cada generación
    const clave = (p: typeof a) => p.asesorias.find((f) => f.proyecto === B && f.municipio_codigo === '76111')?.beneficiario
    expect(clave(a)).not.toBe(clave(b))
    // determinista con la misma semilla
    expect(ensamblar(1)).toEqual(a)
  })

  it('un beneficiario conserva el mismo identificador en todas sus filas', () => {
    const p = ensamblar(3)
    const porBenef = new Map<string, Set<string>>()
    for (const f of p.asesorias) porBenef.set(f.beneficiario, (porBenef.get(f.beneficiario) ?? new Set()).add(f.id))
    // cada beneficiario del dataset tiene exactamente una asesoría conservada
    expect([...porBenef.values()].every((ids) => ids.size === 1)).toBe(true)
    expect(porBenef.size).toBe(22)
  })
})

describe('generarPublico (el mismo código que usa el workflow)', () => {
  it('lee las vistas con el rol de solo lectura y entrega un archivo verificado', async () => {
    const p = await generarPublico(
      { query: (sql) => comoRol(db, 'publico_ro', null, () => db.query(sql)) },
      { generadoEn: '2026-10-28T10:00:00.000Z', aleatorio: conSemilla(5) },
    )
    expect(p.asesorias).toHaveLength(22)
    expect(p.agregados).toHaveLength(4)
  })

  it('falla si la base devolviera algo que no se puede publicar (el despliegue se detiene)', async () => {
    const consulta = async (sql: string) => {
      const r = await db.query<Record<string, unknown>>(sql)
      // simula una vista mal hecha que dejara salir el documento
      if (sql.includes('vista_publica_asesorias')) return { rows: r.rows.map((f) => ({ ...f, documento: '99000001' })) }
      return r
    }
    await expect(generarPublico({ query: consulta }, { generadoEn: 'x' })).rejects.toThrow(/NO se puede publicar/)
  })
})
