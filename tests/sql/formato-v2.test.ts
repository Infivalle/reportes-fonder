/**
 * Migración 20261030000000 contra un Postgres embebido (PGlite): aplica las migraciones en orden,
 * carga payloads reales de la limpieza y comprueba que las columnas nuevas se guardan, que v1
 * sigue cargando, que una clave sin columna se rechaza y que la capa pública no cambia ni deja
 * salir ninguna columna nueva a publico.json.
 */
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { construirPayloadDb, limpiarTsv } from '../../src/limpieza/index.ts'
import { generarPublico } from '../../src/publico/generar.ts'
import { tsvV1, tsvV2 } from '../fixtures/construirTsvSintetico.ts'

const DIR_MIGRACIONES = new URL('../../supabase/migrations/', import.meta.url)

const COLUMNAS_NUEVAS = [
  'municipio_empresa',
  'tipo_empresa',
  'anio_fundacion',
  'empleos_generados',
  'empleos_a_generar',
  'patrimonio',
  'pasivos',
  'dinero_solicitado',
  'cuotas',
]

let db: PGlite

function payloadDe(tsv: string, archivo: string) {
  const r = limpiarTsv(tsv)
  if (!r.ok) throw new Error(r.errores.join(' | '))
  return construirPayloadDb(r.resultado, archivo)
}

async function cargar(payload: unknown) {
  await db.query('select public.reemplazar_datos($1::jsonb, null)', [JSON.stringify(payload)])
}

beforeAll(async () => {
  db = new PGlite()
  // Lo que en Supabase ya existe: esquema auth, función jwt() y los roles.
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create role anon;
    create role authenticated;
    create role service_role;
  `)
  const archivos = readdirSync(DIR_MIGRACIONES).filter((f) => f.endsWith('.sql')).sort()
  for (const archivo of archivos) {
    await db.exec(readFileSync(new URL(archivo, DIR_MIGRACIONES), 'utf8'))
  }
}, 120_000)

afterAll(async () => {
  await db.close()
})

describe('migración formato v2', () => {
  it('la tabla beneficiarios tiene las nueve columnas nuevas', async () => {
    const r = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'beneficiarios'`,
    )
    const columnas = r.rows.map((f) => f.column_name)
    for (const c of COLUMNAS_NUEVAS) expect(columnas).toContain(c)
  })

  it('una carga v2 guarda las columnas nuevas y el municipio de la empresa', async () => {
    const tsv = tsvV2([
      {
        municipioempresa: 'TULU�',
        ciudad: 'Cali',
        tipoempresa: 'Persona jurídica',
        aniofundacion: '2015',
        empleosgenerado: '4',
        empleosagenerar: '6',
        patrimonio: '30000000',
        pasivos: '4500000.5',
        dinerosolicitado: '8000000',
        cuotas: '24',
      },
      { municipioempresa: 'NULL', ciudad: 'Cartago' },
    ])
    await cargar(payloadDe(tsv, 'v2.tsv'))

    const r = await db.query<Record<string, unknown>>(
      `select municipio_codigo, municipio_origen, municipio_empresa, tipo_empresa, anio_fundacion,
              empleos_generados, empleos_a_generar, patrimonio, pasivos, dinero_solicitado, cuotas
         from public.beneficiarios order by id`,
    )
    expect(r.rows).toHaveLength(2)
    const [a, b] = r.rows as [Record<string, unknown>, Record<string, unknown>]
    expect(a).toMatchObject({
      municipio_codigo: '76834',
      municipio_origen: 'empresa',
      municipio_empresa: 'TULU�',
      tipo_empresa: 'Persona jurídica',
      anio_fundacion: 2015,
      empleos_generados: 4,
      empleos_a_generar: 6,
    })
    expect(Number(a.patrimonio)).toBe(30000000)
    expect(Number(a.pasivos)).toBe(4500000.5)
    expect(Number(a.dinero_solicitado)).toBe(8000000)
    expect(Number(a.cuotas)).toBe(24)
    expect(b).toMatchObject({ municipio_codigo: '76147', municipio_origen: 'residencia', municipio_empresa: null })

    const carga = await db.query<{ formato: string }>('select formato from public.cargas order by id desc limit 1')
    expect(carga.rows[0]!.formato).toBe('v2')
  })

  it('una carga v1 sigue funcionando y deja las columnas nuevas vacías', async () => {
    await cargar(payloadDe(tsvV1([{ ciudad: 'Cali' }, { ciudad: 'Cartago' }]), 'v1.tsv'))
    const r = await db.query<Record<string, unknown>>(
      `select municipio_origen, municipio_empresa, patrimonio, cuotas from public.beneficiarios order by id`,
    )
    expect(r.rows).toHaveLength(2)
    for (const fila of r.rows) {
      expect(fila).toMatchObject({
        municipio_origen: 'residencia',
        municipio_empresa: null,
        patrimonio: null,
        cuotas: null,
      })
    }
  })

  it('una clave sin columna se rechaza con un mensaje claro y no cambia nada', async () => {
    await cargar(payloadDe(tsvV1([{}, {}, {}]), 'previa.tsv'))
    const antes = await db.query<{ n: number }>('select count(*)::int as n from public.asesorias')

    const payload = payloadDe(tsvV2([{}]), 'conMasColumnas.tsv')
    payload.beneficiarios[0]!.columna_inventada = 'x'
    await expect(cargar(payload)).rejects.toThrow(/beneficiarios no tiene las columnas: columna_inventada/)

    const despues = await db.query<{ n: number }>('select count(*)::int as n from public.asesorias')
    expect(despues.rows[0]!.n).toBe(antes.rows[0]!.n)
    expect(antes.rows[0]!.n).toBe(3)
  })

  it('lo mismo para una clave de asesorías sin columna', async () => {
    const payload = payloadDe(tsvV1([{}]), 'conMasColumnas.tsv')
    payload.asesorias[0]!.columna_inventada = 'x'
    await expect(cargar(payload)).rejects.toThrow(/asesorias no tiene las columnas: columna_inventada/)
  })

  it('la capa pública sigue funcionando y no expone ninguna columna nueva', async () => {
    await cargar(payloadDe(tsvV2([{}, { municipioempresa: 'Cali' }]), 'v2.tsv'))

    const vista = await db.query<Record<string, unknown>>('select * from public.vista_publica_asesorias')
    expect(vista.rows).toHaveLength(2)
    const claves = Object.keys(vista.rows[0]!)
    for (const c of [...COLUMNAS_NUEVAS, 'patrimonio', 'nit', 'documento', 'email']) {
      expect(claves, c).not.toContain(c)
    }

    const agregados = await db.query('select * from public.vista_publica_agregados')
    expect(agregados.rows.length).toBeGreaterThanOrEqual(0)
    const meta = await db.query<{ asesorias_conservadas: number }>('select * from public.vista_publica_meta')
    expect(meta.rows[0]!.asesorias_conservadas).toBe(2)
  })
})

