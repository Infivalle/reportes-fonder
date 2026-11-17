import { generarClaveTemporal } from './clave.ts'

/**
 * Lógica de la Edge Function `gestionar-usuarios`, sin depender de Deno (como `cargar-datos`):
 * recibe la petición y sus dependencias y devuelve la respuesta.
 *
 * Quién puede llamar: solo un admin (rol en app_metadata del token). Si el secreto EXIGIR_AAL2
 * vale "true", además debe haber pasado el segundo factor (aal2).
 *
 * Acciones (cuerpo JSON `{ accion, ... }`):
 *  - listar
 *  - crear              { correo, rol }     → devuelve una contraseña temporal, una sola vez
 *  - cambiar_rol        { id, rol }
 *  - desactivar         { id }              (no se borran usuarios: la bitácora depende de ellos)
 *  - reactivar          { id }
 *  - restablecer_clave  { id }              → devuelve una contraseña temporal, una sola vez
 *  - quitar_2fa         { id }              (para quien perdió su celular)
 *
 * Cada acción que cambia algo se registra en la bitácora ANTES de ejecutarse; si el registro
 * falla, no se hace nada. No se puede actuar sobre la propia cuenta ni dejar al sistema sin admin.
 */

export interface EntornoUsuarios {
  supabaseUrl: string
  /** Llave pública (anon): sirve para preguntar quién es el usuario del token. */
  anonKey: string
  /** Llave service_role: solo vive en la función. */
  serviceKey: string
  origenPermitido?: string | undefined
  /** Exige que la sesión de quien llama haya pasado el segundo factor. */
  exigirAal2?: boolean | undefined
}

export interface DepsUsuarios {
  entorno: EntornoUsuarios
  fetch: typeof fetch
  /** Contraseñas temporales (inyectable para probar). */
  generarClave?: (() => string) | undefined
}

export type Rol = 'admin' | 'asesor'

export interface UsuarioListado {
  id: string
  correo: string
  rol: Rol | null
  activo: boolean
  creadoEn: string | null
  ultimoAcceso: string | null
  /** null = la API no informó los factores. */
  tiene2fa: boolean | null
}

interface UsuarioAuth {
  id?: string
  email?: string
  created_at?: string
  last_sign_in_at?: string | null
  banned_until?: string | null
  app_metadata?: { rol?: unknown } & Record<string, unknown>
  user_metadata?: Record<string, unknown>
  factors?: { id?: string; status?: string }[] | null
}

const MAX_CUERPO = 10 * 1024
const BLOQUEO = '876000h' // ≈ 100 años: Auth no tiene "desactivar" y el bloqueo impide iniciar sesión y renovar
const RE_CORREO = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/
const RE_ID = /^[0-9a-fA-F-]{36}$/

function cabeceras(entorno: EntornoUsuarios, req: Request): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  const origen = req.headers.get('Origin')
  if (origen !== null && entorno.origenPermitido !== undefined && origen === entorno.origenPermitido) {
    h['Access-Control-Allow-Origin'] = origen
    h['Access-Control-Allow-Headers'] = 'authorization, content-type, apikey, x-client-info'
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    h['Vary'] = 'Origin'
  }
  return h
}

/** Nivel de autenticación (`aal`) del JWT. El token ya fue validado por Auth; aquí solo se lee. */
export function leerAal(autorizacion: string): string {
  try {
    const token = autorizacion.replace(/^Bearer\s+/i, '')
    const carga = token.split('.')[1]
    if (carga === undefined) return ''
    const json = atob(carga.replace(/-/g, '+').replace(/_/g, '/'))
    const o = JSON.parse(json) as { aal?: unknown }
    return typeof o.aal === 'string' ? o.aal : ''
  } catch {
    return ''
  }
}

function rolDe(u: UsuarioAuth): Rol | null {
  const r = u.app_metadata?.rol
  return r === 'admin' || r === 'asesor' ? r : null
}

function estaActivo(u: UsuarioAuth, ahora: number): boolean {
  if (u.banned_until === null || u.banned_until === undefined) return true
  const t = Date.parse(u.banned_until)
  return Number.isNaN(t) || t <= ahora
}

function aListado(u: UsuarioAuth, ahora: number): UsuarioListado {
  return {
    id: u.id ?? '',
    correo: u.email ?? '',
    rol: rolDe(u),
    activo: estaActivo(u, ahora),
    creadoEn: u.created_at ?? null,
    ultimoAcceso: u.last_sign_in_at ?? null,
    tiene2fa: Array.isArray(u.factors) ? u.factors.some((f) => f.status === 'verified') : null,
  }
}

class ErrorHttp extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje)
  }
}

