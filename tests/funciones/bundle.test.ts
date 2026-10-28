import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FUNCIONES, opciones } from '../../scripts/funciones.config.mjs'

const RAIZ = new URL('../../', import.meta.url)

describe('Edge Function empaquetada', () => {
  it('el archivo versionado está al día con el código fuente', async () => {
    for (const f of FUNCIONES) {
      const generado = await build({ ...opciones(f, false), absWorkingDir: fileURLToPath(RAIZ) })
      const esperado = generado.outputFiles?.[0]?.text
      // Git en Windows puede convertir los finales de línea al descargar: se comparan normalizados
      const actual = readFileSync(new URL(f.salida, RAIZ), 'utf-8').replace(/\r\n/g, '\n')
      expect(actual, `${f.salida} está desactualizado: ejecutar npm run build:functions`).toBe(esperado)
    }
  })

  it('es autocontenido: sin imports que el CLI de Supabase no pueda resolver', () => {
    for (const f of FUNCIONES) {
      const codigo = readFileSync(new URL(f.salida, RAIZ), 'utf-8')
      expect(codigo).not.toMatch(/^\s*import\s/m)
      expect(codigo).not.toMatch(/from\s+["'](\.|\/|npm:|jsr:)/)
    }
  })

  describe('ejecución con un Deno simulado', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.resetModules()
    })

    async function arrancar(env: Record<string, string>) {
      let manejador: ((req: Request) => Response | Promise<Response>) | undefined
      vi.stubGlobal('Deno', {
        env: { get: (k: string) => env[k] },
        serve: (h: typeof manejador) => {
          manejador = h
        },
      })
      await import(/* @vite-ignore */ new URL('supabase/functions/cargar-datos/index.ts', RAIZ).href + `?t=${Math.random()}`)
      if (manejador === undefined) throw new Error('La función no registró un manejador')
      return manejador
    }

    it('registra el manejador y responde 500 si falta configuración', async () => {
      const m = await arrancar({})
      const r = await m(new Request('https://x.test/', { method: 'POST' }))
      expect(r.status).toBe(500)
    })

    it('con configuración completa exige sesión', async () => {
      const m = await arrancar({
        SUPABASE_URL: 'https://ejemplo.supabase.co',
        SUPABASE_ANON_KEY: 'a',
        SUPABASE_SERVICE_ROLE_KEY: 's',
      })
      const r = await m(new Request('https://x.test/', { method: 'POST', body: '{}' }))
      expect(r.status).toBe(401)
    })
  })
})
