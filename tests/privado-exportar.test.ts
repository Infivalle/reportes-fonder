import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { leerTabla } from '../src/privado/datosPrivados'
import { registrarExportacion } from '../src/privado/bitacora'
import { generarCruce, generarDataLimpia } from '../src/privado/exportar'
import { rolDe } from '../src/privado/rol'

/** Cliente de mentira: cada tabla devuelve sus filas; `bitacora.insert` se puede hacer fallar. */
function falso(tablas: Record<string, unknown[]>, fallaBitacora = false) {
  const insertados: unknown[] = []
  const cliente = {
    from: (t: string) => ({
      select: () => {
        let desde = 0
        let hasta = Number.MAX_SAFE_INTEGER
        const q: Record<string, unknown> = {
          order: () => q,
          limit: (n: number) => { hasta = n - 1; return q },
          range: (d: number, h: number) => { desde = d; hasta = h; return q },
          then: (ok: (v: unknown) => unknown) => ok({ data: (tablas[t] ?? []).slice(desde, hasta + 1), error: null }),
        }
        return q
      },
      insert: (fila: unknown) => {
        insertados.push(fila)
        return Promise.resolve({ error: fallaBitacora ? { message: 'no' } : null })
      },
    }),
  } as unknown as SupabaseClient
  return { cliente, insertados }
}

async function carteraXlsx(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  const h = wb.addWorksheet('DETALLE FONDER')
  h.addRow([]); h.addRow([]); h.addRow([])
  h.addRow(['Cédula', 'Nombre', 'Año', 'Estado depurado', 'Municipio residencia', 'Equipo'])
  h.addRow([111, 'ANA', 2024, 'Vigente', 'Cali', 'Equipo A'])
  h.addRow([222, 'LUIS', 2026, 'Mora', 'Tuluá', ''])
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

describe('leerTabla', () => {
  it('lee todas las páginas de 1.000 filas', async () => {
    const filas = Array.from({ length: 2500 }, (_, i) => ({ id: i }))
    const { cliente } = falso({ t: filas })
    expect(await leerTabla(cliente, 't', 'id', 'id')).toHaveLength(2500)
  })
  it('un error de lectura se informa con el nombre de la tabla', async () => {
    const cliente = { from: () => ({ select: () => { const q: Record<string, unknown> = { order: () => q, range: () => q, then: (ok: (v: unknown) => unknown) => ok({ data: null, error: { message: 'permiso' } }) }; return q } }) } as unknown as SupabaseClient
    await expect(leerTabla(cliente, 'asesorias', 'id', 'id')).rejects.toThrow(/asesorias.*permiso/)
  })
})

describe('exportaciones', () => {
  const tablas = {
    beneficiarios: [{ id: 1, documento: '111', nombres: 'Ana', apellidos: 'Pérez' }],
    asesorias: [{ id: 10, beneficiario_id: 1, creada_en: '2026-11-03T00:04:16Z' }],
    cargas: [{ id: 3, archivo: 'a.tsv', formato: 'v2', filas_leidas: 1, asesorias_conservadas: 1, asesorias_descartadas: 0, beneficiarios_distintos: 1, creada_en: '2026-11-13T21:16:00Z' }],
  }

  it('el cruce registra en bitácora solo cifras y entrega el archivo', async () => {
    const { cliente, insertados } = falso(tablas)
    const r = await generarCruce(cliente, 'u-1', await carteraXlsx(), () => {})
    expect(insertados).toEqual([{ usuario_id: 'u-1', accion: 'exporta_excel_cruce', detalle: { filas_cartera: 2, cedulas_distintas: 2, cedulas_con_asesoria: 1, filas_asesorias: 1, carga_id: 3 } }])
    expect(JSON.stringify(insertados)).not.toMatch(/111|Ana|Pérez/)
    expect(r.avisos).toEqual([])
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(r.contenido)
    expect(wb.getWorksheet('Resumen')!.getCell('A1').value).toBe('Cruce Excel Fonder vs asesorías (carga del 2026-11-13, 1 filas)')
    expect(wb.getWorksheet('Cruce')!.getRow(2).getCell(7).value).toBe('SI')
  })

  it('si la bitácora falla, no se entrega el archivo', async () => {
    const { cliente } = falso(tablas, true)
    await expect(generarCruce(cliente, 'u-1', await carteraXlsx(), () => {})).rejects.toThrow(/bitácora/)
    await expect(generarDataLimpia(cliente, { id: 'u-1', correo: 'a@b.test' }, () => {})).rejects.toThrow(/bitácora/)
  })

  it('avisa si la base no tiene las filas que dice la última carga', async () => {
    const { cliente } = falso({ ...tablas, cargas: [{ ...tablas.cargas[0]!, filas_leidas: 761 }] })
    const r = await generarCruce(cliente, 'u-1', await carteraXlsx(), () => {})
    expect(r.avisos[0]).toMatch(/761.*1 asesorías/)
  })

  it('registrarExportacion lanza si la inserción falla', async () => {
    const { cliente } = falso({}, true)
    await expect(registrarExportacion(cliente, 'u', 'exporta_excel_completo', {})).rejects.toThrow()
  })
})

describe('rolDe', () => {
  it('lee el rol de app_metadata y solo admite admin o asesor', () => {
    expect(rolDe({ app_metadata: { rol: 'admin' } })).toBe('admin')
    expect(rolDe({ app_metadata: { rol: 'asesor' } })).toBe('asesor')
    expect(rolDe({ app_metadata: { rol: 'superadmin' } })).toBeNull()
    expect(rolDe({ app_metadata: {} })).toBeNull()
    expect(rolDe(null)).toBeNull()
  })
  it('ignora un rol puesto en user_metadata', () => {
    expect(rolDe({ user_metadata: { rol: 'admin' } } as never)).toBeNull()
  })
})
