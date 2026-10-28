// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { claveProyecto } from '../src/indicadores/proyectos'
import { Encabezado } from '../src/interfaz/Encabezado'
import { VistaIndicadores } from '../src/interfaz/VistaIndicadores'
import type { FilaPublica, PublicoJson } from '../src/publico/tipos'

const P1 = 'Fonder Valle Primera Convocatoria'
const P2 = 'FONDERVALLE SEGUNDA CONVOCATORIA'
const SIN = { proyecto: null } as const

let n = 0
function fila(o: Partial<FilaPublica>): FilaPublica {
  n += 1
  return {
    id: `a${n}`,
    beneficiario: `b${n}`,
    proyecto: P1,
    municipio_codigo: '76001',
    mes: '2026-10',
    credit_used_as_approved: 'Sí',
    time_to_results: '1 mes',
    results_as_expected: 'Sí',
    financial_records: 'Sí',
    resource_manager: 'El beneficiario',
    payments_on_schedule: 'Sí',
    satisfaction: 'Muy satisfecho',
    need_another_credit: 'No',
    current_employees: 'De 1 a 5',
    rango_ingreso_mensual: null,
    rango_costos_fijos: null,
    rango_costos_variables: null,
    rango_cuota_mensual: null,
    rango_reserva_emergencia: null,
    rango_ventas_total: null,
    rango_clientes_mes: null,
    rango_ventas_mes: null,
    credit_used_percentage: 60,
    debt_level: 10,
    mejoras: [],
    canales: [],
    atipica: false,
    ...o,
  }
}

function datos(denominadores: PublicoJson['denominadores']): PublicoJson {
  const asesorias = [
    fila({ proyecto: P1, satisfaction: 'Muy satisfecho' }),
    fila({ proyecto: P1, satisfaction: 'Satisfecho' }),
    fila({ proyecto: P2, satisfaction: 'Insatisfecho' }),
    fila({ proyecto: P2, satisfaction: 'Insatisfecho' }),
  ]
  return {
    version: 1,
    generado_en: '2026-10-28T10:00:00Z',
    fecha_corte: '2026-10-28T15:00:00Z',
    fuente_municipio: 'residencia',
    totales: { asesorias_conservadas: 4, asesorias_descartadas: 0, beneficiarios_con_asesoria: 4 },
    denominadores,
    asesorias,
    agregados: [],
  }
}

function tarjeta(nombre: string) {
  return screen.getByRole('article', { name: nombre })
}

/** Cifra principal de una tarjeta (la tabla repite porcentajes y confunde a getByText). */
function valorDe(nombre: string): string {
  return tarjeta(nombre).querySelector('.tarjeta__valor')?.textContent ?? ''
}

afterEach(() => {
  cleanup()
})

