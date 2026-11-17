export type Rol = 'admin' | 'asesor'

/**
 * Rol de un usuario de Supabase, leído de `app_metadata` (solo el servidor lo puede escribir).
 * Nunca de `user_metadata`, que el propio usuario puede modificar. Es solo para la interfaz: lo que
 * de verdad protege los datos son las políticas RLS de la base.
 */
export function rolDe(usuario: { app_metadata?: Record<string, unknown> | undefined } | null | undefined): Rol | null {
  const rol = usuario?.app_metadata?.['rol']
  return rol === 'admin' || rol === 'asesor' ? rol : null
}
