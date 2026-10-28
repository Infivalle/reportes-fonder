import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { manejarCarga, type EntornoCarga } from '../../src/funciones/cargar-datos/manejador.ts'

const TSV = readFileSync(new URL('../fixtures/asesorias_v1_sintetico.tsv', import.meta.url), 'utf-8')
const TSV_ROTO = readFileSync(new URL('../fixtures/asesorias_v1_linea_rota.tsv', import.meta.url), 'utf-8')

const URL_SB = 'https://ejemplo.supabase.co'
const ENTORNO: EntornoCarga = {
  supabaseUrl: URL_SB,
  anonKey: 'anon-de-prueba',
  serviceKey: 'service-de-prueba',
  githubToken: 'ghp_de_prueba',
  githubRepo: 'infivalle/reportes-fonder',
  origenPermitido: 'https://infivalle.github.io',
}

interface Llamada {
  url: string
  init: RequestInit | undefined
}

interface Opciones {
  usuario?: { id: string; app_metadata: { rol?: string } } | null
  rpc?: { ok: boolean; cuerpo: unknown }
  github?: { ok: boolean } | 'lanza'
}

/** fetch simulado: enruta por URL y registra las llamadas. */
function falso(opts: Opciones = {}) {
  const llamadas: Llamada[] = []
  const usuario = opts.usuario === undefined ? { id: 'uid-admin', app_metadata: { rol: 'admin' } } : opts.usuario
  const rpc = opts.rpc ?? { ok: true, cuerpo: 7 }
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    llamadas.push({ url, init })
    if (url.endsWith('/auth/v1/user')) {
      return usuario === null
        ? new Response('{}', { status: 401 })
        : new Response(JSON.stringify(usuario), { status: 200 })
    }
    if (url.includes('/rest/v1/rpc/reemplazar_datos')) {
      return new Response(JSON.stringify(rpc.cuerpo), { status: rpc.ok ? 200 : 400 })
    }
    if (url.includes('api.github.com')) {
      if (opts.github === 'lanza') throw new Error('red caída')
      return new Response(null, { status: opts.github?.ok === false ? 403 : 204 })
    }
    throw new Error(`URL inesperada: ${url}`)
  }) as typeof fetch
  return { f, llamadas }
}

function peticion(cuerpo: unknown, opts: { auth?: string | null; metodo?: string; extra?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.extra }
  if (opts.auth !== null) headers['Authorization'] = opts.auth ?? 'Bearer token-de-prueba'
  const metodo = opts.metodo ?? 'POST'
  return new Request(`${URL_SB}/functions/v1/cargar-datos`, {
    method: metodo,
    headers,
    ...(metodo === 'POST' ? { body: JSON.stringify(cuerpo) } : {}),
  })
}

const rpcLlamadas = (l: Llamada[]) => l.filter((x) => x.url.includes('reemplazar_datos'))

