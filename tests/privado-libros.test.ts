import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { construirLibroLimpio, COLUMNAS_ASESORIA, type AsesoriaDb, type BeneficiarioDb } from '../src/privado/libroLimpio'
import { calcularCruce } from '../src/privado/cruce'
import { construirLibroCruce } from '../src/privado/libroCruce'

const benef = (id: number, doc: string): BeneficiarioDb => ({
  id, documento: doc, nombres: 'Ana', apellidos: 'Pérez', email: 'ana@ejemplo.test', celular: '3000000000', departamento: 'Valle', ciudad: 'Cali',
  nombre_empresa: 'Tienda Uno', nit: '900', actividad_economica: 'Comercio', municipio_codigo: '76001', municipio_origen: 'empresa', municipio_empresa: 'Cali',
  tipo_empresa: null, anio_fundacion: 2020, empleos_generados: '1 a 3', empleos_a_generar: null, patrimonio: 1500000, pasivos: null, dinero_solicitado: null, cuotas: null,
})
const ases = (id: number, b: number, extra: Partial<AsesoriaDb> = {}): AsesoriaDb => ({
  id, beneficiario_id: b, credit_used_as_approved: 'Sí', credit_usage_description: 'Compré insumos', other_improvement: null, time_to_results: null, results_as_expected: 'Sí',
  results_explanation: null, financial_records: 'No', resource_manager: null, other_resource_manager: null, payments_on_schedule: 'Sí', payment_explanation: null,
  satisfaction: 'Satisfecho', need_another_credit: 'Tal vez', credit_intended_use: null, monthly_income: 2500000, fixed_costs: null, variable_costs: null, debt_level: 12.5,
  credit_used_percentage: 80, monthly_payment: null, emergency_reserve: null, monthly_clients: 30, monthly_sales: null, total_sales_value: null, current_employees: 'De 1 a 5',
  other_sales_channel: null, estado: null, observaciones: null, creada_en: '2026-11-03T05:30:00Z', actualizada_en: null, conservada: true, motivo_descarte: null, atipica: false, ...extra,
})

async function releer(wb: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const n = new ExcelJS.Workbook()
  await n.xlsx.load((await wb.xlsx.writeBuffer()) as ArrayBuffer)
  return n
}

describe('libro de data limpia', async () => {
  const wb = await releer(
    construirLibroLimpio(
      {
        beneficiarios: [benef(1, '111'), benef(2, '222')],
        asesorias: [ases(10, 1), ases(11, 1, { conservada: false, motivo_descarte: 'Duplicado a menos de 30 días', creada_en: '2026-11-04T00:00:00Z' }), ases(12, 2)],
        mejoras: [{ asesoria_id: 10, codigo: 'AI' }, { asesoria_id: 10, codigo: 'CT' }, { asesoria_id: 11, codigo: 'AA' }, { asesoria_id: 12, codigo: 'ZZ' }],
        canales: [{ asesoria_id: 10, codigo: 'RS' }],
        proyectos: new Map([[1, ['Fonder Valle Primera Convocatoria']]]),
        carga: { id: 7, archivo: 'asesorias.tsv', formato: 'v2', filas_leidas: 3, asesorias_conservadas: 2, asesorias_descartadas: 1, beneficiarios_distintos: 2, creada_en: '2026-11-13T21:16:00Z' },
      },
      { generadoPor: 'admin@ejemplo.test', generadoEn: new Date('2026-11-17T13:00:00Z') },
    ),
  )
  const col = (_h: ExcelJS.Worksheet, titulo: string) => COLUMNAS_ASESORIA.findIndex((c) => c.titulo === titulo) + 1

  it('crea las seis hojas', () => {
    expect(wb.worksheets.map((h) => h.name)).toEqual(['Asesorías conservadas', 'Mejoras', 'Canales de venta', 'Descartadas', 'Diccionario de campos', 'Metadatos'])
  })
  it('una fila por asesoría conservada, con etiquetas traducidas y hora de Colombia', () => {
    const h = wb.getWorksheet('Asesorías conservadas')!
    expect(h.rowCount).toBe(3)
    expect(h.getRow(2).getCell(col(h, 'Mejoras logradas')).value).toBe('Aumento de ingresos, Capital de trabajo')
    expect(h.getRow(2).getCell(col(h, 'Canales de venta')).value).toBe('Redes sociales')
    expect(h.getRow(2).getCell(col(h, 'Municipio')).value).toBe('Cali')
    expect(h.getRow(2).getCell(col(h, 'Fecha asesoría (UTC)')).value).toBe('2026-11-03 05:30:00')
    expect(h.getRow(2).getCell(col(h, 'Fecha asesoría (hora Colombia)')).value).toBe('2026-11-03 00:30:00')
    expect(h.getRow(3).getCell(col(h, 'Mejoras logradas')).value).toBe('ZZ')
  })
  it('las descartadas solo salen en su hoja, con el motivo', () => {
    const d = wb.getWorksheet('Descartadas')!
    expect(d.rowCount).toBe(2)
    expect(d.getRow(2).getCell(5).value).toBe('Duplicado a menos de 30 días')
    expect(wb.getWorksheet('Mejoras')!.rowCount).toBe(1 + 3) // AI, CT y ZZ; la mejora de la descartada no
  })
  it('no incluye archivos de evidencia y los metadatos informan la carga', () => {
    expect(COLUMNAS_ASESORIA.some((c) => /evidence/i.test(c.origen))).toBe(false)
    const m = wb.getWorksheet('Metadatos')!
    const texto = (m.getSheetValues() as unknown[]).flat().join('|')
    expect(texto).toContain('asesorias.tsv')
    expect(texto).toContain('admin@ejemplo.test')
  })
})

describe('libro del cruce', () => {
  it('con la cartera vacía de coincidencias igual genera las tres hojas', async () => {
    const r = calcularCruce([{ cedula: '1', nombre: 'A', anio: 2024, estado: 'Vigente', municipio: 'Cali', equipo: '' }], [], [])
    const n = new ExcelJS.Workbook()
    await n.xlsx.load((await construirLibroCruce(r, { origen: 'prueba' }).xlsx.writeBuffer()) as ArrayBuffer)
    expect(n.worksheets.map((h) => h.name)).toEqual(['Resumen', 'Cruce', 'Asesoría sin match en Excel'])
    expect(n.getWorksheet('Resumen')!.getCell('A1').value).toBe('Cruce Excel Fonder vs asesorías (prueba)')
    expect(n.getWorksheet('Cruce')!.getRow(2).getCell(7).value).toBe('NO')
  })
})
