import { manejarUsuarios, type EntornoUsuarios } from './manejador.ts'

/**
 * Punto de entrada de la Edge Function (Deno). Solo pegamento: la lógica está en manejador.ts.
 * Se empaqueta en supabase/functions/gestionar-usuarios/index.ts (npm run build:functions).
 *
 * Secretos que Supabase inyecta solo: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 * Secretos que se configuran a mano:
 *   ALLOWED_ORIGIN  origen del sitio (p. ej. https://infivalle.github.io): sin él el navegador no puede llamar.
 *   EXIGIR_AAL2     "true" cuando el 2FA ya esté en marcha: exige segundo factor a quien llama.
 */
declare const Deno: {
  env: { get(nombre: string): string | undefined }
  serve(manejador: (req: Request) => Response | Promise<Response>): unknown
}

function leerEntorno(): EntornoUsuarios | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) return null
  return {
    supabaseUrl,
    anonKey,
    serviceKey,
    origenPermitido: Deno.env.get('ALLOWED_ORIGIN') || undefined,
    exigirAal2: Deno.env.get('EXIGIR_AAL2') === 'true',
  }
}

Deno.serve((req) => {
  const entorno = leerEntorno()
  if (entorno === null) {
    return new Response(JSON.stringify({ ok: false, error: 'Configuración incompleta' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return manejarUsuarios(req, { entorno, fetch: (...args) => fetch(...args) })
})
