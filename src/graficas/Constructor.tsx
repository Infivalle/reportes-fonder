import { useId } from 'react'
import { CATALOGO, GRAFICAS_POR_TIPO, GRUPOS, MEDIDAS_POR_TIPO, buscarCampo, type Grafica, type Grupo, type Medida } from '../catalogo/campos'
import { admiteDesglose, admiteMedida, desglosesPosibles, normalizar, nuevaDef, type GraficaDef } from './definicion'
import '../interfaz/estilos.css'

interface Props {
  def: GraficaDef
  onCambio: (nueva: GraficaDef) => void
}

const NOMBRE_GRAFICA: Record<Grafica, string> = {
  barras: 'Barras',
  barras_horizontales: 'Barras horizontales',
  dona: 'Dona',
  apilada_100: 'Barra apilada al 100 %',
  histograma: 'Histograma',
  tabla: 'Solo tabla',
}

const NOMBRE_MEDIDA: Record<Medida, string> = {
  conteo: 'Cantidad de beneficiarios',
  porcentaje: 'Porcentaje',
  promedio: 'Promedio',
  mediana: 'Mediana',
  minimo: 'Mínimo',
  maximo: 'Máximo',
}

const ORDEN_GRUPOS: readonly Grupo[] = ['general', 'resultados', 'credito', 'finanzas', 'ventas', 'empleo']

/** Formulario para elegir qué graficar: campo, tipo de gráfica, medida y campo de comparación. */
export function Constructor({ def, onCambio }: Props) {
  const id = useId()
  const campo = buscarCampo(def.campo)
  if (!campo) return null

  const aplicar = (cambios: Partial<GraficaDef>) => onCambio(normalizar({ ...def, ...cambios }) ?? def)
  const numericaPorCategoria = campo.tipo === 'numerico' && def.grafica !== 'histograma'

  return (
    <form className="constructor" aria-label="Constructor de gráficas" onSubmit={(e) => e.preventDefault()}>
      <div className="filtro">
        <label htmlFor={`${id}-campo`}>¿Qué quiere graficar?</label>
        <select
          id={`${id}-campo`}
          value={def.campo}
          // Al cambiar de campo se parte de la gráfica y la medida que propone su tipo, conservando la comparación si sigue siendo válida.
          onChange={(e) => onCambio(normalizar({ ...nuevaDef(e.target.value), desglose: def.desglose }) ?? def)}
        >
          {ORDEN_GRUPOS.map((g) => (
            <optgroup key={g} label={GRUPOS[g]}>
              {CATALOGO.filter((c) => c.grupo === g).map((c) => (
                <option key={c.clave} value={c.clave}>
                  {c.etiqueta}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="filtro">
        <label htmlFor={`${id}-grafica`}>Tipo de gráfica</label>
        <select id={`${id}-grafica`} value={def.grafica} onChange={(e) => aplicar({ grafica: e.target.value as Grafica })}>
          {GRAFICAS_POR_TIPO[campo.tipo].map((g) => (
            <option key={g} value={g}>
              {campo.tipo === 'numerico' && g === 'barras' ? 'Barras por categoría' : NOMBRE_GRAFICA[g]}
            </option>
          ))}
        </select>
      </div>

      {admiteMedida(def, campo) && (
        <div className="filtro">
          <label htmlFor={`${id}-medida`}>Medida</label>
          <select id={`${id}-medida`} value={def.medida} onChange={(e) => aplicar({ medida: e.target.value as Medida })}>
            {MEDIDAS_POR_TIPO[campo.tipo].map((m) => (
              <option key={m} value={m}>
                {NOMBRE_MEDIDA[m]}
              </option>
            ))}
          </select>
        </div>
      )}

      {admiteDesglose(def) && (
        <div className="filtro">
          <label htmlFor={`${id}-desglose`}>{numericaPorCategoria ? 'Calcular por (obligatorio)' : 'Comparar por'}</label>
          <select id={`${id}-desglose`} value={def.desglose ?? ''} onChange={(e) => aplicar({ desglose: e.target.value === '' ? null : e.target.value })}>
            <option value="">{numericaPorCategoria ? 'Elija un campo…' : 'Sin comparación'}</option>
            {desglosesPosibles(def.campo).map((c) => (
              <option key={c.clave} value={c.clave}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </div>
      )}
    </form>
  )
}
