import './mapa.css'

interface Props {
  /** 0 a 100 (se limita a ese rango al dibujar). */
  porcentaje: number
  /** Texto para lectores de pantalla, p. ej. "Cobertura: 27 %". */
  etiqueta: string
  texto: string
}

const R = 30
const LARGO = 2 * Math.PI * R

/** Anillo de progreso: el arco lleno es el porcentaje; el número va al centro. */
export function Anillo({ porcentaje, etiqueta, texto }: Props) {
  const p = Math.min(100, Math.max(0, porcentaje))
  return (
    <svg className="anillo" viewBox="0 0 76 76" role="img" aria-label={etiqueta}>
      <circle className="anillo__fondo" cx="38" cy="38" r={R} />
      <circle
        className="anillo__arco"
        cx="38"
        cy="38"
        r={R}
        strokeDasharray={`${(p / 100) * LARGO} ${LARGO}`}
        transform="rotate(-90 38 38)"
      />
      <text className="anillo__texto" x="38" y="38" textAnchor="middle" dominantBaseline="central">
        {texto}
      </text>
    </svg>
  )
}
