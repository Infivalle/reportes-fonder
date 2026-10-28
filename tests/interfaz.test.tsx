// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Encabezado } from '../src/interfaz/Encabezado'
import { PaginaIndicadores } from '../src/interfaz/PaginaIndicadores'
import { VistaIndicadores } from '../src/interfaz/VistaIndicadores'
import type { FilaPublica, PublicoJson } from '../src/publico/tipos'

const P1 = 'Fonder Valle Primera Convocatoria'
const P2 = 'FONDERVALLE SEGUNDA CONVOCATORIA'

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
  vi.unstubAllGlobals()
})

describe('VistaIndicadores', () => {
  it('muestra los indicadores del resumen y del detalle y la fecha de corte', () => {
    render(<VistaIndicadores datos={datos([{ proyecto: P1, total_beneficiarios: 8 }, { proyecto: 'Fonder Valle Segunda Convocatoria', total_beneficiarios: 12 }])} />)
    for (const t of ['Cobertura', 'Cubrimiento de municipios', 'Satisfacción', 'Detalle de satisfacción', 'Resultados esperados', 'Pagos al día', 'Necesidad de nuevo crédito', 'Crédito utilizado', 'Empleo']) {
      expect(tarjeta(t)).toBeInTheDocument()
    }
    expect(screen.getByText(/Fecha de corte: 28 de octubre de 2026/)).toBeInTheDocument()
    expect(valorDe('Cobertura')).toBe('20 %')
    expect(within(tarjeta('Cobertura')).getByText('4 de 20 beneficiarios con asesoría.')).toBeInTheDocument()
    expect(valorDe('Satisfacción')).toBe('50 %')
  })

  it('el filtro por proyecto recalcula, y los dos nombres del mismo proyecto no se duplican', async () => {
    render(<VistaIndicadores datos={datos([{ proyecto: P1, total_beneficiarios: 8 }])} />)
    const opciones = screen.getAllByRole('option').map((o) => o.textContent)
    expect(opciones).toEqual(['Todas las convocatorias', 'Primera convocatoria', 'Segunda convocatoria'])

    await userEvent.selectOptions(screen.getByLabelText('Convocatoria'), 'Primera convocatoria')
    expect(valorDe('Satisfacción')).toBe('100 %')
    expect(within(tarjeta('Cobertura')).getByText('2 de 8 beneficiarios con asesoría.')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Convocatoria'), 'Segunda convocatoria')
    expect(valorDe('Satisfacción')).toBe('0 %')
  })

  it('sin denominador la cobertura dice "Sin dato" en vez de inventar un porcentaje', () => {
    render(<VistaIndicadores datos={datos([])} />)
    const c = tarjeta('Cobertura')
    expect(valorDe('Cobertura')).toBe('Sin dato')
    expect(within(c).getByText(/Falta cargar el total/)).toBeInTheDocument()
  })

  it('no muestra "n = … respuestas" ni pie de página; el método va en un desplegable', () => {
    render(<VistaIndicadores datos={datos([])} />)
    expect(screen.queryByText(/n = /)).not.toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
    expect(screen.getByText('¿Cómo se calculan los indicadores?')).toBeInTheDocument()
  })

  it('el cubrimiento de municipios y la cobertura traen barra de progreso', () => {
    render(<VistaIndicadores datos={datos([{ proyecto: P1, total_beneficiarios: 8 }, { proyecto: 'Fonder Valle Segunda Convocatoria', total_beneficiarios: 12 }])} />)
    expect(valorDe('Cubrimiento de municipios')).toBe('1 de 42')
    expect(within(tarjeta('Cubrimiento de municipios')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(within(tarjeta('Cobertura')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20')
    expect(within(tarjeta('Satisfacción')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  })

  it('avisa cuando hay pocas respuestas', () => {
    render(<VistaIndicadores datos={datos([])} />)
    expect(within(tarjeta('Satisfacción')).getByText(/Pocas respuestas/)).toBeInTheDocument()
  })

  it('separa el resumen del detalle con dos secciones con título', () => {
    render(<VistaIndicadores datos={datos([])} />)
    expect(screen.getByRole('region', { name: 'Resumen' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Detalle de las respuestas' })).toBeInTheDocument()
  })

  it('cada distribución tiene tabla accesible con sus casos', () => {
    render(<VistaIndicadores datos={datos([])} />)
    const t = within(tarjeta('Detalle de satisfacción')).getByRole('table', { name: 'Satisfacción con la asesoría' })
    expect(within(t).getByRole('row', { name: /Insatisfecho/ })).toHaveTextContent('2')
  })
})

describe('PaginaIndicadores', () => {
  it('muestra el error si publico.json no carga', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    render(<PaginaIndicadores />)
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404')
  })

  it('muestra el aviso cuando el archivo es el contenido vacío', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 1, vacio: true, motivo: 'Aún sin carga.', generado_en: 'x' }) }),
    )
    render(<PaginaIndicadores />)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Aún sin carga.'))
  })

  it('carga y muestra los indicadores', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => datos([]) }))
    render(<PaginaIndicadores />)
    expect(await screen.findByRole('heading', { name: 'Indicadores de las asesorías' })).toBeInTheDocument()
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
