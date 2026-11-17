import type { SupabaseClient } from '@supabase/supabase-js'

export type Rol = 'admin' | 'asesor'

export interface UsuarioListado {
  id: string
  correo: string
  rol: Rol | null
  activo: boolean
  creadoEn: string | null
  ultimoAcceso: string | null
  /** null = no se pudo saber. */
  tiene2fa: boolean | null
}

export type CuerpoUsuarios =
  | { accion: 'listar' }
  | { accion: 'crear'; correo: string; rol: Rol }
  | { accion: 'cambiar_rol'; id: string; rol: Rol }
  | { accion: 'desactivar' | 'reactivar' | 'restablecer_clave' | 'quitar_2fa'; id: string }

export interface RespuestaUsuarios {
  ok: true
  usuarios?: UsuarioListado[]
  usuario?: UsuarioListado
  claveTemporal?: string
}

const SIN_CONEXION = 'No se pudo comunicar con el servidor de usuarios. Revise su conexión e intente de nuevo.'

/** Mensaje para el admin cuando la función no respondió con un error propio (no existe, CORS, caída). */
function mensajeTecnico(error: unknown, estado: number | null): string {
  const nombre = (error as { name?: unknown } | null)?.name
  if (estado === 404) return 'La función «gestionar-usuarios» no está desplegada en Supabase. Despliéguela con el comando de la guía y vuelva a intentar.'
  if (estado === 401 || estado === 403) return 'Supabase rechazó la llamada antes de llegar a la función. Despliéguela con --no-verify-jwt y revise que su sesión siga activa.'
  if (estado !== null && estado >= 500) return `La función falló (código ${estado}). Revise sus registros en el panel de Supabase.`
  if (nombre === 'FunctionsFetchError') {
    return 'El navegador no pudo llegar a la función. Lo más probable es que falte el secreto ALLOWED_ORIGIN (debe ser la dirección del sitio, p. ej. https://infivalle.github.io) o que la función no esté desplegada.'
  }
  return SIN_CONEXION
}

/** Llama a la Edge Function `gestionar-usuarios` con la sesión del admin y traduce los errores a un mensaje. */
export async function llamarUsuarios(cliente: SupabaseClient, cuerpo: CuerpoUsuarios): Promise<RespuestaUsuarios> {
  const { data, error } = await cliente.functions.invoke('gestionar-usuarios', { body: cuerpo })
  if (error !== null) {
    const contexto = (error as { context?: unknown }).context
    if (contexto instanceof Response) {
      let propio: string | null = null
      try {
        const j = (await contexto.clone().json()) as { error?: unknown; codigo?: unknown }
        if (j.codigo === 'requiere_aal2') propio = 'Para gestionar usuarios debe iniciar sesión con su segundo factor.'
        else if (typeof j.error === 'string') propio = j.error
      } catch {
        propio = null
      }
      // La función siempre responde { ok: false, error }: si no viene, la respuesta no es suya (puerta de enlace).
      throw new Error(propio ?? mensajeTecnico(error, contexto.status))
    }
    throw new Error(mensajeTecnico(error, null))
  }
  const r = data as { ok?: unknown } | null
  if (r === null || r.ok !== true) throw new Error('Respuesta inesperada del servidor.')
  return data as RespuestaUsuarios
}