export async function manejarUsuarios(req: Request, deps: DepsUsuarios): Promise<Response> {
  const { entorno } = deps
  const headers = cabeceras(entorno, req)
  const responder = (estado: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: estado, headers })
  const generarClave = deps.generarClave ?? generarClaveTemporal

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return responder(405, { ok: false, error: 'Método no permitido' })

  // 1. ¿Quién llama?
  const autorizacion = req.headers.get('Authorization')
  if (autorizacion === null || !/^Bearer\s+\S+/i.test(autorizacion)) return responder(401, { ok: false, error: 'Falta la sesión' })

  let yo: UsuarioAuth
  try {
    const r = await deps.fetch(`${entorno.supabaseUrl}/auth/v1/user`, { headers: { Authorization: autorizacion, apikey: entorno.anonKey } })
    if (!r.ok) return responder(401, { ok: false, error: 'Sesión inválida o vencida' })
    yo = (await r.json()) as UsuarioAuth
  } catch {
    return responder(502, { ok: false, error: 'No se pudo verificar la sesión' })
  }
  if (rolDe(yo) !== 'admin' || typeof yo.id !== 'string') {
    return responder(403, { ok: false, error: 'Solo un administrador puede gestionar usuarios' })
  }
  if (entorno.exigirAal2 === true && leerAal(autorizacion) !== 'aal2') {
    return responder(403, { ok: false, error: 'Falta el segundo factor de autenticación', codigo: 'requiere_aal2' })
  }
  const yoId = yo.id

  // 2. Cuerpo
  if (Number(req.headers.get('Content-Length') ?? '0') > MAX_CUERPO) return responder(413, { ok: false, error: 'Solicitud demasiado grande' })
  let cuerpo: Record<string, unknown>
  try {
    const texto = await req.text()
    if (texto.length > MAX_CUERPO) return responder(413, { ok: false, error: 'Solicitud demasiado grande' })
    const j: unknown = JSON.parse(texto)
    if (j === null || typeof j !== 'object' || Array.isArray(j)) throw new Error('no es objeto')
    cuerpo = j as Record<string, unknown>
  } catch {
    return responder(400, { ok: false, error: 'El cuerpo debe ser un objeto JSON' })
  }

  // --- Llamadas a Auth con la llave de servicio
  const auth = async (metodo: string, ruta: string, datos?: unknown): Promise<{ estado: number; cuerpo: unknown }> => {
    const r = await deps.fetch(`${entorno.supabaseUrl}/auth/v1${ruta}`, {
      method: metodo,
      headers: { apikey: entorno.serviceKey, Authorization: `Bearer ${entorno.serviceKey}`, 'Content-Type': 'application/json' },
      ...(datos === undefined ? {} : { body: JSON.stringify(datos) }),
    })
    const texto = await r.text()
    let c: unknown
    try {
      c = texto === '' ? null : JSON.parse(texto)
    } catch {
      c = null
    }
    return { estado: r.status, cuerpo: c }
  }

  const todos = async (): Promise<UsuarioAuth[]> => {
    const lista: UsuarioAuth[] = []
    for (let pagina = 1; pagina <= 50; pagina += 1) {
      const r = await auth('GET', `/admin/users?page=${pagina}&per_page=200`)
      if (r.estado !== 200) throw new ErrorHttp(502, 'No se pudo leer la lista de usuarios')
      const usuarios = ((r.cuerpo as { users?: UsuarioAuth[] } | null)?.users ?? []) as UsuarioAuth[]
      lista.push(...usuarios)
      if (usuarios.length < 200) break
    }
    return lista
  }

  const uno = async (id: string): Promise<UsuarioAuth> => {
    const r = await auth('GET', `/admin/users/${id}`)
    if (r.estado === 404) throw new ErrorHttp(404, 'El usuario no existe')
    if (r.estado !== 200 || r.cuerpo === null) throw new ErrorHttp(502, 'No se pudo leer el usuario')
    return r.cuerpo as UsuarioAuth
  }

  const bitacora = async (accion: string, detalle: Record<string, string | number | boolean | null>): Promise<void> => {
    let r: Response
    try {
      r = await deps.fetch(`${entorno.supabaseUrl}/rest/v1/bitacora`, {
        method: 'POST',
        headers: { apikey: entorno.serviceKey, Authorization: `Bearer ${entorno.serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ usuario_id: yoId, accion, detalle }),
      })
    } catch {
      throw new ErrorHttp(500, 'No se pudo registrar la acción en la bitácora; no se hizo ningún cambio')
    }
    if (!r.ok) {
      console.error('bitacora falló', r.status, await r.text())
      throw new ErrorHttp(500, 'No se pudo registrar la acción en la bitácora; no se hizo ningún cambio')
    }
  }

  const idObjetivo = (): string => {
    const id = cuerpo['id']
    if (typeof id !== 'string' || !RE_ID.test(id)) throw new ErrorHttp(400, 'Falta el identificador del usuario')
    if (id === yoId) throw new ErrorHttp(409, 'No puede hacer este cambio sobre su propia cuenta')
    return id
  }
  const rolPedido = (): Rol => {
    const r = cuerpo['rol']
    if (r !== 'admin' && r !== 'asesor') throw new ErrorHttp(400, 'El rol debe ser admin o asesor')
    return r
  }
  /** Quitar el último admin activo dejaría el sistema sin quien lo gestione. */
  const protegerUltimoAdmin = async (objetivo: UsuarioAuth): Promise<void> => {
    if (rolDe(objetivo) !== 'admin' || !estaActivo(objetivo, Date.now())) return
    const activos = (await todos()).filter((u) => rolDe(u) === 'admin' && estaActivo(u, Date.now()))
    if (activos.length <= 1) throw new ErrorHttp(409, 'Es el único administrador activo: cree o active otro antes')
  }
  const actualizar = async (id: string, cambios: Record<string, unknown>): Promise<UsuarioAuth> => {
    const r = await auth('PUT', `/admin/users/${id}`, cambios)
    if (r.estado !== 200) {
      console.error('actualizar usuario falló', r.estado)
      throw new ErrorHttp(502, 'Auth rechazó el cambio')
    }
    return r.cuerpo as UsuarioAuth
  }

  try {
    switch (cuerpo['accion']) {
      case 'listar': {
        const ahora = Date.now()
        const usuarios = (await todos()).map((u) => aListado(u, ahora)).sort((a, b) => a.correo.localeCompare(b.correo))
        return responder(200, { ok: true, usuarios })
      }

      case 'crear': {
        const correo = typeof cuerpo['correo'] === 'string' ? cuerpo['correo'].trim().toLowerCase() : ''
        if (correo.length > 254 || !RE_CORREO.test(correo)) throw new ErrorHttp(400, 'El correo no es válido')
        const rol = rolPedido()
        await bitacora('usuario_crea', { rol })
        const clave = generarClave()
        const r = await auth('POST', '/admin/users', {
          email: correo,
          password: clave,
          email_confirm: true,
          app_metadata: { rol },
          user_metadata: { debe_cambiar_clave: true },
        })
        const codigoAuth = (r.cuerpo as { error_code?: unknown } | null)?.error_code
        if (codigoAuth === 'email_exists' || codigoAuth === 'user_already_exists') throw new ErrorHttp(409, 'Ya existe un usuario con ese correo')
        if (r.estado !== 200 && r.estado !== 201) {
          console.error('crear usuario falló', r.estado, typeof codigoAuth === 'string' ? codigoAuth : '')
          throw new ErrorHttp(502, 'Auth no pudo crear el usuario')
        }
        return responder(200, { ok: true, usuario: aListado(r.cuerpo as UsuarioAuth, Date.now()), claveTemporal: clave })
      }

      case 'cambiar_rol': {
        const id = idObjetivo()
        const rol = rolPedido()
        const objetivo = await uno(id)
        if (rolDe(objetivo) === rol) throw new ErrorHttp(409, 'El usuario ya tiene ese rol')
        if (rol !== 'admin') await protegerUltimoAdmin(objetivo)
        await bitacora('usuario_cambia_rol', { objetivo_id: id, rol_anterior: rolDe(objetivo), rol_nuevo: rol })
        // app_metadata se envía completo: no se asume si Auth combina o reemplaza las claves.
        const u = await actualizar(id, { app_metadata: { ...(objetivo.app_metadata ?? {}), rol } })
        return responder(200, { ok: true, usuario: aListado(u, Date.now()) })
      }

      case 'desactivar': {
        const id = idObjetivo()
        const objetivo = await uno(id)
        await protegerUltimoAdmin(objetivo)
        await bitacora('usuario_desactiva', { objetivo_id: id })
        const u = await actualizar(id, { ban_duration: BLOQUEO })
        return responder(200, { ok: true, usuario: aListado(u, Date.now()) })
      }

      case 'reactivar': {
        const id = idObjetivo()
        await uno(id)
        await bitacora('usuario_reactiva', { objetivo_id: id })
        const u = await actualizar(id, { ban_duration: 'none' })
        return responder(200, { ok: true, usuario: aListado(u, Date.now()) })
      }

      case 'restablecer_clave': {
        const id = idObjetivo()
        const objetivo = await uno(id)
        await bitacora('usuario_restablece_clave', { objetivo_id: id })
        const clave = generarClave()
        const u = await actualizar(id, { password: clave, user_metadata: { ...(objetivo.user_metadata ?? {}), debe_cambiar_clave: true } })
        return responder(200, { ok: true, usuario: aListado(u, Date.now()), claveTemporal: clave })
      }

      case 'quitar_2fa': {
        const id = idObjetivo()
        const objetivo = await uno(id)
        const factores = (objetivo.factors ?? []).map((f) => f.id).filter((f): f is string => typeof f === 'string')
        if (factores.length === 0) throw new ErrorHttp(409, 'El usuario no tiene un segundo factor registrado')
        await bitacora('usuario_quita_2fa', { objetivo_id: id, factores: factores.length })
        for (const f of factores) {
          const r = await auth('DELETE', `/admin/users/${id}/factors/${f}`)
          if (r.estado !== 200 && r.estado !== 204) throw new ErrorHttp(502, 'Auth no pudo quitar el segundo factor')
        }
        return responder(200, { ok: true, usuario: aListado(await uno(id), Date.now()) })
      }

      default:
        return responder(400, { ok: false, error: 'Acción desconocida' })
    }
  } catch (e) {
    if (e instanceof ErrorHttp) return responder(e.estado, { ok: false, error: e.message })
    console.error('gestionar-usuarios falló', e instanceof Error ? e.message : 'error')
    return responder(502, { ok: false, error: 'No se pudo completar la operación' })
  }
}
