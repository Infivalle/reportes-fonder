import { describe, expect, it } from 'vitest'
import { CANALES, CODIGOS_POR_CONFIRMAR, MEJORAS } from '../src/catalogo/codigos.ts'
import { OPCIONES_FORMULARIO } from '../src/catalogo/opciones.ts'
import { normalizarCategoria } from '../src/limpieza/categorias.ts'

describe('catálogo del formulario', () => {
  it('reconoce las opciones que antes salían fuera de catálogo', () => {
    const casos: [string, string][] = [
      ['creditusedasapproved', 'Parcialmente'],
      ['paymentsonschedule', 'Parcialmente'],
      ['needanothercredit', 'Tal vez'],
      ['satisfaction', 'Insatisfecho'],
      ['resultsasexpected', 'Todavía no se ha evidenciado'],
      ['timetoresults', 'Entre 1 y 6 meses'],
      ['resourcemanager', 'El beneficiario'],
    ]
    for (const [columna, valor] of casos) {
      const r = normalizarCategoria(valor, OPCIONES_FORMULARIO[columna] ?? [])
      expect(r, `${columna}: ${valor}`).toEqual({ valor, fueraDeCatalogo: false })
    }
  })

  it('un valor que no está en el formulario se sigue marcando', () => {
    const r = normalizarCategoria('Quizás', OPCIONES_FORMULARIO['needanothercredit'] ?? [])
    expect(r.fueraDeCatalogo).toBe(true)
  })

  it('el diccionario de códigos cubre las seis opciones de cada pregunta', () => {
    expect(Object.keys(MEJORAS).sort()).toEqual(['AA', 'AI', 'AM', 'CT', 'GE', 'O'])
    expect(Object.keys(CANALES).sort()).toEqual(['O', 'PT', 'RS', 'TE', 'TF', 'VC'])
  })

  it('los códigos por confirmar existen en alguno de los dos diccionarios', () => {
    for (const c of CODIGOS_POR_CONFIRMAR) expect(c in MEJORAS || c in CANALES).toBe(true)
  })
})
