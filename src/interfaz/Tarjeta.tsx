import type { ReactNode } from 'react'
import type { Distribucion } from '../indicadores/calcular'
import { formatoEntero, formatoPorcentaje } from '../indicadores/formato'

/** Debajo de este n se avisa que la cifra es poco estable. */
const N_MINIMO_CONFIABLE = 5

/** Color de acento de la tarjeta (franja superior y barra). Plano y suave. */
export type Tono = 'azul' | 'turquesa' | 'verde' | 'ambar'

interface PropsTarjeta {
  titulo: string
  /** Cifra principal ya formateada; si falta, la tarjeta solo muestra su detalle. */
  valor?: string
  /** Qué mide la cifra principal, en una línea. */
  descripcion: string
  tono?: Tono
  /** Tarjeta baja del resumen superior (la barra queda al pie). */
  resumen?: boolean
  /** Respuestas con las que se calculó; null cuando el indicador no es sobre respuestas. */
  n: number | null
  children?: ReactNode
}

export function Tarjeta({ titulo, valor, descripcion, tono = 'azul', resumen = false, n, children }: PropsTarjeta) {
  const pocas = n !== null && n > 0 && n < N_MINIMO_CONFIABLE
  return (
    <article className={`tarjeta tarjeta--${tono}${resumen ? ' tarjeta--resumen' : ''}`} aria-label={titulo}>
      <h4 className="tarjeta__titulo">{titulo}</h4>
      {valor !== undefined && <p className="tarjeta__valor">{valor}</p>}
      <p className="tarjeta__descripcion">{descripcion}</p>
      {n === 0 && <p className="tarjeta__n">Sin respuestas</p>}
      {pocas && (
        <p className="tarjeta__aviso" role="note">
          Pocas respuestas: interprete la cifra con cautela.
        </p>
      )}
      {children}
    </article>
  )
}

interface PropsProgreso {
  /** 0 a 100; null = sin dato (no se dibuja). */
  porcentaje: number | null
  /** Texto para lectores de pantalla, p. ej. "Cobertura". */
  etiqueta: string
}

/** Barra de progreso accesible (role="progressbar"). */
export function Progreso({ porcentaje, etiqueta }: PropsProgreso) {
  if (porcentaje === null) return null
  const valor = Math.max(0, Math.min(100, porcentaje))
  return (
    <div
      className="progreso"
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(valor)}
    >
      <span className="progreso__relleno" style={{ width: `${valor}%` }} />
    </div>
  )
}

interface PropsTabla {
  titulo: string
  distribucion: Distribucion
  /** Valores que se destacan (los que componen la cifra principal). */
  resaltar?: readonly string[]
}

/** Distribución como tabla real: sirve de gráfica y de alternativa accesible a la vez. */
export function TablaDistribucion({ titulo, distribucion, resaltar = [] }: PropsTabla) {
  return (
    <table className="distribucion">
      <caption className="solo-lectores">{titulo}</caption>
      <thead className="solo-lectores">
        <tr>
          <th scope="col">Respuesta</th>
          <th scope="col">Proporción</th>
          <th scope="col">Casos</th>
          <th scope="col">Porcentaje</th>
        </tr>
      </thead>
      <tbody>
        {distribucion.items.map((i) => (
          <tr key={i.valor} className={resaltar.includes(i.valor) ? 'distribucion__fila--destacada' : undefined}>
            <th scope="row">{i.valor}</th>
            <td className="distribucion__barra" aria-hidden="true">
              <span style={{ width: `${Math.min(100, i.porcentaje ?? 0)}%` }} />
            </td>
            <td className="distribucion__casos">{formatoEntero(i.conteo)}</td>
            <td className="distribucion__pct">{formatoPorcentaje(i.porcentaje)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
