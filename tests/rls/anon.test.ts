import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

/**
 * Punto de control de F0: la llave "anon" no puede leer ni escribir ninguna tabla.
 *
 * Se ejecuta contra el proyecto Supabase real y se OMITE si no hay variables:
 *   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=eyJ... npm run test:rls
 *
 * Solo usa la llave anon (pública). Nunca pasar service_role ni la clave de la base.
 */
const url = process.env['SUPABASE_URL']
const anon = process.env['SUPABASE_ANON_KEY']

const TABLAS = [
  'proyectos',
  'denominadores',
  'beneficiarios',
  'beneficiarios_proyecto',
  'asesorias',
  'asesoria_mejoras',
  'asesoria_canales',
  'cargas',
  'bitacora',
] as const

describe.skipIf(!url || !anon)('RLS: la llave anon no accede a nada', () => {
  const cliente = createClient(url ?? 'http://localhost', anon ?? 'x', {
    auth: { persistSession: false },
  })

  for (const tabla of TABLAS) {
    it(`${tabla}: lectura sin filas`, async () => {
      const { data, error } = await cliente.from(tabla).select('*').limit(1)
      // O bien error de permisos, o bien lista vacía: nunca datos.
      if (error === null) expect(data).toEqual([])
      else expect(data).toBeNull()
    })

    it(`${tabla}: escritura rechazada`, async () => {
      const { error } = await cliente.from(tabla).insert({}).select()
      expect(error).not.toBeNull()
    })
  }
})
