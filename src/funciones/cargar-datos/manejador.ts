import { construirPayloadDb, limpiarTsv } from '../../limpieza/index.ts'

/**
 * Lógica de la Edge Function `cargar-datos`, sin depender de Deno: recibe la petición y
 * sus dependencias, y devuelve la respuesta. Así se prueba en Node con un fetch simulado.
 *
 * Flujo:
 *  1. Comprueba que quien llama es admin (rol en app_metadata del token).
 *  2. Valida y limpia el TSV (la misma lógica que la vista previa del navegador).
 *  3. Sin `confirmar: true` solo devuelve el resumen (no toca la base).
 *  4. Con `confirmar: true` reemplaza los datos en una transacción (función SQL
 *     `reemplazar_datos`) y avisa a GitHub para regenerar la capa pública.
 */

export interface EntornoCarga {
  supabaseUrl: string
  /** Llave pública (anon). Sirve para consultar quién es el usuario del token. */
  anonKey: string
  /** Llave service_role: solo vive en la función. */
  serviceKey: string
  /** Token de GitHub con permiso para disparar el workflow (opcional). */
  githubToken?: string | undefined
  /** "dueño/repositorio" (opcional). */
  githubRepo?: string | undefined
  /** Origen permitido para CORS (por defecto, ninguno: solo llamadas sin navegador). */
  origenPermitido?: string | undefined
}

export interface DepsCarga {
  entorno: EntornoCarga
  fetch: typeof fetch
}

const MAX_BYTES = 25 * 1024 * 1024

function cabeceras(entorno: EntornoCarga, req: Request): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const origen = req.headers.get('Origin')
  if (origen !== null && entorno.origenPermitido !== undefined && origen === entorno.origenPermitido) {
    h['Access-Control-Allow-Origin'] = origen
    h['Access-Control-Allow-Headers'] = 'authorization, content-type, apikey'
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    h['Vary'] = 'Origin'
  }
  return h
}

export async function manejarCarga(req: Request, deps: DepsCarga): Promise<Response> {
  const { entorno } = deps
  const headers = cabeceras(entorno, req)
  const responder = (estado: number, cuerpo: unknown) =>
    new Response(JSON.stringify(cuerpo), { status: estado, headers })

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return responder(405, { ok: false, error: 'Método no permitido' })

  // 1. ¿Quién llama? Se pregunta a Supabase Auth con el propio token del usuario.
  const autorizacion = req.headers.get('Authorization')
  if (autorizacion === null || !/^Bearer\s+\S+/i.test(autorizacion)) {
    return responder(401, { ok: false, error: 'Falta la sesión' })
  }

  let usuario: { id?: string; app_metadata?: { rol?: string } }
  try {
    const r = await deps.fetch(`${entorno.supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: autorizacion, apikey: entorno.anonKey },
    })
    if (!r.ok) return responder(401, { ok: false, error: 'Sesión inválida o vencida' })
    usuario = (await r.json()) as typeof usuario
  } catch {
    return responder(502, { ok: false, error: 'No se pudo verificar la sesión' })
  }

  // El rol solo se lee de app_metadata (lo escribe el servidor), nunca de user_metadata.
  if (usuario.app_metadata?.rol !== 'admin' || typeof usuario.id !== 'string') {
    return responder(403, { ok: false, error: 'Solo un administrador puede cargar datos' })
  }

  // 2. Cuerpo
  const largo = Number(req.headers.get('Content-Length') ?? '0')
  if (largo > MAX_BYTES) return responder(413, { ok: false, error: 'El archivo es demasiado grande' })

  let cuerpo: { archivo?: unknown; contenido?: unknown; confirmar?: unknown }
  try {
    cuerpo = (await req.json()) as typeof cuerpo
  } catch {
    return responder(400, { ok: false, error: 'El cuerpo debe ser JSON' })
  }
  if (typeof cuerpo.contenido !== 'string' || cuerpo.contenido.length === 0) {
    return responder(400, { ok: false, error: 'Falta el contenido del TSV' })
  }
  if (cuerpo.contenido.length > MAX_BYTES) {
    return responder(413, { ok: false, error: 'El archivo es demasiado grande' })
  }
  const archivo = typeof cuerpo.archivo === 'string' && cuerpo.archivo !== '' ? cuerpo.archivo.slice(0, 200) : 'asesorias.tsv'

  // 3. Validación y limpieza (se repite aquí: no se confía en el navegador)
  const limpieza = limpiarTsv(cuerpo.contenido)
  if (!limpieza.ok) return responder(422, { ok: false, errores: limpieza.errores })

  const { resumen } = limpieza.resultado
  if (cuerpo.confirmar !== true) {
    return responder(200, { ok: true, aplicado: false, resumen })
  }

  // 4. Carga atómica
  let cargaId: number
  try {
    const payload = construirPayloadDb(limpieza.resultado, archivo)
    const r = await deps.fetch(`${entorno.supabaseUrl}/rest/v1/rpc/reemplazar_datos`, {
      method: 'POST',
      headers: {
        apikey: entorno.serviceKey,
        Authorization: `Bearer ${entorno.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p: payload, p_usuario: usuario.id }),
    })
    if (!r.ok) {
      // El detalle puede traer datos de la fila que falló: va al registro de la función, no al cliente.
      console.error('reemplazar_datos falló', r.status, await r.text())
      return responder(500, { ok: false, error: 'La base de datos rechazó la carga; no se cambió nada' })
    }
    cargaId = Number(await r.json())
  } catch {
    return responder(502, { ok: false, error: 'No se pudo completar la carga; no se cambió nada' })
  }

  // 5. Regenerar la capa pública (si falla, los datos ya están cargados: la tarea diaria lo recupera)
  let dispatch: 'enviado' | 'omitido' | 'fallo' = 'omitido'
  if (entorno.githubToken !== undefined && entorno.githubRepo !== undefined) {
    try {
      const r = await deps.fetch(`https://api.github.com/repos/${entorno.githubRepo}/dispatches`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${entorno.githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'fonder-cargar-datos',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_type: 'datos-actualizados' }),
      })
      dispatch = r.ok ? 'enviado' : 'fallo'
    } catch {
      dispatch = 'fallo'
    }
  }

  return responder(200, { ok: true, aplicado: true, cargaId, resumen, dispatch })
}
