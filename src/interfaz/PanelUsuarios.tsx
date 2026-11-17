import { useEffect, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { llamarUsuarios, type CuerpoUsuarios, type Rol, type UsuarioListado } from '../privado/usuarios'

type Lista = { estado: 'cargando' } | { estado: 'error'; mensaje: string } | { estado: 'lista'; usuarios: UsuarioListado[] }
type Accion = 'cambiar_rol' | 'desactivar' | 'reactivar' | 'restablecer_clave' | 'quitar_2fa'
interface Pendiente {
  id: string
  accion: Accion
}
interface Entrega {
  correo: string
  clave: string
  motivo: 'creada' | 'restablecida'
}

const ROL: Record<Rol, string> = { admin: 'Administrador', asesor: 'Asesor' }

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado.'
}

function fecha(iso: string | null): string {
  if (iso === null) return 'Nunca'
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })
}

function textoAccion(a: Accion, u: UsuarioListado): string {
  switch (a) {
    case 'cambiar_rol':
      return u.rol === 'admin' ? 'Pasar a asesor' : 'Pasar a administrador'
    case 'desactivar':
      return 'Desactivar'
    case 'reactivar':
      return 'Reactivar'
    case 'restablecer_clave':
      return 'Restablecer contraseña'
    case 'quitar_2fa':
      return 'Quitar segundo factor'
  }
}

function cuerpoDe(p: Pendiente, u: UsuarioListado): CuerpoUsuarios {
  if (p.accion === 'cambiar_rol') return { accion: 'cambiar_rol', id: p.id, rol: u.rol === 'admin' ? 'asesor' : 'admin' }
  return { accion: p.accion, id: p.id }
}