describe('cargar-datos · acceso', () => {
  it('rechaza métodos distintos de POST', async () => {
    const { f } = falso()
    const r = await manejarCarga(peticion(null, { metodo: 'GET' }), { entorno: ENTORNO, fetch: f })
    expect(r.status).toBe(405)
  })

  it('responde al preflight CORS solo para el origen permitido', async () => {
    const { f } = falso()
    const ok = await manejarCarga(peticion(null, { metodo: 'OPTIONS', extra: { Origin: 'https://infivalle.github.io' } }), { entorno: ENTORNO, fetch: f })
    expect(ok.status).toBe(204)
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://infivalle.github.io')

    const otro = await manejarCarga(peticion(null, { metodo: 'OPTIONS', extra: { Origin: 'https://malo.example' } }), { entorno: ENTORNO, fetch: f })
    expect(otro.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('401 sin sesión', async () => {
    const { f, llamadas } = falso()
    const r = await manejarCarga(peticion({ contenido: TSV }, { auth: null }), { entorno: ENTORNO, fetch: f })
    expect(r.status).toBe(401)
    expect(llamadas).toHaveLength(0)
  })

  it('401 con token inválido', async () => {
    const { f } = falso({ usuario: null })
    const r = await manejarCarga(peticion({ contenido: TSV }), { entorno: ENTORNO, fetch: f })
    expect(r.status).toBe(401)
  })

  it('403 si el rol no es admin (asesor, sin rol)', async () => {
    for (const rol of ['asesor', undefined]) {
      const { f, llamadas } = falso({ usuario: { id: 'u1', app_metadata: rol ? { rol } : {} } })
      const r = await manejarCarga(peticion({ contenido: TSV, confirmar: true }), { entorno: ENTORNO, fetch: f })
      expect(r.status).toBe(403)
      expect(rpcLlamadas(llamadas)).toHaveLength(0)
    }
  })

  it('no acepta un rol que el usuario se haya puesto en user_metadata', async () => {
    const { f, llamadas } = falso({
      usuario: { id: 'u1', app_metadata: {}, user_metadata: { rol: 'admin' } } as never,
    })
    const r = await manejarCarga(peticion({ contenido: TSV, confirmar: true }), { entorno: ENTORNO, fetch: f })
    expect(r.status).toBe(403)
    expect(rpcLlamadas(llamadas)).toHaveLength(0)
  })

  it('verifica la sesión con la llave anon y el token del usuario', async () => {
    const { f, llamadas } = falso()
    await manejarCarga(peticion({ contenido: TSV }, { auth: 'Bearer abc123' }), { entorno: ENTORNO, fetch: f })
    const h = llamadas[0]?.init?.headers as Record<string, string>
    expect(h['Authorization']).toBe('Bearer abc123')
    expect(h['apikey']).toBe('anon-de-prueba')
  })
})

describe('cargar-datos · cuerpo y validación', () => {
  it('400 si falta el contenido o no es JSON', async () => {
    const { f } = falso()
    expect((await manejarCarga(peticion({}), { entorno: ENTORNO, fetch: f })).status).toBe(400)
    expect((await manejarCarga(peticion({ contenido: '' }), { entorno: ENTORNO, fetch: f })).status).toBe(400)
    const noJson = new Request(`${URL_SB}/x`, { method: 'POST', headers: { Authorization: 'Bearer t' }, body: 'no es json' })
    expect((await manejarCarga(noJson, { entorno: ENTORNO, fetch: f })).status).toBe(400)
  })

  it('413 si el archivo declara un tamaño excesivo', async () => {
    const { f } = falso()
    const r = await manejarCarga(peticion({ contenido: TSV }, { extra: { 'Content-Length': String(30 * 1024 * 1024) } }), { entorno: ENTORNO, fetch: f })
    expect(r.status).toBe(413)
  })

  it('422 con los errores si el TSV no es válido, y no toca la base', async () => {
    const { f, llamadas } = falso()
    const r = await manejarCarga(peticion({ contenido: TSV_ROTO, confirmar: true }), { entorno: ENTORNO, fetch: f })
    expect(r.status).toBe(422)
    const j = (await r.json()) as { ok: boolean; errores: string[] }
    expect(j.ok).toBe(false)
    expect(j.errores[0]).toContain('Línea 6')
    expect(rpcLlamadas(llamadas)).toHaveLength(0)
  })
})

describe('cargar-datos · carga', () => {
  it('sin confirmar solo devuelve el resumen y no escribe', async () => {
    const { f, llamadas } = falso()
    const r = await manejarCarga(peticion({ contenido: TSV }), { entorno: ENTORNO, fetch: f })
    expect(r.status).toBe(200)
    const j = (await r.json()) as { aplicado: boolean; resumen: { asesoriasConservadas: number; asesoriasDescartadas: number } }
    expect(j.aplicado).toBe(false)
    expect(j.resumen).toMatchObject({ asesoriasConservadas: 8, asesoriasDescartadas: 3 })
    expect(rpcLlamadas(llamadas)).toHaveLength(0)
  })

  it('con confirmar carga con la llave de servicio y avisa a GitHub', async () => {
    const { f, llamadas } = falso()
    const r = await manejarCarga(peticion({ archivo: 'asesorias.tsv', contenido: TSV, confirmar: true }), { entorno: ENTORNO, fetch: f })
    expect(r.status).toBe(200)
    const j = (await r.json()) as { aplicado: boolean; cargaId: number; dispatch: string }
    expect(j).toMatchObject({ aplicado: true, cargaId: 7, dispatch: 'enviado' })

    const rpc = rpcLlamadas(llamadas)
    expect(rpc).toHaveLength(1)
    const h = rpc[0]?.init?.headers as Record<string, string>
    expect(h['apikey']).toBe('service-de-prueba')
    const cuerpo = JSON.parse(String(rpc[0]?.init?.body)) as { p: { carga: { archivo: string; asesorias_conservadas: number }; asesorias: unknown[] }; p_usuario: string }
    expect(cuerpo.p_usuario).toBe('uid-admin')
    expect(cuerpo.p.carga).toMatchObject({ archivo: 'asesorias.tsv', asesorias_conservadas: 8 })
    expect(cuerpo.p.asesorias).toHaveLength(11)

    const gh = llamadas.find((l) => l.url.includes('api.github.com'))
    expect(gh?.url).toBe('https://api.github.com/repos/infivalle/reportes-fonder/dispatches')
    expect(JSON.parse(String(gh?.init?.body))).toEqual({ event_type: 'datos-actualizados' })
  })

  it('no envía la llave de servicio al navegador ni al log de respuesta', async () => {
    const { f } = falso()
    const r = await manejarCarga(peticion({ contenido: TSV, confirmar: true }), { entorno: ENTORNO, fetch: f })
    const texto = await r.text()
    expect(texto).not.toContain('service-de-prueba')
    expect(texto).not.toContain('ghp_de_prueba')
  })

  it('si la base rechaza la carga, responde 500 sin detalles internos y no avisa a GitHub', async () => {
    const { f, llamadas } = falso({ rpc: { ok: false, cuerpo: { message: 'detalle interno con datos de una fila' } } })
    const r = await manejarCarga(peticion({ contenido: TSV, confirmar: true }), { entorno: ENTORNO, fetch: f })
    expect(r.status).toBe(500)
    expect(await r.text()).not.toContain('detalle interno')
    expect(llamadas.some((l) => l.url.includes('api.github.com'))).toBe(false)
  })

  it('omite el aviso si no hay token de GitHub', async () => {
    const { f, llamadas } = falso()
    const entorno = { ...ENTORNO, githubToken: undefined }
    const r = await manejarCarga(peticion({ contenido: TSV, confirmar: true }), { entorno, fetch: f })
    expect(((await r.json()) as { dispatch: string }).dispatch).toBe('omitido')
    expect(llamadas.some((l) => l.url.includes('api.github.com'))).toBe(false)
  })

  it('si falla el aviso a GitHub, la carga igual queda aplicada', async () => {
    for (const github of [{ ok: false }, 'lanza'] as const) {
      const { f } = falso({ github })
      const r = await manejarCarga(peticion({ contenido: TSV, confirmar: true }), { entorno: ENTORNO, fetch: f })
      expect(r.status).toBe(200)
      expect(await r.json()).toMatchObject({ aplicado: true, dispatch: 'fallo' })
    }
  })
})
