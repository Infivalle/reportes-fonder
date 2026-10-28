import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { aplicarFiltros } from '../indicadores/calcular'
import { formatoEntero } from '../indicadores/formato'
import { calcularGrafica } from '../graficas/datos'
import { VistaGrafica } from '../graficas/VistaGrafica'
import { filtrarPorCampos } from '../indicadores/consulta'
import type { PublicoJson } from '../publico/tipos'
import { MAX_BYTES_ARCHIVO, MAX_TARJETAS, leerTablero, serializarTablero, type Tablero, type TarjetaTablero } from '../tablero/modelo'
import { Panel } from '../tablero/Panel'
import { PanelEdicion } from '../tablero/PanelEdicion'
import { TarjetaGrafica } from '../tablero/TarjetaGrafica'
import { useTablero } from '../tablero/useTablero'
import type { FiltrosGlobales } from './ruta'
import './estilos.css'

interface Props {
  datos: PublicoJson
  filtros: FiltrosGlobales
}

type Edicion = { tipo: 'nueva' } | { tipo: 'editar'; id: string } | null

/** Lee un archivo como texto (File.text no existe en todos los entornos). */
function leerArchivo(archivo: File): Promise<string> {
  if (typeof archivo.text === 'function') return archivo.text()
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(String(lector.result))
    lector.onerror = () => rechazar(lector.error)
    lector.readAsText(archivo)
  })
}