describe('capa pública con el formato v2', () => {
  const generadoEn = '2026-10-28T12:00:00.000Z'

  it('la vista de meta informa el formato de la última carga', async () => {
    await cargar(payloadDe(tsvV2([{}]), 'v2.tsv'))
    const v2 = await db.query<{ ultimo_formato: string }>('select ultimo_formato from public.vista_publica_meta')
    expect(v2.rows[0]!.ultimo_formato).toBe('v2')

    await cargar(payloadDe(tsvV1([{}]), 'v1.tsv'))
    const v1 = await db.query<{ ultimo_formato: string }>('select ultimo_formato from public.vista_publica_meta')
    expect(v1.rows[0]!.ultimo_formato).toBe('v1')
  })

  it('publico.json de una carga v2 usa el municipio de la empresa y no deja salir ningún dato nuevo', async () => {
    await cargar(
      payloadDe(
        tsvV2([
          {
            municipioempresa: 'TULU\uFFFD',
            ciudad: 'Cali',
            tipoempresa: 'Persona jurídica ZETA',
            aniofundacion: '1987',
            patrimonio: '98765432',
            pasivos: '87654321',
            dinerosolicitado: '76543210',
            cuotas: '36',
          },
          { municipioempresa: 'Toro', ciudad: 'Cali', tipoempresa: 'Persona jurídica ZETA' },
        ]),
        'v2.tsv',
      ),
    )

    // generarPublico verifica el contenido y lanza un error si algo no se puede publicar
    const publico = await generarPublico(db, { generadoEn, aleatorio: () => 0.5 })

    expect(publico.fuente_municipio).toBe('empresa')
    expect(publico.asesorias.map((a) => a.municipio_codigo).sort()).toEqual(['76823', '76834'])

    const texto = JSON.stringify(publico)
    for (const secreto of ['ZETA', '98765432', '87654321', '76543210', 'TULU', 'municipio_empresa']) {
      expect(texto, secreto).not.toContain(secreto)
    }
    for (const clave of ['patrimonio', 'pasivos', 'cuotas', 'dinero_solicitado', 'anio_fundacion', 'tipo_empresa']) {
      expect(texto, clave).not.toContain(`"${clave}"`)
    }
  })

  it('con una carga v1 la fuente del municipio sigue siendo la residencia', async () => {
    await cargar(payloadDe(tsvV1([{ ciudad: 'Cali' }]), 'v1.tsv'))
    const publico = await generarPublico(db, { generadoEn, aleatorio: () => 0.5 })
    expect(publico.fuente_municipio).toBe('residencia')
    expect(publico.asesorias[0]!.municipio_codigo).toBe('76001')
  })
})
