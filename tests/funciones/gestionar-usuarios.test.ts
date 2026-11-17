import { describe, expect, it } from 'vitest'
import { generarClaveTemporal, validarClave } from '../../src/funciones/gestionar-usuarios/clave.ts'
import { leerAal, manejarUsuarios, type EntornoUsuarios } from '../../src/funciones/gestionar-usuarios/manejador.ts'

const URL_SB = 'https://ejemplo.supabase.co'
const ENTORNO: EntornoUsuarios = { supabaseUrl: URL_SB, anonKey: 'anon-de-prueba', serviceKey: 'service-de-prueba', origenPermitido: 'https://infivalle.github.io' }

const ID_ADMIN = '11111111-1111-1111-1111-111111111111'
const ID_ADMIN2 = '22222222-2222-2222-2222-222222222222'
const ID_ASESOR = '33333333-3333-3333-3333-333333333333'

interface U {
  id: string
  email: string
  banned_until?: string | null
  app_metadata: Record<string, unknown>
  user_metadata?: Record<string, unknown>
  factors?: { id: string; status: string }[]
  created_at?: string
  last_sign_in_at?: string | null
}
interface Llamada {
  url: string
  metodo: string
  cuerpo: unknown
  cabeceras: Record<string, string>
}

/** Simula Auth (admin) y la tabla bitácora con un almacén en memoria. */
function mundo(inicial?: U[], opts: { bitacoraFalla?: boolean; yo?: U | null } = {}) {
  const usuarios: U[] = inicial ?? [
    { id: ID_ADMIN, email: 'admin@x.test', app_metadata: { rol: 'admin' }, factors: [{ id: 'f1', status: 'verified' }] },
    { id: ID_ADMIN2, email: 'admin2@x.test', app_metadata: { rol: 'admin' } },
    { id: ID_ASESOR, email: 'asesor@x.test', app_metadata: { rol: 'asesor' }, user_metadata: { debe_cambiar_clave: false, otro: 1 } },
  ]
  const llamadas: Llamada[] = []
  const bitacora: Record<string, unknown>[] = []
  const yo = opts.yo === undefined ? usuarios[0]! : opts.yo
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const metodo = init?.method ?? 'GET'
    const cuerpo = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined
    llamadas.push({ url, metodo, cuerpo, cabeceras: (init?.headers ?? {}) as Record<string, string> })
    const ruta = url.replace(URL_SB, '')
    const json = (estado: number, c: unknown) => new Response(JSON.stringify(c), { status: estado })

    if (ruta === '/auth/v1/user') return yo === null ? json(401, {}) : json(200, yo)
    if (ruta.startsWith('/rest/v1/bitacora')) {
      if (opts.bitacoraFalla) return new Response('detalle interno', { status: 400 })
      bitacora.push(cuerpo as Record<string, unknown>)
      return new Response(null, { status: 201 })
    }
    if (ruta.startsWith('/auth/v1/admin/users?')) return json(200, { users: usuarios })
    if (ruta === '/auth/v1/admin/users' && metodo === 'POST') {
      const c = cuerpo as { email: string; password: string; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown> }
      if (usuarios.some((u) => u.email === c.email)) return json(422, { error_code: 'email_exists' })
      const nuevo: U = { id: '44444444-4444-4444-4444-444444444444', email: c.email, app_metadata: c.app_metadata, user_metadata: c.user_metadata }
      usuarios.push(nuevo)
      return json(200, nuevo)
    }
    const m = /^\/auth\/v1\/admin\/users\/([^/]+)(?:\/factors\/([^/]+))?$/.exec(ruta)
    if (m !== null) {
      const u = usuarios.find((x) => x.id === m[1])
      if (u === undefined) return json(404, {})
      if (metodo === 'GET') return json(200, u)
      if (metodo === 'DELETE' && m[2] !== undefined) {
        u.factors = (u.factors ?? []).filter((x) => x.id !== m[2])
        return json(200, {})
      }
      if (metodo === 'PUT') {
        const c = cuerpo as { app_metadata?: Record<string, unknown>; ban_duration?: string; user_metadata?: Record<string, unknown> }
        if (c.app_metadata !== undefined) u.app_metadata = c.app_metadata
        if (c.user_metadata !== undefined) u.user_metadata = c.user_metadata
        if (c.ban_duration === 'none') u.banned_until = null
        else if (c.ban_duration !== undefined) u.banned_until = new Date(Date.now() + 1e11).toISOString()
        return json(200, u)
      }
    }
    throw new Error(`URL inesperada: ${metodo} ${url}`)
  }) as typeof fetch
  return { f, llamadas, usuarios, bitacora }
}

