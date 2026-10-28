// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// jsdom no tiene layout ni ResizeObserver: el lienzo real de ECharts se prueba en graficas-ui.test.tsx.
vi.mock('../src/graficas/Echarts', () => ({ Echarts: () => null }))
import { Aplicacion } from '../src/interfaz/Aplicacion'
import type { FilaPublica, PublicoJson } from '../src/publico/tipos'

const P1 = 'Fonder Valle Primera Convocatoria'
const P2 = 'FONDERVALLE SEGUNDA CONVOCATORIA'

let n = 0
function fila(o: Partial<FilaPublica>): FilaPublica {
  n += 1
  return {
    id: `a${n}`, beneficiario: `b${n}`, proyecto: P1, municipio_codigo: '76001', mes: '2026-10',
    credit_used_as_approved: null, time_to_results: null, results_as_expected: null, financial_records: null,
    resource_manager: null, payments_on_schedule: null, satisfaction: 'Muy satisfecho', need_another_credit: null,
    current_employees: null, rango_ingreso_mensual: null, rango_costos_fijos: null, rango_costos_variables: null,
    rango_cuota_mensual: null, rango_reserva_emergencia: null, rango_ventas_total: null, rango_clientes_mes: null,
    rango_ventas_mes: null, credit_used_percentage: null, debt_level: null, mejoras: [], canales: [], atipica: false, ...o,
  }
}

function datos(): PublicoJson {
  const asesorias = [
    fila({ proyecto: P1, municipio_codigo: '76001', mes: '2026-10', satisfaction: 'Muy satisfecho' }),
    fila({ proyecto: P1, municipio_codigo: '76001', mes: '2026-10', satisfaction: 'Satisfecho' }),
    fila({ proyecto: P2, municipio_codigo: '76834', mes: '2026-11', satisfaction: 'Insatisfecho' }),
    fila({ proyecto: P2, municipio_codigo: '76834', mes: '2026-11', satisfaction: 'Insatisfecho' }),
  ]
  return {
    version: 1, generado_en: '2026-10-28T10:00:00Z', fecha_corte: '2026-10-28T15:00:00Z', fuente_municipio: 'empresa',
    totales: { asesorias_conservadas: 4, asesorias_descartadas: 0, beneficiarios_con_asesoria: 4 },
    denominadores: [{ proyecto: P1, total_beneficiarios: 8 }, { proyecto: 'Fonder Valle Segunda Convocatoria', total_beneficiarios: 12 }],
    asesorias, agregados: [],
  }
}

const tarjeta = (nombre: string) => screen.getByRole('article', { name: nombre })
const valorDe = (nombre: string) => tarjeta(nombre).querySelector('.tarjeta__valor')?.textContent ?? ''

function simularFetch(json: unknown = datos(), ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 404, json: async () => json }))
}

beforeEach(() => {
  window.history.replaceState(null, '', '#')
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Aplicacion: estados', () => {
  it('muestra el error si publico.json no carga', async () => {
    simularFetch({}, false)
    render(<Aplicacion />)
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404')
    expect(screen.getByRole('navigation', { name: 'Secciones del sitio' })).toBeInTheDocument()
  })
  it('muestra el aviso del contenido vacío', async () => {
    simularFetch({ version: 1, vacio: true, motivo: 'Aún sin carga.', generado_en: 'x' })
    render(<Aplicacion />)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Aún sin carga.'))
    expect(screen.queryByRole('region', { name: 'Filtros' })).not.toBeInTheDocument()
  })
})

