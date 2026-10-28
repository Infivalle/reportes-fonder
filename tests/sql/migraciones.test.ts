import { readFileSync } from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { construirPayloadDb, limpiarTsv } from '../../src/limpieza/index.ts'
import { comoRol, contar, crearBaseSupabase } from './ayuda.ts'

/**
 * Prueba las migraciones sobre un Postgres embebido (PGlite), imitando lo que Supabase
 * provee: roles anon / authenticated / service_role, el esquema `auth` y los permisos por
 * defecto (más permisivos que los del proyecto real: si pasa aquí, pasa allá).
 */

const fixtureTsv = readFileSync(new URL('../fixtures/asesorias_v1_sintetico.tsv', import.meta.url), 'utf-8')

function payloadDeFixture() {
  const r = limpiarTsv(fixtureTsv)
  if (!r.ok) throw new Error(r.errores.join('\n'))
  return construirPayloadDb(r.resultado, 'fixture.tsv')
}

let db: PGlite

beforeAll(async () => {
  db = await crearBaseSupabase()
})

describe('migraciones', () => {
  it('se aplican en orden sin errores', async () => {
    expect(await contar(db, 'asesorias')).toBe(0)
  })

  it('reemplazar_datos solo la ejecuta service_role', async () => {
    const payload = JSON.stringify(payloadDeFixture())
    for (const rol of ['anon', 'authenticated']) {
      await expect(
        comoRol(db, rol, null, () => db.query('select public.reemplazar_datos($1::jsonb, null)', [payload])),
      ).rejects.toThrow(/permission denied/i)
    }
  })

  it('anon no puede leer ninguna tabla', async () => {
    for (const t of ['asesorias', 'beneficiarios', 'cargas', 'bitacora', 'proyectos', 'denominadores']) {
      await expect(
        comoRol(db, 'anon', null, () => db.query(`select * from public.${t}`)),
      ).rejects.toThrow(/permission denied/i)
    }
  })
})

describe('reemplazar_datos', () => {
  it('carga el fixture completo en una transacción', async () => {
    const payload = JSON.stringify(payloadDeFixture())
    const r = await comoRol(db, 'service_role', null, () =>
      db.query<{ id: string }>('select public.reemplazar_datos($1::jsonb, null) as id', [payload]),
    )
    expect(Number(r.rows[0]?.id)).toBe(1)

    expect(await contar(db, 'asesorias')).toBe(11)
    expect(await contar(db, 'beneficiarios')).toBe(8)
    expect(await contar(db, 'proyectos')).toBe(2)
    expect(await contar(db, 'beneficiarios_proyecto')).toBe(8)
    expect(await contar(db, 'cargas')).toBe(1)

    const cons = await db.query<{ c: string; d: string }>(
      `select count(*) filter (where conservada)::text as c,
              count(*) filter (where not conservada)::text as d from public.asesorias`,
    )
    expect(cons.rows[0]).toEqual({ c: '8', d: '3' })

    const carga = await db.query<{ n: string }>('select count(*)::text as n from public.asesorias where carga_id = 1')
    expect(carga.rows[0]?.n).toBe('11')

    const mejoras = await db.query<{ codigo: string }>(
      'select codigo from public.asesoria_mejoras where asesoria_id = 2 order by codigo',
    )
    expect(mejoras.rows.map((m) => m.codigo)).toEqual(['AA', 'AI'])
  })

  it('guarda tipos y municipios correctamente', async () => {
    const r = await db.query<Record<string, unknown>>(
      `select b.municipio_codigo, b.municipio_origen, a.monthly_income, a.creada_en::text as creada, a.atipica
         from public.asesorias a join public.beneficiarios b on b.id = a.beneficiario_id
        where a.id in (1, 10) order by a.id`,
    )
    expect(r.rows[0]).toMatchObject({ municipio_codigo: '76001', municipio_origen: 'residencia', atipica: false })
    expect(Number(r.rows[0]?.['monthly_income'])).toBe(2500000)
    expect(String(r.rows[0]?.['creada'])).toContain('2026-10-16 18:30:12')
    expect(r.rows[1]).toMatchObject({ atipica: true })
  })

  it('una segunda carga reemplaza todo y conserva proyectos y denominadores', async () => {
    const proyecto = await db.query<{ id: string }>(
      `select id::text from public.proyectos where nombre = 'Fonder Valle Primera Convocatoria'`,
    )
    const idProyecto = proyecto.rows[0]?.id
    await db.query('insert into public.denominadores (proyecto_id, total_beneficiarios) values ($1, 1300)', [idProyecto])

    const payload = JSON.stringify(payloadDeFixture())
    const r = await comoRol(db, 'service_role', null, () =>
      db.query<{ id: string }>('select public.reemplazar_datos($1::jsonb, null) as id', [payload]),
    )
    expect(Number(r.rows[0]?.id)).toBe(2)

    expect(await contar(db, 'asesorias')).toBe(11) // no se acumula
    expect(await contar(db, 'cargas')).toBe(2)
    expect(await contar(db, 'proyectos')).toBe(2)

    const den = await db.query<{ proyecto_id: string; total: number }>(
      'select proyecto_id::text, total_beneficiarios as total from public.denominadores',
    )
    expect(den.rows).toEqual([{ proyecto_id: idProyecto, total: 1300 }])
  })

  it('si algo falla, no cambia nada (atomicidad)', async () => {
    const mala = payloadDeFixture()
    // una asesoría que apunta a un beneficiario que no existe
    mala.asesorias.push({ ...(mala.asesorias[0] ?? {}), id: 999, beneficiario_id: 424242 })
    mala.carga.filas_leidas = 12

    await expect(
      comoRol(db, 'service_role', null, () =>
        db.query('select public.reemplazar_datos($1::jsonb, null)', [JSON.stringify(mala)]),
      ),
    ).rejects.toThrow()

    expect(await contar(db, 'asesorias')).toBe(11)
    expect(await contar(db, 'beneficiarios')).toBe(8)
    expect(await contar(db, 'cargas')).toBe(2) // la carga fallida no quedó registrada
    const ids = await db.query<{ n: string }>('select count(*)::text as n from public.asesorias where id = 999')
    expect(ids.rows[0]?.n).toBe('0')
  })

  it('rechaza una carga útil inválida', async () => {
    await expect(
      comoRol(db, 'service_role', null, () => db.query(`select public.reemplazar_datos('{}'::jsonb, null)`)),
    ).rejects.toThrow(/inválida/)
  })
})

