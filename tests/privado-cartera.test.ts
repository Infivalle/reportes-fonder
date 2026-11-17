import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { leerCartera, normalizarEncabezado, ubicarColumnas, valorTexto } from '../src/privado/cartera'

async function libro(armar: (h: ExcelJS.Worksheet) => void, nombre = 'DETALLE FONDER'): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  armar(wb.addWorksheet(nombre))
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}
const ENC = ['ID de solicitud', 'Cédula', 'Nombre', 'Año', 'Estado depurado', 'Municipio residencia', 'Equipo']

describe('encabezados', () => {
  it('normaliza tildes, mayúsculas y signos', () => {
    expect(normalizarEncabezado(' Año ')).toBe('ano')
    expect(normalizarEncabezado('Estado  depurado:')).toBe('estado depurado')
  })
  it('lista las columnas obligatorias que faltan', () => {
    expect(ubicarColumnas(['Cédula', 'Nombre'])).toEqual({ faltan: ['Año', 'Estado depurado'] })
  })
  it('valorTexto entiende texto enriquecido, fórmulas y fechas', () => {
    expect(valorTexto({ richText: [{ text: 'Ca' }, { text: 'li' }] })).toBe('Cali')
    expect(valorTexto({ formula: 'A1', result: 12 })).toBe('12')
    expect(valorTexto(null)).toBe('')
    expect(valorTexto(Number.NaN)).toBe('')
  })
})

describe('leerCartera', () => {
  it('lee con el encabezado en la fila 4 y descarta filas vacías', async () => {
    const buf = await libro((h) => {
      h.addRow(['Título']); h.addRow([]); h.addRow([])
      h.addRow(ENC)
      h.addRow([1, 29685667, 'ANA', 2024, 'Vigente', 'Cali', 'Equipo A'])
      h.addRow([2, '  16221309 ', 'LUIS', '2026', 'Mora', 'Tuluá', null])
      h.addRow([])
      h.addRow([3, null, 'SIN CÉDULA', 2026, 'Mora', null, null])
    })
    const filas = await leerCartera(buf)
    expect(filas).toEqual([
      { cedula: '29685667', nombre: 'ANA', anio: 2024, estado: 'Vigente', municipio: 'Cali', equipo: 'Equipo A' },
      { cedula: '16221309', nombre: 'LUIS', anio: 2026, estado: 'Mora', municipio: 'Tuluá', equipo: '' },
      { cedula: '', nombre: 'SIN CÉDULA', anio: 2026, estado: 'Mora', municipio: '', equipo: '' },
    ])
  })
  it('encuentra el encabezado aunque no esté en la fila 4', async () => {
    const buf = await libro((h) => { h.addRow(ENC); h.addRow([1, 5, 'A', 2024, 'Vigente', 'Cali', '']) })
    expect(await leerCartera(buf)).toHaveLength(1)
  })
  it('sin la hoja esperada explica cuáles hojas hay', async () => {
    await expect(leerCartera(await libro((h) => h.addRow(ENC), 'Otra'))).rejects.toThrow(/DETALLE FONDER.*Otra/)
  })
  it('sin columnas obligatorias dice cuáles faltan', async () => {
    await expect(leerCartera(await libro((h) => h.addRow(['Cédula', 'Nombre'])))).rejects.toThrow(/Año, Estado depurado/)
  })
  it('un archivo que no es Excel da un mensaje claro', async () => {
    await expect(leerCartera(new TextEncoder().encode('hola').buffer as ArrayBuffer)).rejects.toThrow(/No se pudo abrir/)
  })
  it('sin filas de datos se rechaza', async () => {
    await expect(leerCartera(await libro((h) => h.addRow(ENC)))).rejects.toThrow(/no tiene filas/)
  })
})
