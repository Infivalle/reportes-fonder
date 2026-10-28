/**
 * Catálogo de campos (se completa en F2 con el PDF del formulario).
 * Cada campo define: clave en el TSV, etiqueta, grupo, tipo, opciones válidas
 * en su orden, capa (pública o privada) y si entra en el Excel exportado.
 */
export type TipoCampo =
  | 'categorico'
  | 'ordinal'
  | 'numerico'
  | 'rango'
  | 'multivalor'
  | 'fecha'
  | 'texto_libre'

export type Capa = 'publica' | 'privada'

export interface CampoCatalogo {
  clave: string
  etiqueta: string
  grupo: 'resultados' | 'credito' | 'finanzas' | 'ventas' | 'empleo' | 'general'
  tipo: TipoCampo
  opciones?: readonly string[]
  capa: Capa
  enExcel: boolean
}

export const CATALOGO: readonly CampoCatalogo[] = []