describe('RLS por rol', () => {
  const admin = { sub: '11111111-1111-1111-1111-111111111111', app_metadata: { rol: 'admin' } }
  const asesor = { sub: '22222222-2222-2222-2222-222222222222', app_metadata: { rol: 'asesor' } }
  const sinRol = { sub: '33333333-3333-3333-3333-333333333333', app_metadata: {} }
  // user_metadata lo puede editar el propio usuario: nunca debe dar permisos
  const trampa = { sub: '44444444-4444-4444-4444-444444444444', user_metadata: { rol: 'admin' } }

  const contarComo = (claims: object, tabla: string) =>
    comoRol(db, 'authenticated', claims, async () => {
      const r = await db.query<{ n: string }>(`select count(*)::text as n from public.${tabla}`)
      return Number(r.rows[0]?.n)
    })

  it('asesor y admin leen beneficiarios y asesorías', async () => {
    expect(await contarComo(admin, 'asesorias')).toBe(11)
    expect(await contarComo(asesor, 'asesorias')).toBe(11)
    expect(await contarComo(asesor, 'beneficiarios')).toBe(8)
  })

  it('una sesión sin rol, o con rol solo en user_metadata, no ve nada', async () => {
    expect(await contarComo(sinRol, 'asesorias')).toBe(0)
    expect(await contarComo(trampa, 'beneficiarios')).toBe(0)
  })

  it('solo el admin ve las cargas', async () => {
    expect(await contarComo(admin, 'cargas')).toBe(2)
    expect(await contarComo(asesor, 'cargas')).toBe(0)
  })

  it('el asesor no puede modificar asesorías ni denominadores', async () => {
    await expect(
      comoRol(db, 'authenticated', asesor, () => db.query('delete from public.asesorias where true')),
    ).rejects.toThrow(/permission denied/i)

    const antes = await contar(db, 'denominadores')
    await comoRol(db, 'authenticated', asesor, () =>
      db.query('update public.denominadores set total_beneficiarios = 1 where true'),
    )
    const total = await db.query<{ t: number }>('select min(total_beneficiarios) as t from public.denominadores')
    expect(total.rows[0]?.t).toBe(1300) // RLS: la fila no era visible para modificarla
    expect(await contar(db, 'denominadores')).toBe(antes)
  })

  it('el admin sí puede editar denominadores', async () => {
    await comoRol(db, 'authenticated', admin, () =>
      db.query('update public.denominadores set total_beneficiarios = 1400 where true'),
    )
    const r = await db.query<{ t: number }>('select min(total_beneficiarios) as t from public.denominadores')
    expect(r.rows[0]?.t).toBe(1400)
  })

  it('la bitácora solo acepta registros propios de asesor o admin', async () => {
    await db.query(`insert into auth.users (id, email) values ($1, 'a@ejemplo.invalid'), ($2, 'b@ejemplo.invalid')`, [
      asesor.sub,
      admin.sub,
    ])
    await comoRol(db, 'authenticated', asesor, () =>
      db.query(`insert into public.bitacora (usuario_id, accion, beneficiario_id) values ($1, 'consulta_ficha', 9001)`, [asesor.sub]),
    )
    // a nombre de otra persona: rechazado
    await expect(
      comoRol(db, 'authenticated', asesor, () =>
        db.query(`insert into public.bitacora (usuario_id, accion) values ($1, 'consulta_ficha')`, [admin.sub]),
      ),
    ).rejects.toThrow(/row-level security/i)
    // sin rol: rechazado
    await expect(
      comoRol(db, 'authenticated', sinRol, () =>
        db.query(`insert into public.bitacora (usuario_id, accion) values ($1, 'consulta_ficha')`, [sinRol.sub]),
      ),
    ).rejects.toThrow()

    expect(await contarComo(admin, 'bitacora')).toBe(1)
    expect(await contarComo(asesor, 'bitacora')).toBe(0) // el asesor no lee la bitácora
  })
})
