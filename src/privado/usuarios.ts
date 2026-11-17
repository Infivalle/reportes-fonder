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

/** Llama a la Edge Function `gestionar-usuarios` con la sesión del admin y traduce los errores a un mensaje. */
export async function llamarUsuarios(cliente: SupabaseClient, cuerpo: CuerpoUsuarios): Promise<RespuestaUsuarios> {
  const { data, error } = await cliente.functions.invoke('gestionar-usuarios', { body: cuerpo })
  if (error !== null) {
    const contexto = (error as { context?: unknown }).context
    if (contexto instanceof Response) {
      try {
        const j = (await contexto.json()) as { error?: unknown; codigo?: unknown }
        if (j.codigo === 'requiere_aal2') throw new Error('Para gestionar usuarios debe iniciar sesión con su segundo factor.')
        if (typeof j.error === 'string') throw new Error(j.error)
      } catch (e) {
        if (e instanceof Error && e.message !== '' && !(e instanceof SyntaxError)) throw e
      }
    }
    throw new Error(SIN_CONEXION)
  }
  const r = data as { ok?: unknown } | null
  if (r === null || r.ok !== true) throw new Error('Respuesta inesperada del servidor.')
  return data as RespuestaUsuarios
}