describe('Aplicacion: navegación y filtros', () => {
  it('carga con encabezado, pestañas, filtros e indicadores', async () => {
    simularFetch()
    render(<Aplicacion />)
    expect(await screen.findByRole('heading', { name: 'Indicadores de las asesorías' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Asesorías Fonder Valle' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Indicadores' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Mis gráficas' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('las opciones de los filtros salen de los datos y la convocatoria no se duplica', async () => {
    simularFetch()
    render(<Aplicacion />)
    await screen.findByRole('region', { name: 'Filtros' })
    const textos = (etq: string) => within(screen.getByLabelText(etq)).getAllByRole('option').map((o) => o.textContent)
    expect(textos('Convocatoria')).toEqual(['Todas las convocatorias', 'Primera convocatoria', 'Segunda convocatoria'])
    expect(textos('Municipio')).toEqual(['Todos los municipios', 'Cali', 'Tuluá'])
    expect(textos('Mes de la asesoría')).toEqual(['Todos los meses', 'Noviembre de 2026', 'Octubre de 2026'])
  })

  it('al filtrar recalcula, escribe el filtro en la URL y no agrega historial', async () => {
    simularFetch()
    render(<Aplicacion />)
    await screen.findByRole('region', { name: 'Filtros' })
    const antes = window.history.length
    await userEvent.selectOptions(screen.getByLabelText('Convocatoria'), 'Primera convocatoria')
    expect(valorDe('Satisfacción')).toBe('100 %')
    expect(within(tarjeta('Cobertura')).getByText('2 de 8 beneficiarios con asesoría.')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/indicadores?conv=fondervalleprimeraconvocatoria')
    expect(window.history.length).toBe(antes)
  })

  it('un enlace con filtros llega ya filtrado', async () => {
    window.history.replaceState(null, '', '#/indicadores?conv=fondervalleprimeraconvocatoria&mun=76001')
    simularFetch()
    render(<Aplicacion />)
    await screen.findByRole('region', { name: 'Filtros' })
    expect(screen.getByLabelText('Convocatoria')).toHaveValue('fondervalleprimeraconvocatoria')
    expect(screen.getByLabelText('Municipio')).toHaveValue('76001')
    expect(valorDe('Satisfacción')).toBe('100 %')
  })

  it('un filtro que no existe en los datos se ignora y no deja la pantalla vacía', async () => {
    window.history.replaceState(null, '', '#/indicadores?conv=otroproyecto&mun=76890&mes=2020-01')
    simularFetch()
    render(<Aplicacion />)
    await screen.findByRole('region', { name: 'Filtros' })
    expect(screen.getByLabelText('Convocatoria')).toHaveValue('')
    expect(screen.queryByText(/No hay asesorías para este filtro/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).not.toBeInTheDocument()
  })

  it('con un municipio filtrado la cobertura dice "Sin dato" y explica por qué', async () => {
    simularFetch()
    render(<Aplicacion />)
    await screen.findByRole('region', { name: 'Filtros' })
    await userEvent.selectOptions(screen.getByLabelText('Municipio'), 'Tuluá')
    expect(valorDe('Cobertura')).toBe('Sin dato')
    expect(within(tarjeta('Cobertura')).getByText(/solo está disponible por convocatoria/)).toBeInTheDocument()
    expect(valorDe('Satisfacción')).toBe('0 %')
  })

  it('el filtro de mes recalcula', async () => {
    simularFetch()
    render(<Aplicacion />)
    await screen.findByRole('region', { name: 'Filtros' })
    await userEvent.selectOptions(screen.getByLabelText('Mes de la asesoría'), 'Octubre de 2026')
    expect(valorDe('Satisfacción')).toBe('100 %')
  })

  it('"Quitar filtros" aparece solo con filtros activos y los limpia', async () => {
    simularFetch()
    render(<Aplicacion />)
    await screen.findByRole('region', { name: 'Filtros' })
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Municipio'), 'Cali')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(screen.getByLabelText('Municipio')).toHaveValue('')
    expect(window.location.hash).toBe('#/indicadores')
  })

  it('los filtros viajan entre secciones y el enlace de la pestaña los conserva', async () => {
    simularFetch()
    render(<Aplicacion />)
    await screen.findByRole('region', { name: 'Filtros' })
    await userEvent.selectOptions(screen.getByLabelText('Convocatoria'), 'Segunda convocatoria')
    const enlace = screen.getByRole('link', { name: 'Mis gráficas' })
    expect(enlace).toHaveAttribute('href', '#/graficas?conv=fondervallesegundaconvocatoria')

    await userEvent.click(enlace)
    expect(await screen.findByRole('heading', { name: 'Mis gráficas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mis gráficas' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Convocatoria')).toHaveValue('fondervallesegundaconvocatoria')
  })
})