describe('VistaIndicadores', () => {
  it('muestra los indicadores del resumen y del detalle y la fecha de corte', () => {
    render(<VistaIndicadores datos={datos([{ proyecto: P1, total_beneficiarios: 8 }, { proyecto: 'Fonder Valle Segunda Convocatoria', total_beneficiarios: 12 }])} filtros={SIN} />)
    for (const t of ['Cobertura', 'Cubrimiento de municipios', 'Satisfacción', 'Detalle de satisfacción', 'Resultados esperados', 'Destino del crédito', 'Necesidad de nuevo crédito', 'Crédito utilizado', 'Empleo']) {
      expect(tarjeta(t)).toBeInTheDocument()
    }
    expect(screen.getByText(/Fecha de corte: 28 de octubre de 2026/)).toBeInTheDocument()
    expect(valorDe('Cobertura')).toBe('20 %')
    expect(within(tarjeta('Cobertura')).getByText('4 de 20 beneficiarios con asesoría.')).toBeInTheDocument()
    expect(valorDe('Satisfacción')).toBe('50 %')
  })

  it('recibe el filtro por convocatoria desde afuera y recalcula', () => {
    const d = datos([{ proyecto: P1, total_beneficiarios: 8 }])
    const { rerender } = render(<VistaIndicadores datos={d} filtros={{ proyecto: claveProyecto(P1) }} />)
    expect(valorDe('Satisfacción')).toBe('100 %')
    expect(within(tarjeta('Cobertura')).getByText('2 de 8 beneficiarios con asesoría.')).toBeInTheDocument()

    rerender(<VistaIndicadores datos={d} filtros={{ proyecto: claveProyecto(P2) }} />)
    expect(valorDe('Satisfacción')).toBe('0 %')
  })

  it('sin denominador la cobertura dice "Sin dato" en vez de inventar un porcentaje', () => {
    render(<VistaIndicadores datos={datos([])} filtros={SIN} />)
    const c = tarjeta('Cobertura')
    expect(valorDe('Cobertura')).toBe('Sin dato')
    expect(within(c).getByText(/Falta cargar el total/)).toBeInTheDocument()
  })

  it('no muestra "n = … respuestas" ni pie de página; el método va en un desplegable', () => {
    render(<VistaIndicadores datos={datos([])} filtros={SIN} />)
    expect(screen.queryByText(/n = /)).not.toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
    expect(screen.getByText('¿Cómo se calculan los indicadores?')).toBeInTheDocument()
  })

  it('el cubrimiento de municipios y la cobertura traen barra de progreso', () => {
    render(<VistaIndicadores datos={datos([{ proyecto: P1, total_beneficiarios: 8 }, { proyecto: 'Fonder Valle Segunda Convocatoria', total_beneficiarios: 12 }])} filtros={SIN} />)
    expect(valorDe('Cubrimiento de municipios')).toBe('1 de 42')
    expect(within(tarjeta('Cubrimiento de municipios')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(within(tarjeta('Cobertura')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20')
    expect(within(tarjeta('Satisfacción')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  })

  it('destino del crédito: muestra la mejora más frecuente y agrupa lo demás como Otros', () => {
    const d = datos([])
    d.asesorias = [
      fila({ mejoras: ['CT', 'AI'] }),
      fila({ mejoras: ['CT'] }),
      fila({ mejoras: ['O'] }),
      fila({ mejoras: [] }),
    ]
    render(<VistaIndicadores datos={d} filtros={SIN} />)
    expect(valorDe('Destino del crédito')).toBe('Capital de trabajo')
    const t = within(tarjeta('Destino del crédito')).getByRole('table')
    expect(within(t).getByRole('row', { name: /Otros/ })).toHaveTextContent('1')
    expect(screen.queryByText('Pagos al día')).not.toBeInTheDocument()
  })

  it('avisa cuando hay pocas respuestas', () => {
    render(<VistaIndicadores datos={datos([])} filtros={SIN} />)
    expect(within(tarjeta('Satisfacción')).getByText(/Pocas respuestas/)).toBeInTheDocument()
  })

  it('separa el resumen del detalle con dos secciones con título', () => {
    render(<VistaIndicadores datos={datos([])} filtros={SIN} />)
    expect(screen.getByRole('region', { name: 'Resumen' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Detalle de las respuestas' })).toBeInTheDocument()
  })

  it('cada distribución tiene tabla accesible con sus casos', () => {
    render(<VistaIndicadores datos={datos([])} filtros={SIN} />)
    const t = within(tarjeta('Detalle de satisfacción')).getByRole('table', { name: 'Satisfacción con la asesoría' })
    expect(within(t).getByRole('row', { name: /Insatisfecho/ })).toHaveTextContent('2')
  })
})

describe('Encabezado', () => {
  it('muestra el título y, si hay logos, sus imágenes con texto alternativo', () => {
    render(<Encabezado logos={[{ archivo: 'a.png', alt: 'Logo A' }]} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Asesorías Fonder Valle' })).toBeInTheDocument()
    expect(screen.getByAltText('Logo A')).toHaveAttribute('src', expect.stringContaining('logos/a.png'))
  })

  it('sin logos no dibuja ninguna imagen', () => {
    render(<Encabezado logos={[]} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
