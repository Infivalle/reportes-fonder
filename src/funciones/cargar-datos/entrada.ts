import { manejarCarga, type EntornoCarga } from './manejador.ts'

/**
 * Punto de entrada de la Edge Function (Deno). Es solo pegamento: la lógica está en
 * manejador.ts. Este archivo se empaqueta junto con src/limpieza en
 * supabase/functions/cargar-datos/index.ts (npm run build:functions).
 *
 * Secretos que Supabase inyecta solo: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 * Secretos que se configuran a mano (opcionales): GITHUB_DISPATCH_TOKEN, GITHUB_REPO, ALLOWED_ORIGIN.
 */
declare const Deno: {
  env: { get(nombre: string): string | undefined }
  serve(manejador: (req: Request) => Response | Promise<Response>): unknown
}

function leerEntorno(): EntornoCarga | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) return null
  return {
    supabaseUrl,
    anonKey,
    serviceKey,
    githubToken: Deno.env.get('GITHUB_DISPATCH_TOKEN') || undefined,
    githubRepo: Deno.env.get('GITHUB_REPO') || undefined,
    origenPermitido: Deno.env.get('ALLOWED_ORIGIN') || undefined,
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
  return manejarCarga(req, { entorno, fetch: (...args) => fetch(...args) })
})
