/**
 * Genera src/mapa/totalesMunicipio.ts a partir del Excel de beneficiarios (hoja "DETALLE FONDER").
 *
 *   npx tsx scripts/generar-totales-municipio.ts ruta/fondercompleto.xlsx
 *
 * - Una persona se cuenta una vez por cédula (hay cédulas repetidas entre convocatorias).
 * - La convocatoria sale del año: 2024 = primera, 2026 = segunda. Cualquier otro año detiene el script.
 * - El municipio se resuelve con la misma regla del sitio (`resolverUbicacion`): el de la empresa y,
 *   si no es del Valle o está vacío, el de residencia.
 * - Solo se guardan conteos por municipio: el Excel (nombres, cédulas, teléfonos) no se copia a ningún lado.
 * Requiere `exceljs` y `tsx` (devDependencies). No se ejecuta en el sitio: el resultado se versiona.
 */
import ExcelJS from 'exceljs'
import { writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { MUNICIPIOS_VALLE, resolverUbicacion } from '../src/limpieza/municipios'

const ruta = process.argv[2]
if (!ruta) throw new Error('Uso: npx tsx scripts/generar-totales-municipio.ts <fondercompleto.xlsx>')
const CONVOCATORIA_POR_ANIO: Record<number, 'primera' | 'segunda'> = { 2024: 'primera', 2026: 'segunda' }
const SALIDA = new URL('../src/mapa/totalesMunicipio.ts', import.meta.url)

const texto = (v: ExcelJS.CellValue): string | null => {
  if (v === null || v === undefined) return null
  if (typeof v === 'object') return 'richText' in v ? v.richText.map((t) => t.text).join('').trim() || null : null
  return String(v).trim() || null
}

const libro = new ExcelJS.Workbook()
await libro.xlsx.readFile(ruta)
const hoja = libro.worksheets[0]
if (!hoja) throw new Error('El libro no tiene hojas')

// La fila de encabezados es la que trae "Cédula" y "Año" (arriba hay un título y una nota).
let filaEnc = 0
const col = new Map<string, number>()
hoja.eachRow((fila, n) => {
  if (filaEnc !== 0) return
  const nombres = (fila.values as ExcelJS.CellValue[]).map((v) => texto(v))
  if (nombres.includes('Cédula') && nombres.includes('Año')) {
    filaEnc = n
    nombres.forEach((nom, i) => nom !== null && col.set(nom, i))
  }
})
if (filaEnc === 0) throw new Error('No se encontró la fila de encabezados (Cédula, Año)')
for (const c of ['Año', 'Cédula', 'Municipio empresa', 'Municipio residencia']) if (!col.has(c)) throw new Error(`Falta la columna "${c}"`)

type Tipo = 'primera' | 'segunda' | 'total'
const personas = new Map<string, Record<Tipo, Set<string>>>()
let filas = 0
let sinUbicar = 0
let conResidencia = 0
const anios = new Set<number>()
hoja.eachRow((fila, n) => {
  if (n <= filaEnc) return
  const v = fila.values as ExcelJS.CellValue[]
  const cedula = texto(v[col.get('Cédula')!] ?? null)
  if (cedula === null) return
  filas += 1
  const anio = Number(v[col.get('Año')!])
  anios.add(anio)
  const conv = CONVOCATORIA_POR_ANIO[anio]
  if (conv === undefined) throw new Error(`Año ${anio} (fila ${n}) sin convocatoria asignada: agréguelo en CONVOCATORIA_POR_ANIO`)
  const u = resolverUbicacion(texto(v[col.get('Municipio empresa')!] ?? null), texto(v[col.get('Municipio residencia')!] ?? null), null)
  if (u.codigo === null) {
    sinUbicar += 1
    return
  }
  if (u.origen === 'residencia') conResidencia += 1
  const e = personas.get(u.codigo) ?? { primera: new Set(), segunda: new Set(), total: new Set() }
  e[conv].add(cedula)
  e.total.add(cedula)
  personas.set(u.codigo, e)
})

const lineas = [...MUNICIPIOS_VALLE]
  .sort((a, b) => a.codigo.localeCompare(b.codigo))
  .map((m) => {
    const e = personas.get(m.codigo)
    return `  '${m.codigo}': { primera: ${e?.primera.size ?? 0}, segunda: ${e?.segunda.size ?? 0}, total: ${e?.total.size ?? 0} }, // ${m.nombre}`
  })
const sinBeneficiarios = MUNICIPIOS_VALLE.filter((m) => (personas.get(m.codigo)?.total.size ?? 0) === 0).map((m) => `${m.nombre} (${m.codigo})`)
const suma = (t: Tipo) => [...personas.values()].reduce((s, e) => s + e[t].size, 0)

writeFileSync(
  SALIDA,
  `/**
 * GENERADO por scripts/generar-totales-municipio.ts — no editar a mano.
 * Fuente: ${basename(ruta).replace(/^[0-9a-f]{8}-/, '')} (${filas} filas con cédula; años ${[...anios].sort().join(' y ')}).
 * Total de beneficiarios por municipio (código DIVIPOLA), para la cobertura del panel del mapa.
 * - Personas distintas por cédula. \`total\` cuenta una vez a quien está en las dos convocatorias,
 *   por eso puede ser menor que primera + segunda.
 * - Municipio: el de la empresa; si falta, el de residencia (${conResidencia} filas usaron la residencia, ${sinUbicar} sin ubicar).
 * - Sin beneficiarios en el listado (aparecen en 0): ${sinBeneficiarios.join(', ') || 'ninguno'}.
 */
export interface TotalesDelMunicipio {
  primera: number
  segunda: number
  /** Personas distintas en las dos convocatorias. */
  total: number
}

export type TotalesMunicipio = Readonly<Record<string, TotalesDelMunicipio>>

export const BENEFICIARIOS_POR_MUNICIPIO: TotalesMunicipio = {
${lineas.join('\n')}
}
`,
)
console.log(`Escrito ${SALIDA.pathname}: ${personas.size} municipios con beneficiarios; primera ${suma('primera')}, segunda ${suma('segunda')}, total ${suma('total')}; sin ubicar ${sinUbicar}`)
