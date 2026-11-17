/**
 * Libro Excel del cruce. Mismas hojas y columnas que `cruce_excel_vs_asesorias_vN.xlsx`:
 *  - Resumen · Cruce (una fila por fila de la cartera) · Asesoría sin match en Excel.
 */
import ExcelJS from 'exceljs'
import type { ConteoGrupo, ResultadoCruce } from './cruce'

const AZUL = 'FF1F4E78'

export const ENCABEZADOS_CRUCE = [
  'Cédula',
  'Nombre',
  'Año',
  'Estado depurado',
  'Municipio residencia',
  'Equipo',
  'Tiene asesoría',
  'N° registros',
  'Primera asesoría (UTC)',
  'Última asesoría (UTC)',
] as const

export function estiloEncabezado(fila: ExcelJS.Row): void {
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
  fila.alignment = { vertical: 'middle' }
}

/** Número si es una cédula "normal" (como en el archivo de referencia); texto si perdería ceros o precisión. */
function cedulaCelda(c: string): string | number | null {
  if (c === '') return null
  return /^[1-9]\d{0,14}$/.test(c) ? Number(c) : c
}

function vacioANulo(t: string): string | null {
  return t === '' ? null : t
}

function tablaGrupo(hoja: ExcelJS.Worksheet, fila: number, titulo: string, grupos: readonly ConteoGrupo[]): number {
  const enc = hoja.getRow(fila)
  enc.values = [titulo, 'Filas', 'Con asesoría', '%']
  enc.font = { bold: true }
  let n = fila + 1
  for (const g of grupos) {
    const f = hoja.getRow(n)
    f.values = [g.grupo, g.filas, g.conAsesoria, g.proporcion]
    f.getCell(4).numFmt = '0.0%'
    n += 1
  }
  return n
}

export interface MetaCruce {
  /** Texto entre paréntesis del título, p. ej. "carga del 2026-11-13, 761 filas". */
  origen: string
}

export function construirLibroCruce(r: ResultadoCruce, meta: MetaCruce): ExcelJS.Workbook {
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Dashboard de asesorías Fonder Valle'

  // --- Resumen
  const res = libro.addWorksheet('Resumen')
  res.getColumn(1).width = 50
  res.getColumn(2).width = 14
  res.getColumn(3).width = 16
  res.getColumn(4).width = 10
  res.getCell('A1').value = `Cruce Excel Fonder vs asesorías (${meta.origen})`
  res.getCell('A1').font = { bold: true, size: 13 }
  const totales: [string, number][] = [
    ['Filas en Excel', r.filasExcel],
    ['Cédulas distintas en Excel', r.cedulasDistintas],
    ['Cédulas con asesoría', r.cedulasConAsesoria],
    ['Cédulas sin asesoría', r.cedulasSinAsesoria],
    ['Documentos con asesoría fuera del Excel', r.sinMatch.length],
  ]
  totales.forEach(([etiqueta, valor], i) => {
    res.getRow(2 + i).values = [etiqueta, valor]
  })
  const siguiente = tablaGrupo(res, 8, 'Estado depurado', r.porEstado)
  tablaGrupo(res, siguiente + 1, 'Año', r.porAnio)

  // --- Cruce
  const cruce = libro.addWorksheet('Cruce')
  const anchos = [13, 34, 7, 20, 22, 12, 14, 12, 20, 20]
  anchos.forEach((w, i) => {
    cruce.getColumn(i + 1).width = w
  })
  cruce.addRow([...ENCABEZADOS_CRUCE])
  estiloEncabezado(cruce.getRow(1))
  for (const f of r.filas) {
    cruce.addRow([
      cedulaCelda(f.cedula),
      vacioANulo(f.nombre),
      f.anio,
      vacioANulo(f.estado),
      vacioANulo(f.municipio),
      vacioANulo(f.equipo),
      f.tieneAsesoria ? 'SI' : 'NO',
      f.registros,
      f.primera,
      f.ultima,
    ])
  }
  cruce.views = [{ state: 'frozen', ySplit: 1 }]
  cruce.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, r.filas.length + 1), column: ENCABEZADOS_CRUCE.length } }

  // --- Sin match
  const sin = libro.addWorksheet('Asesoría sin match en Excel')
  ;[16, 34, 12].forEach((w, i) => {
    sin.getColumn(i + 1).width = w
  })
  sin.addRow(['Documento (BD)', 'Nombre (BD)', 'N° registros'])
  estiloEncabezado(sin.getRow(1))
  for (const s of r.sinMatch) sin.addRow([s.documento, vacioANulo(s.nombre), s.registros])
  sin.views = [{ state: 'frozen', ySplit: 1 }]

  return libro
}
