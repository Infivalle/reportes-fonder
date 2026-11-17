import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clienteCompartido } from '../privado/cliente'
import { descargarXlsx } from '../privado/descargar'
import { useSesion, type UsuarioSesion } from '../privado/useSesion'
import '../privado/privado.css'

/** Acceso interno: inicio de sesión y, para el admin, las descargas en Excel. */
export function PaginaPrivada() {
  const cliente = clienteCompartido()
  const sesion = useSesion(cliente)

  return (
    <section className="indicadores privado" aria-labelledby="privado-titulo">
      <div className="indicadores__encabezado">
        <div>
          <h2 id="privado-titulo">Acceso interno</h2>
          <p className="indicadores__meta">Solo para personal autorizado de InfiValle. Contiene datos personales.</p>
        </div>
      </div>

      {cliente === null ? (
        <p role="alert" className="indicadores__vacio">
          El acceso interno no está configurado en este sitio.
        </p>
      ) : sesion.estado === 'cargando' ? (
        <p role="status">Comprobando la sesión…</p>
      ) : sesion.estado === 'sin_sesion' ? (
        <FormularioAcceso cliente={cliente} />
      ) : (
        <ZonaPrivada cliente={cliente} usuario={sesion.usuario} />
      )}
    </section>
  )
}

function FormularioAcceso({ cliente }: { cliente: SupabaseClient }) {
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const entrar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    const correo = String(datos.get('correo') ?? '').trim()
    const clave = String(datos.get('clave') ?? '')
    if (correo === '' || clave === '') {
      setError('Escriba su correo y su contraseña.')
      return
    }
    setEnviando(true)
    setError(null)
    const { error: fallo } = await cliente.auth.signInWithPassword({ email: correo, password: clave })
    setEnviando(false)
    // Mensaje único: no se revela si el correo existe.
    if (fallo !== null) setError('Correo o contraseña incorrectos.')
  }

  return (
    <form className="privado__tarjeta privado__acceso" onSubmit={(e) => void entrar(e)} noValidate>
      <h3 className="privado__subtitulo">Iniciar sesión</h3>
      <div className="filtro">
        <label htmlFor="privado-correo">Correo</label>
        <input id="privado-correo" name="correo" type="email" autoComplete="username" required />
      </div>
      <div className="filtro">
        <label htmlFor="privado-clave">Contraseña</label>
        <input id="privado-clave" name="clave" type="password" autoComplete="current-password" required />
      </div>
      {error !== null && (
        <p role="alert" className="tarjeta__aviso">
          {error}
        </p>
      )}
      <button type="submit" className="boton boton--primario" disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="grafica__ayuda">Las cuentas las crea el administrador; no hay registro abierto.</p>
    </form>
  )
}

function ZonaPrivada({ cliente, usuario }: { cliente: SupabaseClient; usuario: UsuarioSesion }) {
  return (
    <>
      <div className="privado__sesion">
        <p className="tarjeta__descripcion">
          Sesión de <strong>{usuario.correo}</strong>
          {usuario.rol !== null && <> · {usuario.rol === 'admin' ? 'Administrador' : 'Asesor'}</>}
        </p>
        <button type="button" className="boton" onClick={() => void cliente.auth.signOut()}>
          Cerrar sesión
        </button>
      </div>

      {usuario.rol === null && (
        <p role="alert" className="indicadores__vacio">
          Su cuenta no tiene un rol asignado. Pida al administrador que se lo asigne.
        </p>
      )}
      {usuario.rol === 'asesor' && (
        <p role="status" className="indicadores__vacio">
          Su rol no incluye descargas. La búsqueda de beneficiarios y las fichas se habilitarán en una próxima entrega.
        </p>
      )}
      {usuario.rol === 'admin' && <PanelExcel cliente={cliente} usuario={usuario} />}
    </>
  )
}

type Estado =
  | { fase: 'quieto' }
  | { fase: 'trabajando'; texto: string }
  | { fase: 'listo'; nombre: string; resumen: string[]; avisos: string[] }
  | { fase: 'error'; mensaje: string }

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado.'
}

