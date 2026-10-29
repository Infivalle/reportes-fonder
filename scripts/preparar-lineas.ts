/**
 * Prepara la carga de líneas (Línea 1 / Línea 2) desde el Excel de beneficiarios netos.
 *
 *   npm run preparar-lineas -- data\beneficiarios_netos.xlsx
 *
 * Lee solo tres columnas (Cédula, Año, Línea), valida el archivo y escribe data/lineas.sql, que se
 * pega UNA vez en el SQL Editor de Supabase. El Excel y el SQL llevan cédulas: se quedan en este
 * computador (la carpeta data/ está fuera del repositorio) y nunca se suben.
 *
 * No recalcula la línea con los topes de monto: el Excel es la fuente de verdad.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import ExcelJS from 'exceljs'
import { procesarLineas, sqlDeCarga, type FilaExcel } from '../src/lineas/lineas.ts'

const SALIDA = 'data/lineas.sql'
const FILAS_PARA_ENCABEZADO = 30

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Valor simple de una celda de ExcelJS (texto, número, fórmula con resultado, texto enriquecido). */
function valorCelda(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null
  if (typeof v !== 'object') return v
  if (v instanceof Date) return v.getFullYear()
  if ('result' in v) return valorCelda(v.result as ExcelJS.CellValue)
  if ('richText' in v) return v.richText.map((t) => t.text).join('')
  if ('text' in v) return String(v.text)
  return null
}

async function main() {
  const ruta = process.argv[2]
  if (!ruta) throw new Error('Indique el Excel: npm run preparar-lineas -- data\\beneficiarios_netos.xlsx')

  const libro = new ExcelJS.Workbook()
  await libro.xlsx.readFile(ruta)

  // Se busca, en cada hoja, una fila de encabezados con Cédula, Año y Línea.
  for (const hoja of libro.worksheets) {
    for (let r = 1; r <= Math.min(FILAS_PARA_ENCABEZADO, hoja.rowCount); r++) {
      const columnas: Record<string, number> = {}
      hoja.getRow(r).eachCell((celda, c) => {
        const t = sinTildes(String(valorCelda(celda.value) ?? ''))
        if (t === 'cedula' || t === 'ano' || t === 'linea') columnas[t] ??= c
      })
      if (!columnas['cedula'] || !columnas['ano'] || !columnas['linea']) continue

      const filas: FilaExcel[] = []
      for (let i = r + 1; i <= hoja.rowCount; i++) {
        const fila = hoja.getRow(i)
        filas.push({
          fila: i,
          cedula: valorCelda(fila.getCell(columnas['cedula']).value),
          anio: valorCelda(fila.getCell(columnas['ano']).value),
          linea: valorCelda(fila.getCell(columnas['linea']).value),
        })
      }

      const res = procesarLineas(filas)
      console.log(`Hoja "${hoja.name}", encabezados en la fila ${r}.`)
      console.log(`  Filas con datos: ${res.leidas}`)
      console.log(`  Personas distintas: ${res.desembolsos.length} (Línea 1: ${res.porLinea['Línea 1']}, Línea 2: ${res.porLinea['Línea 2']})`)
      console.log(`  Cédulas repetidas (se conservó el año más reciente): ${res.repetidas}`)
      if (res.errores.length > 0) {
        console.error('✗ El archivo tiene problemas y no se generó el SQL:')
        for (const e of res.errores) console.error(`  - ${e}`)
        process.exit(1)
      }
      mkdirSync(dirname(SALIDA), { recursive: true })
      writeFileSync(SALIDA, sqlDeCarga(res.desembolsos))
      console.log(`✓ ${SALIDA} listo. Péguelo en el SQL Editor de Supabase y ejecútelo.`)
      return
    }
  }
  throw new Error('No encontré una fila de encabezados con las columnas Cédula, Año y Línea.')
}

main().catch((e: unknown) => {
  console.error('✗', e instanceof Error ? e.message : 'error desconocido')
  process.exit(1)
})