function descargar(nombre: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

/** "Mis gráficas": un tablero de gráficas guardadas, sobre los datos que dejan pasar los filtros globales. */
export function PaginaGraficas({ datos, filtros }: Props) {
  const { tablero, reemplazarTodo, avisoAlmacen, agregar, reemplazar, quitar, duplicar, mover } = useTablero()
  const [edicion, setEdicion] = useState<Edicion>(null)
  const [ampliada, setAmpliada] = useState<string | null>(null)
  /** Mensaje de la última acción; con `previo`, ofrece deshacerla. */
  const [mensaje, setMensaje] = useState<{ texto: string; previo: Tablero | null } | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  const filas = useMemo(() => aplicarFiltros(datos.asesorias, filtros), [datos, filtros])
  const total = useMemo(() => new Set(filas.map((f) => f.beneficiario)).size, [filas])
  const lleno = tablero.tarjetas.length >= MAX_TARJETAS
  const enEdicion = edicion?.tipo === 'editar' ? tablero.tarjetas.find((t) => t.id === edicion.id) : undefined
  const enAmpliada = ampliada === null ? undefined : tablero.tarjetas.find((t) => t.id === ampliada)

  const nombreDe = (t: TarjetaTablero) => calcularGrafica(filtrarPorCampos(filas, t.filtros), t.def).titulo

  const quitarConDeshacer = (t: TarjetaTablero) => {
    setMensaje({ texto: `Se quitó «${nombreDe(t)}».`, previo: tablero })
    quitar(t.id)
  }

  const exportar = () => {
    descargar('mis-graficas-fonder.json', serializarTablero(tablero))
    setMensaje({ texto: 'Se descargó el archivo con sus gráficas.', previo: null })
  }

  const importar = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    e.target.value = '' // permite elegir el mismo archivo otra vez
    if (!archivo) return
    if (archivo.size > MAX_BYTES_ARCHIVO) {
      setMensaje({ texto: 'El archivo es demasiado grande para ser un tablero.', previo: null })
      return
    }
    let lectura: ReturnType<typeof leerTablero>
    try {
      lectura = leerTablero(await leerArchivo(archivo))
    } catch {
      setMensaje({ texto: 'No se pudo leer el archivo.', previo: null })
      return
    }
    if (!lectura.ok) {
      setMensaje({ texto: `No se importó: ${lectura.motivo}`, previo: null })
      return
    }
    const n = lectura.tablero.tarjetas.length
    const descartadas = lectura.descartadas > 0 ? ` Se omitieron ${lectura.descartadas} que no se pudieron leer.` : ''
    setMensaje({ texto: `Se importaron ${n} ${n === 1 ? 'gráfica' : 'gráficas'} y reemplazaron las actuales.${descartadas}`, previo: tablero })
    reemplazarTodo(lectura.tablero)
  }

  return (
    <section className="indicadores" aria-labelledby="titulo-graficas">
      <header className="indicadores__encabezado">
        <div>
          <h2 id="titulo-graficas">Mis gráficas</h2>
          <p className="indicadores__meta">
            Arme su tablero con las gráficas que necesite. Los filtros de arriba aplican a todas: {formatoEntero(total)} beneficiarios con asesoría.
          </p>
        </div>
      </header>

      <div className="tablero__barra">
        <button type="button" className="boton boton--primario" onClick={() => setEdicion({ tipo: 'nueva' })} disabled={lleno}>
          Agregar gráfica
        </button>
        <button type="button" className="boton" onClick={exportar} disabled={tablero.tarjetas.length === 0}>
          Exportar
        </button>
        <button type="button" className="boton" onClick={() => entrada.current?.click()}>
          Importar
        </button>
        <input ref={entrada} type="file" accept="application/json,.json" className="solo-lectores" tabIndex={-1} aria-label="Archivo de tablero a importar" onChange={importar} />
        <span className="tablero__cuenta">
          {tablero.tarjetas.length} de {MAX_TARJETAS} gráficas
        </span>
      </div>

      {avisoAlmacen !== null && (
        <p className="tarjeta__aviso" role="alert">
          {avisoAlmacen}
        </p>
      )}
      {mensaje !== null && (
        <p className="tablero__mensaje" role="status">
          {mensaje.texto}
          {mensaje.previo !== null && (
            <button
              type="button"
              className="boton boton--texto"
              onClick={() => {
                if (mensaje.previo) reemplazarTodo(mensaje.previo)
                setMensaje(null)
              }}
            >
              Deshacer
            </button>
          )}
          <button type="button" className="boton boton--texto" onClick={() => setMensaje(null)}>
            Cerrar aviso
          </button>
        </p>
      )}

      {tablero.tarjetas.length === 0 ? (
        <div className="tablero__vacio">
          <h3>Su tablero está vacío</h3>
          <p>Agregue una gráfica para empezar, o importe un tablero guardado.</p>
        </div>
      ) : (
        <ul className="tablero" aria-label="Gráficas del tablero">
          {tablero.tarjetas.map((t, i) => (
            <TarjetaGrafica
              key={t.id}
              tarjeta={t}
              filas={filas}
              primera={i === 0}
              ultima={i === tablero.tarjetas.length - 1}
              onEditar={() => setEdicion({ tipo: 'editar', id: t.id })}
              onDuplicar={() => duplicar(t.id)}
              onQuitar={() => quitarConDeshacer(t)}
              onMover={(d) => mover(t.id, d)}
              onAmpliar={() => setAmpliada(t.id)}
            />
          ))}
        </ul>
      )}

      {edicion !== null && (edicion.tipo === 'nueva' || enEdicion !== undefined) && (
        <PanelEdicion
          inicial={enEdicion ? { def: enEdicion.def, filtros: enEdicion.filtros } : null}
          filas={filas}
          onCerrar={() => setEdicion(null)}
          onGuardar={(def, filtrosPropios) => {
            if (enEdicion) reemplazar(enEdicion.id, def, filtrosPropios)
            else agregar(def, filtrosPropios)
            setEdicion(null)
          }}
        />
      )}

      {enAmpliada !== undefined && (
        <Panel variante="ancho" titulo="Gráfica ampliada" onCerrar={() => setAmpliada(null)}>
          <VistaGrafica datos={calcularGrafica(filtrarPorCampos(filas, enAmpliada.filtros), enAmpliada.def)} def={enAmpliada.def} />
        </Panel>
      )}
    </section>
  )
}

