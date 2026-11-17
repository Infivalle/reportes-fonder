import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { rolDe, type Rol } from './rol'

export interface UsuarioSesion {
  id: string
  correo: string
  /** null = tiene cuenta pero sin rol asignado. */
  rol: Rol | null
  /** Entró con una contraseña temporal y debe elegir la suya. Es solo una guía de pantalla (user_metadata lo puede cambiar el propio usuario). */
  debeCambiarClave: boolean
}

export type EstadoSesion = { estado: 'cargando' } | { estado: 'sin_sesion' } | { estado: 'activa'; usuario: UsuarioSesion }

/** Sesión de Supabase Auth: se restaura al abrir y se mantiene al día con los cambios (entrar, salir, renovar). */
export function useSesion(cliente: SupabaseClient | null): EstadoSesion {
  const [sesion, setSesion] = useState<EstadoSesion>(cliente === null ? { estado: 'sin_sesion' } : { estado: 'cargando' })

  useEffect(() => {
    if (cliente === null) return
    let vivo = true
    const aplicar = (
      u: { id: string; email?: string | undefined; app_metadata?: Record<string, unknown> | undefined; user_metadata?: Record<string, unknown> | undefined } | null,
    ) => {
      if (!vivo) return
      setSesion(u === null ? { estado: 'sin_sesion' } : { estado: 'activa', usuario: { id: u.id, correo: u.email ?? '', rol: rolDe(u), debeCambiarClave: u.user_metadata?.['debe_cambiar_clave'] === true } })
    }
    void cliente.auth.getSession().then(({ data }) => aplicar(data.session?.user ?? null))
    const { data: suscripcion } = cliente.auth.onAuthStateChange((_evento, s) => aplicar(s?.user ?? null))
    return () => {
      vivo = false
      suscripcion.subscription.unsubscribe()
    }
  }, [cliente])

  return sesion
}
