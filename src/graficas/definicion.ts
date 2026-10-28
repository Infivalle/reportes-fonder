/**
 * Definición de una gráfica del constructor y las reglas que la mantienen coherente con el catálogo.
 * Es un objeto plano y serializable: el tablero (2c) lo guarda tal cual en localStorage.
 */
import {
  CATALOGO,
  GRAFICAS_POR_TIPO,
  MEDIDAS_POR_TIPO,
  buscarCampo,
  esDiscreto,
  type CampoCatalogo,
  type Grafica,
  type Medida,
} from '../catalogo/campos'

export interface GraficaDef {
  /** Clave del campo (ver CATALOGO). */
  campo: string
  grafica: Grafica
  medida: Medida
  /** Segundo campo discreto para comparar (barras agrupadas o apiladas); null = sin desglose. */
  desglose: string | null
}

export const CAMPO_INICIAL = 'satisfaction'

export function graficaPorDefecto(campo: CampoCatalogo): Grafica {
  switch (campo.tipo) {
    case 'multivalor':
      return 'barras_horizontales'
    case 'numerico':
      return 'histograma'
    default:
      return 'barras'
  }
}

export function medidaPorDefecto(campo: CampoCatalogo): Medida {
  return campo.tipo === 'numerico' ? 'promedio' : 'conteo'
}

/** Gráfica nueva para un campo, con la gráfica y la medida que propone su tipo. */
export function nuevaDef(clave: string): GraficaDef {
  const campo = buscarCampo(clave) ?? buscarCampo(CAMPO_INICIAL)!
  return { campo: campo.clave, grafica: graficaPorDefecto(campo), medida: medidaPorDefecto(campo), desglose: null }
}

/** Campos por los que se puede desglosar: discretos y distintos del campo graficado. */
export function desglosesPosibles(clave: string): CampoCatalogo[] {
  return CATALOGO.filter((c) => c.clave !== clave && esDiscreto(c))
}

/** ¿Esta gráfica usa un segundo campo? La dona y el histograma no. */
export function admiteDesglose(def: Pick<GraficaDef, 'grafica'>): boolean {
  return def.grafica !== 'dona' && def.grafica !== 'histograma'
}

/** ¿La medida elegida cambia algo? El histograma y la barra apilada al 100 % tienen la suya. */
export function admiteMedida(def: Pick<GraficaDef, 'grafica'>, campo: CampoCatalogo): boolean {
  if (campo.tipo === 'numerico') return def.grafica !== 'histograma'
  return def.grafica !== 'apilada_100'
}

/**
 * Devuelve la definición corregida para que sea válida (gráfica y medida admitidas por el tipo,
 * desglose existente y distinto del campo). null si el campo no existe en el catálogo: un tablero
 * importado con un campo viejo se descarta en vez de romper la pantalla.
 */
export function normalizar(def: GraficaDef): GraficaDef | null {
  const campo = buscarCampo(def.campo)
  if (!campo) return null

  const grafica = GRAFICAS_POR_TIPO[campo.tipo].includes(def.grafica) ? def.grafica : graficaPorDefecto(campo)
  let medida = MEDIDAS_POR_TIPO[campo.tipo].includes(def.medida) ? def.medida : medidaPorDefecto(campo)
  if (grafica === 'apilada_100') medida = 'porcentaje'

  const d = def.desglose === null ? undefined : buscarCampo(def.desglose)
  const desgloseValido = d !== undefined && d.clave !== campo.clave && esDiscreto(d) && admiteDesglose({ grafica })
  return { campo: campo.clave, grafica, medida, desglose: desgloseValido ? d.clave : null }
}