function peticion(cuerpo: unknown, opts: { auth?: string | null; metodo?: string; extra?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.extra }
  if (opts.auth !== null) headers['Authorization'] = opts.auth ?? 'Bearer token-de-prueba'
  const metodo = opts.metodo ?? 'POST'
  return new Request(`${URL_SB}/functions/v1/gestionar-usuarios`, { method: metodo, headers, ...(metodo === 'POST' ? { body: JSON.stringify(cuerpo) } : {}) })
}
const ejecutar = (m: ReturnType<typeof mundo>, cuerpo: unknown, entorno: EntornoUsuarios = ENTORNO, clave = 'Temporal-Abcdef12!') =>
  manejarUsuarios(peticion(cuerpo), { entorno, fetch: m.f, generarClave: () => clave })
const escrituras = (m: ReturnType<typeof mundo>) => m.llamadas.filter((l) => l.metodo !== 'GET' && l.url.includes('/auth/v1/admin'))

describe('gestionar-usuarios · acceso', () => {
  it('405 si no es POST y preflight CORS solo para el origen permitido', async () => {
    const m = mundo()
    expect((await manejarUsuarios(peticion(null, { metodo: 'GET' }), { entorno: ENTORNO, fetch: m.f })).status).toBe(405)
    const ok = await manejarUsuarios(peticion(null, { metodo: 'OPTIONS', extra: { Origin: 'https://infivalle.github.io' } }), { entorno: ENTORNO, fetch: m.f })
    expect(ok.status).toBe(204)
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://infivalle.github.io')
    const otro = await manejarUsuarios(peticion(null, { metodo: 'OPTIONS', extra: { Origin: 'https://malo.example' } }), { entorno: ENTORNO, fetch: m.f })
    expect(otro.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
  it('401 sin sesión o con token inválido', async () => {
    const m = mundo()
    expect((await manejarUsuarios(peticion({ accion: 'listar' }, { auth: null }), { entorno: ENTORNO, fetch: m.f })).status).toBe(401)
    expect(m.llamadas).toHaveLength(0)
    const malo = mundo(undefined, { yo: null })
    expect((await ejecutar(malo, { accion: 'listar' })).status).toBe(401)
  })
  it('403 para asesor, sin rol o con rol en user_metadata, sin tocar Auth admin', async () => {
    for (const yo of [
      { id: ID_ASESOR, email: 'a@x.test', app_metadata: { rol: 'asesor' } },
      { id: ID_ASESOR, email: 'a@x.test', app_metadata: {} },
      { id: ID_ASESOR, email: 'a@x.test', app_metadata: {}, user_metadata: { rol: 'admin' } },
    ] as U[]) {
      const m = mundo(undefined, { yo })
      expect((await ejecutar(m, { accion: 'listar' })).status).toBe(403)
      expect(m.llamadas.filter((l) => l.url.includes('/admin/'))).toHaveLength(0)
    }
  })
  it('con EXIGIR_AAL2 pide el segundo factor; sin él, no', async () => {
    const aal1 = `Bearer x.${btoa(JSON.stringify({ aal: 'aal1' }))}.y`
    const aal2 = `Bearer x.${btoa(JSON.stringify({ aal: 'aal2' }))}.y`
    const m = mundo()
    const exigir = { ...ENTORNO, exigirAal2: true }
    const r1 = await manejarUsuarios(peticion({ accion: 'listar' }, { auth: aal1 }), { entorno: exigir, fetch: m.f })
    expect(r1.status).toBe(403)
    expect(await r1.json()).toMatchObject({ codigo: 'requiere_aal2' })
    expect((await manejarUsuarios(peticion({ accion: 'listar' }, { auth: aal2 }), { entorno: exigir, fetch: m.f })).status).toBe(200)
    expect((await manejarUsuarios(peticion({ accion: 'listar' }, { auth: aal1 }), { entorno: ENTORNO, fetch: m.f })).status).toBe(200)
    expect(leerAal('Bearer basura')).toBe('')
  })
  it('400 con cuerpo inválido o acción desconocida', async () => {
    const m = mundo()
    expect((await manejarUsuarios(new Request(URL_SB, { method: 'POST', headers: { Authorization: 'Bearer t' }, body: 'no json' }), { entorno: ENTORNO, fetch: m.f })).status).toBe(400)
    expect((await ejecutar(m, [1, 2])).status).toBe(400)
    expect((await ejecutar(m, { accion: 'borrar_todo' })).status).toBe(400)
  })
})

describe('gestionar-usuarios · listar', () => {
  it('devuelve los usuarios ordenados, con estado y 2FA, sin datos de más', async () => {
    const m = mundo()
    m.usuarios[2]!.banned_until = new Date(Date.now() + 1e9).toISOString()
    m.usuarios[2]!.factors = []
    const j = (await (await ejecutar(m, { accion: 'listar' })).json()) as { usuarios: { correo: string; rol: string; activo: boolean; tiene2fa: boolean | null }[] }
    expect(j.usuarios.map((u) => u.correo)).toEqual(['admin@x.test', 'admin2@x.test', 'asesor@x.test'])
    expect(j.usuarios.find((u) => u.correo === 'asesor@x.test')).toMatchObject({ rol: 'asesor', activo: false, tiene2fa: false })
    expect(j.usuarios.find((u) => u.correo === 'admin@x.test')?.tiene2fa).toBe(true)
    expect(JSON.stringify(j)).not.toMatch(/service-de-prueba|app_metadata/)
  })
  it('un bloqueo ya vencido cuenta como activo', async () => {
    const m = mundo()
    m.usuarios[2]!.banned_until = '2020-01-01T00:00:00Z'
    const j = (await (await ejecutar(m, { accion: 'listar' })).json()) as { usuarios: { correo: string; activo: boolean }[] }
    expect(j.usuarios.find((u) => u.correo === 'asesor@x.test')?.activo).toBe(true)
  })
})

describe('gestionar-usuarios · crear', () => {
  it('registra en bitácora primero, crea con rol en app_metadata y entrega la clave una sola vez', async () => {
    const m = mundo()
    const r = await ejecutar(m, { accion: 'crear', correo: '  Nuevo@X.test ', rol: 'asesor' })
    expect(r.status).toBe(200)
    const j = (await r.json()) as { claveTemporal: string; usuario: { correo: string; rol: string } }
    expect(j.claveTemporal).toBe('Temporal-Abcdef12!')
    expect(j.usuario).toMatchObject({ correo: 'nuevo@x.test', rol: 'asesor' })
    const orden = m.llamadas.map((l) => (l.url.includes('/bitacora') ? 'bitacora' : l.metodo === 'POST' && l.url.endsWith('/admin/users') ? 'crear' : ''))
    expect(orden.indexOf('bitacora')).toBeLessThan(orden.indexOf('crear'))
    const crear = m.llamadas.find((l) => l.metodo === 'POST' && l.url.endsWith('/admin/users'))!
    expect(crear.cuerpo).toMatchObject({ email: 'nuevo@x.test', email_confirm: true, app_metadata: { rol: 'asesor' }, user_metadata: { debe_cambiar_clave: true } })
    expect(crear.cabeceras['apikey']).toBe('service-de-prueba')
    // la bitácora lleva a quien actúa y el rol, nunca la clave ni el correo
    expect(m.bitacora[0]).toEqual({ usuario_id: ID_ADMIN, accion: 'usuario_crea', detalle: { rol: 'asesor' } })
    expect(JSON.stringify(m.bitacora)).not.toMatch(/Temporal|nuevo@/)
  })
  it('rechaza correo inválido, rol inválido y correo repetido', async () => {
    const m = mundo()
    expect((await ejecutar(m, { accion: 'crear', correo: 'sin-arroba', rol: 'asesor' })).status).toBe(400)
    expect((await ejecutar(m, { accion: 'crear', correo: 'a@b.test', rol: 'superadmin' })).status).toBe(400)
    expect((await ejecutar(m, { accion: 'crear', correo: 'ASESOR@x.test', rol: 'asesor' })).status).toBe(409)
    expect(m.usuarios).toHaveLength(3)
  })
  it('un 422 que no es de correo repetido no se presenta como tal', async () => {
    const m = mundo()
    const f2 = (async (input: string | URL | Request, init?: RequestInit) =>
      String(input).endsWith('/auth/v1/admin/users') && init?.method === 'POST' ? new Response(JSON.stringify({ error_code: 'weak_password' }), { status: 422 }) : m.f(input, init)) as typeof fetch
    const r = await manejarUsuarios(peticion({ accion: 'crear', correo: 'nuevo@x.test', rol: 'asesor' }), { entorno: ENTORNO, fetch: f2, generarClave: () => 'x' })
    expect(r.status).toBe(502)
    expect(await r.text()).not.toMatch(/Ya existe/)
  })
  it('si falla la bitácora no se crea nada', async () => {
    const m = mundo(undefined, { bitacoraFalla: true })
    const r = await ejecutar(m, { accion: 'crear', correo: 'nuevo@x.test', rol: 'asesor' })
    expect(r.status).toBe(500)
    expect(await r.text()).not.toContain('detalle interno')
    expect(m.usuarios).toHaveLength(3)
    expect(escrituras(m)).toHaveLength(0)
  })
  it('la clave temporal nunca aparece en el cuerpo de un error', async () => {
    const m = mundo()
    const r = await ejecutar(m, { accion: 'crear', correo: 'asesor@x.test', rol: 'asesor' })
    expect(await r.text()).not.toContain('Temporal-Abcdef12!')
  })
})

describe('gestionar-usuarios · cambiar rol, desactivar, reactivar', () => {
  it('cambia el rol conservando el resto de app_metadata y lo registra', async () => {
    const m = mundo()
    m.usuarios[2]!.app_metadata = { rol: 'asesor', provider: 'email' }
    const r = await ejecutar(m, { accion: 'cambiar_rol', id: ID_ASESOR, rol: 'admin' })
    expect(r.status).toBe(200)
    expect(m.usuarios[2]!.app_metadata).toEqual({ rol: 'admin', provider: 'email' })
    expect(m.bitacora[0]).toMatchObject({ accion: 'usuario_cambia_rol', detalle: { objetivo_id: ID_ASESOR, rol_anterior: 'asesor', rol_nuevo: 'admin' } })
  })
  it('no permite cambiar la propia cuenta', async () => {
    const m = mundo()
    for (const c of [{ accion: 'cambiar_rol', id: ID_ADMIN, rol: 'asesor' }, { accion: 'desactivar', id: ID_ADMIN }, { accion: 'restablecer_clave', id: ID_ADMIN }, { accion: 'quitar_2fa', id: ID_ADMIN }]) {
      expect((await ejecutar(m, c)).status).toBe(409)
    }
    expect(escrituras(m)).toHaveLength(0)
    expect(m.bitacora).toHaveLength(0)
  })
  it('no deja al sistema sin administrador activo (defensa extra: el actor ya está bloqueado pero su token aún vale)', async () => {
    const m = mundo()
    m.usuarios[0]!.banned_until = new Date(Date.now() + 1e9).toISOString()
    expect((await ejecutar(m, { accion: 'desactivar', id: ID_ADMIN2 })).status).toBe(409)
    expect((await ejecutar(m, { accion: 'cambiar_rol', id: ID_ADMIN2, rol: 'asesor' })).status).toBe(409)
    expect(m.bitacora).toHaveLength(0)
    expect(escrituras(m)).toHaveLength(0)
  })
  it('con dos admins activos sí se puede desactivar a uno', async () => {
    const m = mundo()
    expect((await ejecutar(m, { accion: 'desactivar', id: ID_ADMIN2 })).status).toBe(200)
    expect(escrituras(m)[0]?.cuerpo).toEqual({ ban_duration: '876000h' })
    expect(m.bitacora[0]).toMatchObject({ accion: 'usuario_desactiva' })
    expect((await ejecutar(m, { accion: 'reactivar', id: ID_ADMIN2 })).status).toBe(200)
    expect(m.usuarios[1]!.banned_until).toBeNull()
  })
  it('404 si el usuario no existe y 400 si el id no es válido', async () => {
    const m = mundo()
    expect((await ejecutar(m, { accion: 'desactivar', id: '99999999-9999-9999-9999-999999999999' })).status).toBe(404)
    expect((await ejecutar(m, { accion: 'desactivar', id: '../../etc' })).status).toBe(400)
    expect((await ejecutar(m, { accion: 'desactivar' })).status).toBe(400)
  })
})

describe('gestionar-usuarios · clave y 2FA', () => {
  it('restablecer clave entrega una nueva clave temporal y marca el cambio obligatorio', async () => {
    const m = mundo()
    const r = await ejecutar(m, { accion: 'restablecer_clave', id: ID_ASESOR }, ENTORNO, 'Otra-Clave-Nueva9#')
    const j = (await r.json()) as { claveTemporal: string }
    expect(j.claveTemporal).toBe('Otra-Clave-Nueva9#')
    expect(m.usuarios[2]!.user_metadata).toEqual({ debe_cambiar_clave: true, otro: 1 })
    expect(JSON.stringify(m.bitacora)).not.toContain('Otra-Clave')
    expect(m.bitacora[0]).toMatchObject({ accion: 'usuario_restablece_clave' })
  })
  it('quitar 2FA borra los factores y se registra; sin factores responde 409', async () => {
    const m = mundo()
    m.usuarios[2]!.factors = [{ id: 'fa', status: 'verified' }, { id: 'fb', status: 'unverified' }]
    const r = await ejecutar(m, { accion: 'quitar_2fa', id: ID_ASESOR })
    expect(r.status).toBe(200)
    expect(m.usuarios[2]!.factors).toEqual([])
    expect(m.bitacora[0]).toMatchObject({ accion: 'usuario_quita_2fa', detalle: { objetivo_id: ID_ASESOR, factores: 2 } })
    expect((await ejecutar(m, { accion: 'quitar_2fa', id: ID_ASESOR })).status).toBe(409)
  })
})

describe('contraseñas temporales', () => {
  it('cumplen la política, son distintas y evitan caracteres ambiguos', () => {
    const vistas = new Set<string>()
    for (let i = 0; i < 200; i += 1) {
      const c = generarClaveTemporal()
      expect(c).toHaveLength(20)
      expect(validarClave(c)).toBeNull()
      expect(c).not.toMatch(/[0OlI1]/)
      vistas.add(c)
    }
    expect(vistas.size).toBe(200)
  })
  it('validarClave explica qué falta', () => {
    expect(validarClave('corta1A!')).toMatch(/12/)
    expect(validarClave('sinmayusculas1!!')).toMatch(/mayúscula/)
    expect(validarClave('SINMINUSCULAS1!!')).toMatch(/minúscula/)
    expect(validarClave('SinNumeroAqui!!')).toMatch(/número/)
    expect(validarClave('SinSimbolo1234AA')).toMatch(/símbolo/)
    expect(() => generarClaveTemporal(8)).toThrow()
  })
})
