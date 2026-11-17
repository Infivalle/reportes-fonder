import { useState, type FormEvent } from 'react'
import type { AuthError, SupabaseClient } from '@supabase/supabase-js'
import { validarClave } from '../funciones/gestionar-usuarios/clave.ts'

const RAZONES: Readonly<Record<string, string>> = {
  length: 'no alcanza el largo mínimo que exige el proyecto',
  characters: 'le faltan tipos de caracteres que exige el proyecto',
  pwned: 'aparece en filtraciones de contraseñas conocidas',
}

/** Traduce el error de Supabase Auth a un mensaje útil; `pedirActual` activa el campo de la contraseña temporal. */
export function explicarError(fallo: Pick<AuthError, 'message' | 'status'> & { code?: string | undefined; name?: string | undefined; reasons?: unknown }): { texto: string; pedirActual: boolean } {
  const codigo = fallo.code ?? ''
  if (codigo === 'same_password') return { texto: 'La nueva contraseña debe ser distinta de la temporal.', pedirActual: false }
  if (codigo === 'weak_password' || fallo.name === 'AuthWeakPasswordError') {
    const razones = Array.isArray(fallo.reasons) ? fallo.reasons.map((r) => RAZONES[String(r)] ?? String(r)) : []
    return { texto: `Supabase rechazó la contraseña${razones.length > 0 ? `: ${razones.join('; ')}` : ' por su política de seguridad'}. Pruebe con otra.`, pedirActual: false }
  }
  if (codigo === 'reauthentication_needed') {
    return { texto: 'Supabase pide verificar su identidad otra vez. Cierre sesión, vuelva a entrar con la contraseña temporal y reintente.', pedirActual: false }
  }
  if (/current.?password/i.test(`${codigo} ${fallo.message}`)) {
    return { texto: 'El proyecto exige confirmar la contraseña actual. Escriba la contraseña temporal que recibió.', pedirActual: true }
  }
  return { texto: `No se pudo cambiar la contraseña (${codigo !== '' ? codigo : `estado ${String(fallo.status ?? '?')}`}: ${fallo.message}).`, pedirActual: false }
}

/** Primera entrada con una contraseña temporal: la persona elige la suya antes de seguir. */
export function CambiarClave({ cliente }: { cliente: SupabaseClient }) {
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [pedirActual, setPedirActual] = useState(false)

  const cambiar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    const nueva = String(datos.get('nueva') ?? '')
    const repetida = String(datos.get('repetida') ?? '')
    const actual = String(datos.get('actual') ?? '')
    const problema = validarClave(nueva)
    if (problema !== null) {
      setError(problema)
      return
    }
    if (nueva !== repetida) {
      setError('Las dos contraseñas no coinciden.')
      return
    }
    setEnviando(true)
    setError(null)
    const { error: fallo } = await cliente.auth.updateUser({
      password: nueva,
      data: { debe_cambiar_clave: false },
      ...(actual !== '' ? { current_password: actual } : {}),
    })
    setEnviando(false)
    if (fallo !== null) {
      const r = explicarError(fallo as AuthError & { reasons?: unknown })
      setError(r.texto)
      if (r.pedirActual) setPedirActual(true)
    }
    // Si sale bien, Auth avisa del cambio y la pantalla pasa sola a la zona privada.
  }

  return (
    <form className="privado__tarjeta privado__acceso" onSubmit={(e) => void cambiar(e)} noValidate>
      <h3 className="privado__subtitulo">Elija su contraseña</h3>
      <p className="tarjeta__descripcion">Entró con una contraseña temporal. Escriba una nueva de al menos 12 caracteres, con mayúscula, minúscula, número y símbolo.</p>
      <div className="filtro">
        <label htmlFor="privado-nueva">Contraseña nueva</label>
        <input id="privado-nueva" name="nueva" type="password" autoComplete="new-password" required />
      </div>
      <div className="filtro">
        <label htmlFor="privado-repetida">Repita la contraseña</label>
        <input id="privado-repetida" name="repetida" type="password" autoComplete="new-password" required />
      </div>
      {pedirActual && (
        <div className="filtro">
          <label htmlFor="privado-actual">Contraseña temporal (la que recibió)</label>
          <input id="privado-actual" name="actual" type="password" autoComplete="current-password" required />
        </div>
      )}
      {error !== null && (
        <p role="alert" className="tarjeta__aviso">
          {error}
        </p>
      )}
      <div className="privado__acciones">
        <button type="submit" className="boton boton--primario" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </button>
        <button type="button" className="boton" onClick={() => void cliente.auth.signOut()}>
          Cerrar sesión
        </button>
      </div>
    </form>
  )
}
