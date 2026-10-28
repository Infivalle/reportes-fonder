import type { ReactNode } from 'react'
import type { Distribucion } from '../indicadores/calcular'
import { formatoEntero, formatoPorcentaje } from '../indicadores/formato'

/** Debajo de este n se avisa que la cifra es poco estable. */
const N_MINIMO_CONFIABLE = 5

interface PropsTarjeta {
  titulo: string
  /** Cifra principal ya formateada. */
  valor: string
  /** Qué mide la cifra principal, en una línea. */
  descripcion: string
  /** Respuestas con las que se calculó; null cuando el indicador no es sobre respuestas. */
  n: number | null
  children?: ReactNode
}

export function Tarjeta({ titulo, valor, descripcion, n, children }: PropsTarjeta) {
  const pocas = n !== null && n > 0 && n < N_MINIMO_CONFIABLE
  return (
    <article className="tarjeta" aria-label={titulo}>
      <h3 className="tarjeta__titulo">{titulo}</h3>
      <p className="tarjeta__valor">{valor}</p>
      <p className="tarjeta__descripcion">{descripcion}</p>
      {n !== null && (
        <p className="tarjeta__n">{n === 0 ? 'Sin respuestas' : `n = ${formatoEntero(n)} respuestas`}</p>
      )}
      {pocas && (
        <p className="tarjeta__aviso" role="note">
          Pocas respuestas: interprete la cifra con cautela.
        </p>
      )}
      {children}
    </article>
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
