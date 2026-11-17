import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

const RAIZ = new URL('../../', import.meta.url)
const SALIDA = 'supabase/functions/gestionar-usuarios/index.ts'

describe('gestionar-usuarios empaquetada', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('es autocontenida y no lleva llaves', () => {
    const codigo = readFileSync(new URL(SALIDA, RAIZ), 'utf-8')
    expect(codigo).not.toMatch(/^\s*import\s/m)
    expect(codigo).not.toMatch(/from\s+["'](\.|\/|npm:|jsr:)/)
    expect(codigo).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}|sb_secret_/)
  })

  async function arrancar(env: Record<string, string>) {
    let manejador: ((req: Request) => Response | Promise<Response>) | undefined
    vi.stubGlobal('Deno', { env: { get: (k: string) => env[k] }, serve: (h: typeof manejador) => { manejador = h } })
    await import(/* @vite-ignore */ new URL(SALIDA, RAIZ).href + `?t=${Math.random()}`)
    if (manejador === undefined) throw new Error('La función no registró un manejador')
    return manejador
  }

  it('responde 500 si falta configuración y 401 sin sesión', async () => {
    expect((await (await arrancar({}))(new Request('https://x.test/', { method: 'POST' }))).status).toBe(500)
    const m = await arrancar({ SUPABASE_URL: 'https://ejemplo.supabase.co', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' })
    expect((await m(new Request('https://x.test/', { method: 'POST', body: '{}' }))).status).toBe(401)
  })
})
