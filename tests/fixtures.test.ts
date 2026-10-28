import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COLUMNAS_V1, NUM_COLUMNAS_V1 } from '../src/formato/v1.ts'
import { leerTsv } from '../src/limpieza/tsv.ts'

function cargar(nombre: string) {
  const ruta = new URL(`./fixtures/${nombre}`, import.meta.url)
  return leerTsv(readFileSync(ruta, 'utf-8'))
}

describe('formato v1', () => {
  it('define 52 columnas sin repetidas', () => {
    expect(NUM_COLUMNAS_V1).toBe(52)
    expect(new Set(COLUMNAS_V1).size).toBe(52)
  })
})

describe('fixture sintético válido', () => {
  const { encabezado, filas } = cargar('asesorias_v1_sintetico.tsv')

  it('el encabezado coincide exactamente con el formato v1', () => {
    expect(encabezado).toEqual([...COLUMNAS_V1])
  })

  it('todas las filas tienen 52 columnas', () => {
    expect(filas).toHaveLength(11)
    for (const fila of filas) expect(fila).toHaveLength(NUM_COLUMNAS_V1)
  })

  it('el texto NULL se lee como nulo', () => {
    const iCredito = COLUMNAS_V1.indexOf('idimprovements')
    expect(filas[0]?.[iCredito]).toBeNull()
  })

  it('contiene 2 duplicados exactos (mismo beneficiario y mismo segundo)', () => {
    const iBenef = COLUMNAS_V1.indexOf('idbeneficiario')
    const iFecha = COLUMNAS_V1.indexOf('created_at')
    const vistos = new Set<string>()
    let duplicados = 0
    for (const fila of filas) {
      const clave = `${fila[iBenef]}|${fila[iFecha]}`
      if (vistos.has(clave)) duplicados++
      vistos.add(clave)
    }
    expect(duplicados).toBe(2)
  })

  it('no contiene datos reales: documentos y correos son inventados', () => {
    const iDoc = COLUMNAS_V1.indexOf('documento')
    const iMail = COLUMNAS_V1.indexOf('email')
    for (const fila of filas) {
      expect(fila[iDoc]).toMatch(/^99000\d{3}$/)
      expect(fila[iMail]).toMatch(/@ejemplo\.invalid$/)
    }
  })
})

describe('fixtures que deben rechazarse', () => {
  it('línea rota: hay una fila con menos columnas', () => {
    const { encabezado, filas } = cargar('asesorias_v1_linea_rota.tsv')
    expect(encabezado).toEqual([...COLUMNAS_V1])
    expect(filas.some((f) => f.length !== NUM_COLUMNAS_V1)).toBe(true)
  })

  it('encabezado desconocido: no coincide con el formato v1', () => {
    const { encabezado } = cargar('asesorias_encabezado_desconocido.tsv')
    expect(encabezado).not.toEqual([...COLUMNAS_V1])
    expect(encabezado).toHaveLength(NUM_COLUMNAS_V1 - 1)
  })
})
