import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Icono } from '../interfaz/Icono'
import '../interfaz/estilos.css'

interface Props {
  titulo: string
  onCerrar: () => void
  /** "lateral": panel a la derecha (editor). "ancho": ventana centrada (ampliar). */
  variante: 'lateral' | 'ancho'
  children: ReactNode
  pie?: ReactNode
}

const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])'

/**
 * Ventana modal accesible: foco dentro (Tab no se escapa), Escape y el fondo la cierran, y el foco
 * vuelve al botón que la abrió. El fondo de la página no se desplaza mientras está abierta.
 */
export function Panel({ titulo, onCerrar, variante, children, pie }: Props) {
  const idTitulo = useId()
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const desborde = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    caja.current?.focus()
    return () => {
      document.body.style.overflow = desborde
      previo?.focus()
    }
  }, [])

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCerrar()
      return
    }
    if (e.key !== 'Tab' || !caja.current) return
    const items = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((el) => el.offsetParent !== null || el === document.activeElement)
    const primero = items[0]
    const ultimo = items[items.length - 1]
    if (!primero || !ultimo) return
    if (e.shiftKey && (document.activeElement === primero || document.activeElement === caja.current)) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primero.focus()
    }
  }

  return (
    <div className="panel-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div
        ref={caja}
        className={`panel panel--${variante}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onKeyDown={alTeclear}
      >
        <header className="panel__cabecera">
          <h2 id={idTitulo} className="panel__titulo">
            {titulo}
          </h2>
          <button type="button" className="boton boton--icono" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </header>
        <div className="panel__cuerpo">{children}</div>
        {pie !== undefined && <footer className="panel__pie">{pie}</footer>}
      </div>
    </div>
  )
}
