import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validarClave } from '../funciones/gestionar-usuarios/clave.ts'

/** Primera entrada con una contraseña temporal: la persona elige la suya antes de seguir. */
export function CambiarClave({ cliente }: { cliente: SupabaseClient }) {
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cambiar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    const nueva = String(datos.get('nueva') ?? '')
    const repetida = String(datos.get('repetida') ?? '')
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
    const { error: fallo } = await cliente.auth.updateUser({ password: nueva, data: { debe_cambiar_clave: false } })
    setEnviando(false)
    if (fallo !== null) {
      setError(fallo.code === 'same_password' ? 'La nueva contraseña debe ser distinta de la temporal.' : 'No se pudo cambiar la contraseña. Pruebe con otra o inicie sesión de nuevo.')
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
