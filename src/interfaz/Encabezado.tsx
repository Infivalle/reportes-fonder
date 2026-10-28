import { LOGOS, SUBTITULO_SITIO, TITULO_SITIO, type Logo } from './marca'
import './estilos.css'

interface Props {
  /** Se puede pasar otra lista (pruebas); por defecto la de marca.ts. */
  logos?: readonly Logo[]
}

/** Encabezado del sitio: logos uno al lado del otro a la izquierda y el nombre a la derecha. */
export function Encabezado({ logos = LOGOS }: Props) {
  const base = import.meta.env.BASE_URL
  return (
    <header className="encabezado">
      <div className="encabezado__interior">
        {logos.length > 0 && (
          <div className="encabezado__logos">
            {logos.map((l) => (
              <img key={l.archivo} src={`${base}logos/${l.archivo}`} alt={l.alt} className="encabezado__logo" />
            ))}
          </div>
        )}
        <div className="encabezado__textos">
          <h1 className="encabezado__titulo">{TITULO_SITIO}</h1>
          <p className="encabezado__subtitulo">{SUBTITULO_SITIO}</p>
        </div>
      </div>
    </header>
  )
}