function PanelExcel({ cliente, usuario }: { cliente: SupabaseClient; usuario: UsuarioSesion }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cruce, setCruce] = useState<Estado>({ fase: 'quieto' })
  const [limpia, setLimpia] = useState<Estado>({ fase: 'quieto' })
  const ocupado = cruce.fase === 'trabajando' || limpia.fase === 'trabajando'

  const generarCruce = async () => {
    if (archivo === null) return
    setCruce({ fase: 'trabajando', texto: 'Preparando…' })
    try {
      // exceljs pesa bastante: se descarga solo al generar un archivo.
      const { generarCruce: generar } = await import('../privado/exportar')
      const r = await generar(cliente, usuario.id, await archivo.arrayBuffer(), (texto) => setCruce({ fase: 'trabajando', texto }))
      descargarXlsx(r.contenido, r.nombre)
      setCruce({ fase: 'listo', nombre: r.nombre, resumen: r.resumen, avisos: r.avisos })
    } catch (e) {
      setCruce({ fase: 'error', mensaje: mensajeDe(e) })
    }
  }

  const generarLimpia = async () => {
    setLimpia({ fase: 'trabajando', texto: 'Preparando…' })
    try {
      const { generarDataLimpia } = await import('../privado/exportar')
      const r = await generarDataLimpia(cliente, usuario, (texto) => setLimpia({ fase: 'trabajando', texto }))
      descargarXlsx(r.contenido, r.nombre)
      setLimpia({ fase: 'listo', nombre: r.nombre, resumen: r.resumen, avisos: r.avisos })
    } catch (e) {
      setLimpia({ fase: 'error', mensaje: mensajeDe(e) })
    }
  }

  return (
    <div className="rejilla privado__rejilla">
      <article className="privado__tarjeta" aria-labelledby="privado-cruce">
        <h3 id="privado-cruce" className="privado__subtitulo">
          Cruce de la cartera con las asesorías
        </h3>
        <p className="tarjeta__descripcion">
          Marca cuáles beneficiarios de la cartera Fonder ya tienen asesoría registrada. El archivo se lee en su equipo y no se envía a ningún servidor.
        </p>
        <div className="filtro">
          <label htmlFor="privado-cartera">Cartera (fondercompleto.xlsx, hoja «DETALLE FONDER»)</label>
          <input
            id="privado-cartera"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] ?? null)
              setCruce({ fase: 'quieto' })
            }}
          />
        </div>
        <button type="button" className="boton boton--primario" disabled={archivo === null || ocupado} onClick={() => void generarCruce()}>
          Generar y descargar el cruce
        </button>
        <Informe estado={cruce} />
      </article>

      <article className="privado__tarjeta" aria-labelledby="privado-limpia">
        <h3 id="privado-limpia" className="privado__subtitulo">
          Data limpia completa
        </h3>
        <p className="tarjeta__descripcion">
          Una fila por asesoría conservada, con las respuestas del formulario, mejoras, canales, descartadas con su motivo, diccionario y datos de la carga.
          Incluye datos personales y financieros.
        </p>
        <button type="button" className="boton boton--primario" disabled={ocupado} onClick={() => void generarLimpia()}>
          Generar y descargar la data limpia
        </button>
        <Informe estado={limpia} />
      </article>
      <p className="grafica__ayuda privado__nota">Cada descarga queda registrada en la bitácora con su fecha y su usuario.</p>
    </div>
  )
}

function Informe({ estado }: { estado: Estado }) {
  return (
    <div aria-live="polite" className="privado__informe">
      {estado.fase === 'trabajando' && <p role="status">{estado.texto}</p>}
      {estado.fase === 'error' && (
        <p role="alert" className="tarjeta__aviso">
          {estado.mensaje}
        </p>
      )}
      {estado.fase === 'listo' && (
        <>
          <p role="status">
            Descarga lista: <strong>{estado.nombre}</strong>
          </p>
          <ul className="privado__lista">
            {estado.resumen.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {estado.avisos.map((t) => (
            <p key={t} role="alert" className="tarjeta__aviso">
              {t}
            </p>
          ))}
        </>
      )}
    </div>
  )
}
