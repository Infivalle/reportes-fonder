import { describe, expect, it } from 'vitest'
import { ensamblarPublico } from '../../src/publico/ensamblar.ts'
import type { FilaMetaVista, PublicoJson } from '../../src/publico/tipos.ts'
import { CLAVES_PROHIBIDAS, problemasPublico } from '../../src/publico/verificar.ts'

const META_BASE: FilaMetaVista = {
  ultima_carga: '2026-10-28T02:00:00Z',
  asesorias_conservadas: 1,
  asesorias_descartadas: 0,
  beneficiarios_con_asesoria: 1,
}

function ensamblar(meta: FilaMetaVista | undefined) {
  return ensamblarPublico([], [], [], meta, { generadoEn: '2026-10-28T12:00:00Z', aleatorio: () => 0.5 })
}

describe('fuente del municipio en publico.json', () => {
  it('una carga v2 declara la empresa', () => {
    expect(ensamblar({ ...META_BASE, ultimo_formato: 'v2' }).fuente_municipio).toBe('empresa')
  })

  it('una carga v1, sin dato de formato o sin meta declara la residencia', () => {
    expect(ensamblar({ ...META_BASE, ultimo_formato: 'v1' }).fuente_municipio).toBe('residencia')
    expect(ensamblar({ ...META_BASE, ultimo_formato: null }).fuente_municipio).toBe('residencia')
    expect(ensamblar(META_BASE).fuente_municipio).toBe('residencia')
    expect(ensamblar(undefined).fuente_municipio).toBe('residencia')
  })
})

describe('claves prohibidas del formato v2', () => {
  const NUEVAS = [
    'municipio_empresa', 'municipioempresa', 'tipo_empresa', 'tipoempresa',
    'anio_fundacion', 'aniofundacion', 'empleos_generados', 'empleosgenerado',
    'empleos_a_generar', 'empleosagenerar', 'patrimonio', 'pasivos',
    'dinero_solicitado', 'dinerosolicitado', 'cuotas',
  ]

  function publicoCon(extra: Record<string, unknown>): PublicoJson {
    const base = ensamblar({ ...META_BASE, ultimo_formato: 'v2' })
    return { ...base, ...extra } as PublicoJson
  }

  it.each(NUEVAS)('%s está en la lista', (clave) => {
    expect(CLAVES_PROHIBIDAS.has(clave)).toBe(true)
  })

  it.each(NUEVAS)('%s aparece en cualquier nivel del documento y se rechaza', (clave) => {
    const p = publicoCon({ totales: { asesorias_conservadas: 1, asesorias_descartadas: 0, beneficiarios_con_asesoria: 1, [clave]: 5 } })
    expect(problemasPublico(p).join('\n')).toContain(`${clave}: clave prohibida`)
  })

  it('un documento sin esas claves no tiene problemas', () => {
    expect(problemasPublico(publicoCon({}))).toEqual([])
  })
})
