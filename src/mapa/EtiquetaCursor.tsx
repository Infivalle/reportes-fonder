import { useEffect, useRef, type RefObject } from 'react'
import './mapa.css'

interface Props {
  /** Elemento (la figura del mapa) sobre el que se mueve el cursor; debe tener `position: relative`. */
  contenedor: RefObject<HTMLElement | null>
  /** Nombre de cada municipio por código DIVIPOLA. */
  nombres: ReadonlyMap<string, string>
}

const SEPARACION = 14

/**
 * Etiqueta con el nombre del municipio que sigue al cursor. Solo con mouse o lápiz: en pantallas
 * táctiles no hay "pasar por encima" y el nombre ya sale bajo el mapa y en el detalle.
 *
 * Mueve el elemento directamente (sin estado de React) para no volver a dibujar el mapa en cada
 * movimiento. Es decorativa (`aria-hidden`): cada municipio ya tiene su `aria-label`.
 */
export function EtiquetaCursor({ contenedor, nombres }: Props) {
  const etiqueta = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const caja = contenedor.current
    const el = etiqueta.current
    if (caja === null || el === null) return

    const ocultar = () => {
      el.hidden = true
    }
    const mover = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return ocultar()
      const objetivo = e.target instanceof Element ? e.target.closest('[data-mapa-codigo]') : null
      const nombre = objetivo === null ? undefined : nombres.get(objetivo.getAttribute('data-mapa-codigo') ?? '')
      if (nombre === undefined) return ocultar()

      if (el.textContent !== nombre) el.textContent = nombre
      el.hidden = false
      const c = caja.getBoundingClientRect()
      const x = e.clientX - c.left
      const y = e.clientY - c.top
      // A la derecha y debajo del cursor; si no cabe, del otro lado.
      const izquierda = x + SEPARACION + el.offsetWidth > c.width ? x - SEPARACION - el.offsetWidth : x + SEPARACION
      const arriba = y + SEPARACION + el.offsetHeight > c.height ? y - SEPARACION - el.offsetHeight : y + SEPARACION
      el.style.transform = `translate(${Math.max(0, izquierda)}px, ${Math.max(0, arriba)}px)`
    }

    caja.addEventListener('pointermove', mover)
    caja.addEventListener('pointerleave', ocultar)
    caja.addEventListener('pointerdown', ocultar)
    return () => {
      caja.removeEventListener('pointermove', mover)
      caja.removeEventListener('pointerleave', ocultar)
      caja.removeEventListener('pointerdown', ocultar)
    }
  }, [contenedor, nombres])

  return <div ref={etiqueta} className="mapa__etiqueta" aria-hidden="true" hidden />
}