/** Gestión de cuentas (solo admin). Todo pasa por la Edge Function: la llave de servicio nunca está en el navegador. */
export function PanelUsuarios({ cliente, yoId }: { cliente: SupabaseClient; yoId: string }) {
  const [lista, setLista] = useState<Lista>({ estado: 'cargando' })
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [entrega, setEntrega] = useState<Entrega | null>(null)
  const [copiada, setCopiada] = useState(false)

  useEffect(() => {
    let vivo = true
    void llamarUsuarios(cliente, { accion: 'listar' })
      .then((r) => {
        if (vivo) setLista({ estado: 'lista', usuarios: r.usuarios ?? [] })
      })
      .catch((e: unknown) => {
        if (vivo) setLista({ estado: 'error', mensaje: mensajeDe(e) })
      })
    return () => {
      vivo = false
    }
  }, [cliente])

  const recargar = async () => {
    try {
      const r = await llamarUsuarios(cliente, { accion: 'listar' })
      setLista({ estado: 'lista', usuarios: r.usuarios ?? [] })
    } catch (e) {
      setLista({ estado: 'error', mensaje: mensajeDe(e) })
    }
  }

  const crear = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formulario = e.currentTarget
    const datos = new FormData(formulario)
    const correo = String(datos.get('correo') ?? '').trim()
    const rol = datos.get('rol') === 'admin' ? 'admin' : 'asesor'
    if (correo === '') {
      setAviso({ tipo: 'error', texto: 'Escriba el correo de la persona.' })
      return
    }
    setOcupado(true)
    setAviso(null)
    setEntrega(null)
    setCopiada(false)
    try {
      const r = await llamarUsuarios(cliente, { accion: 'crear', correo, rol })
      if (r.claveTemporal === undefined || r.usuario === undefined) throw new Error('Respuesta inesperada del servidor.')
      setEntrega({ correo: r.usuario.correo, clave: r.claveTemporal, motivo: 'creada' })
      formulario.reset()
      await recargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDe(err) })
    }
    setOcupado(false)
  }

  const confirmar = async (u: UsuarioListado) => {
    if (pendiente === null) return
    setOcupado(true)
    setAviso(null)
    setEntrega(null)
    setCopiada(false)
    try {
      const r = await llamarUsuarios(cliente, cuerpoDe(pendiente, u))
      if (pendiente.accion === 'restablecer_clave' && r.claveTemporal !== undefined) {
        setEntrega({ correo: u.correo, clave: r.claveTemporal, motivo: 'restablecida' })
      } else {
        setAviso({ tipo: 'ok', texto: `Listo: ${textoAccion(pendiente.accion, u).toLowerCase()} · ${u.correo}.` })
      }
      setPendiente(null)
      await recargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDe(err) })
      setPendiente(null)
    }
    setOcupado(false)
  }

  const copiar = async (clave: string) => {
    try {
      await navigator.clipboard.writeText(clave)
      setCopiada(true)
    } catch {
      setCopiada(false)
      setAviso({ tipo: 'error', texto: 'No se pudo copiar. Selecciónela y cópiela a mano.' })
    }
  }

  return (
    <div className="privado__usuarios">
      <form className="privado__tarjeta" onSubmit={(e) => void crear(e)} noValidate aria-labelledby="usuarios-nuevo">
        <h3 id="usuarios-nuevo" className="privado__subtitulo">
          Crear usuario
        </h3>
        <p className="tarjeta__descripcion">Se crea con una contraseña temporal que se muestra una sola vez. La persona deberá cambiarla al entrar.</p>
        <div className="privado__fila">
          <div className="filtro">
            <label htmlFor="usuarios-correo">Correo</label>
            <input id="usuarios-correo" name="correo" type="email" autoComplete="off" required />
          </div>
          <div className="filtro">
            <label htmlFor="usuarios-rol">Rol</label>
            <select id="usuarios-rol" name="rol" defaultValue="asesor">
              <option value="asesor">Asesor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <button type="submit" className="boton boton--primario" disabled={ocupado}>
          Crear usuario
        </button>
      </form>

      <div aria-live="polite">
        {aviso !== null && (
          <p role={aviso.tipo === 'error' ? 'alert' : 'status'} className={aviso.tipo === 'error' ? 'tarjeta__aviso' : 'tablero__mensaje'}>
            {aviso.texto}
          </p>
        )}
        {entrega !== null && (
          <div className="privado__clave" role="status">
            <p>
              <strong>Contraseña temporal {entrega.motivo === 'creada' ? 'de la cuenta nueva' : 'restablecida'}</strong> ({entrega.correo}). Se muestra una sola vez: cópiela y
              entréguela por un canal seguro.
            </p>
            <p>
              <code className="privado__codigo">{entrega.clave}</code>
            </p>
            <div className="privado__acciones">
              <button type="button" className="boton" onClick={() => void copiar(entrega.clave)}>
                {copiada ? 'Copiada' : 'Copiar'}
              </button>
              <button type="button" className="boton" onClick={() => setEntrega(null)}>
                Ya la entregué, ocultar
              </button>
            </div>
          </div>
        )}
      </div>

      {lista.estado === 'cargando' && <p role="status">Cargando usuarios…</p>}
      {lista.estado === 'error' && (
        <p role="alert" className="tarjeta__aviso">
          {lista.mensaje}
        </p>
      )}
      {lista.estado === 'lista' && (
        <div className="privado__tabla" tabIndex={0} role="region" aria-label="Usuarios">
          <table className="privado__usuarios-tabla">
            <caption className="solo-lectores">Usuarios con acceso interno</caption>
            <thead>
              <tr>
                <th scope="col">Correo</th>
                <th scope="col">Rol</th>
                <th scope="col">Estado</th>
                <th scope="col">Segundo factor</th>
                <th scope="col">Último acceso</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.usuarios.map((u) => {
                const yo = u.id === yoId
                const esteConfirma = pendiente?.id === u.id
                const acciones: Accion[] = ['cambiar_rol', u.activo ? 'desactivar' : 'reactivar', 'restablecer_clave', ...(u.tiene2fa === true ? (['quitar_2fa'] as const) : [])]
                return (
                  <tr key={u.id}>
                    <th scope="row">
                      {u.correo}
                      {yo && <span className="privado__yo"> (usted)</span>}
                    </th>
                    <td>{u.rol === null ? 'Sin rol' : ROL[u.rol]}</td>
                    <td>{u.activo ? 'Activo' : 'Desactivado'}</td>
                    <td>{u.tiene2fa === null ? '—' : u.tiene2fa ? 'Sí' : 'No'}</td>
                    <td>{fecha(u.ultimoAcceso)}</td>
                    <td>
                      {yo ? (
                        <span className="tarjeta__descripcion">—</span>
                      ) : esteConfirma && pendiente !== null ? (
                        <span className="privado__confirmar">
                          <span>¿{textoAccion(pendiente.accion, u)}?</span>
                          <button type="button" className="boton boton--primario" disabled={ocupado} onClick={() => void confirmar(u)}>
                            Confirmar
                          </button>
                          <button type="button" className="boton" disabled={ocupado} onClick={() => setPendiente(null)}>
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <span className="privado__acciones-fila">
                          {acciones.map((a) => (
                            <button
                              key={a}
                              type="button"
                              className="boton boton--texto"
                              disabled={ocupado}
                              aria-label={`${textoAccion(a, u)} a ${u.correo}`}
                              onClick={() => setPendiente({ id: u.id, accion: a })}
                            >
                              {textoAccion(a, u)}
                            </button>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="grafica__ayuda">
        Los usuarios no se borran, se desactivan: así la bitácora conserva su historial. Un cambio de rol o una desactivación puede tardar hasta una hora en
        notarse en una sesión que ya esté abierta. Cada acción queda registrada en la bitácora.
      </p>
    </div>
  )
}
