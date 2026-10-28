// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaginaGraficas } from '../src/interfaz/PaginaGraficas'
import type { FilaPublica, PublicoJson } from '../src/publico/tipos'

const lienzo = vi.hoisted(() => vi.fn())
vi.mock('../src/graficas/Echarts', () => ({
  Echarts: (props: { etiqueta: string }) => {
    lienzo(props)
    return <div data-testid="lienzo" role="img" aria-label={props.etiqueta} />
  },
}))

const P1 = 'Fonder Valle Primera Convocatoria'
const P2 = 'FONDERVALLE SEGUNDA CONVOCATORIA'
let n = 0
function fila(o: Partial<FilaPublica>): FilaPublica {
  n += 1
  return {
    id: `a${n}`, beneficiario: `b${n}`, proyecto: P1, municipio_codigo: '76001', mes: '2026-10', credit_used_as_approved: null,
    time_to_results: null, results_as_expected: null, financial_records: null, resource_manager: null, payments_on_schedule: null,
    satisfaction: 'Muy satisfecho', need_another_credit: null, current_employees: null, rango_ingreso_mensual: null,
    rango_costos_fijos: null, rango_costos_variables: null, rango_cuota_mensual: null, rango_reserva_emergencia: null,
    rango_ventas_total: null, rango_clientes_mes: null, rango_ventas_mes: null, credit_used_percentage: 60, debt_level: null,
    mejoras: ['CT'], canales: [], atipica: false, ...o,
  }
}
const muchas = (k: number, o: Partial<FilaPublica>) => Array.from({ length: k }, () => fila(o))

function datos(): PublicoJson {
  const asesorias = [
    ...muchas(6, { proyecto: P1, satisfaction: 'Muy satisfecho' }),
    ...muchas(2, { proyecto: P2, satisfaction: 'Satisfecho' }),
    ...muchas(5, { proyecto: P2, satisfaction: 'Muy satisfecho' }),
  ]
  return {
    version: 1, generado_en: 'x', fecha_corte: null, fuente_municipio: 'empresa',
    totales: { asesorias_conservadas: asesorias.length, asesorias_descartadas: 0, beneficiarios_con_asesoria: asesorias.length },
    denominadores: [], asesorias, agregados: [],
  }
}
const SIN = { proyecto: null, municipio: null, mes: null }
const ultimaOpcion = () => (lienzo.mock.calls.at(-1)![0] as { opcion: { series: { type: string }[] } }).opcion

beforeEach(() => lienzo.mockClear())
afterEach(cleanup)

describe('PaginaGraficas', () => {
  it('arranca con una gráfica de satisfacción, su base y su tabla de datos', () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    expect(screen.getByRole('heading', { name: 'Mis gráficas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Satisfacción' })).toBeInTheDocument()
    expect(screen.getByText(/Base: 13 beneficiarios con respuesta de 13/)).toBeInTheDocument()
    expect(screen.getByTestId('lienzo')).toHaveAttribute('aria-label', 'Gráfica: Satisfacción')
    const tabla = screen.getByRole('table', { name: 'Satisfacción', hidden: true })
    expect(within(tabla).getByRole('row', { name: /Muy satisfecho/, hidden: true })).toHaveTextContent('11')
  })

  it('los filtros globales cambian los datos de la gráfica', () => {
    render(<PaginaGraficas datos={datos()} filtros={{ ...SIN, proyecto: 'fondervallesegundaconvocatoria' }} />)
    expect(screen.getByText(/Base: 7 beneficiarios con respuesta de 7/)).toBeInTheDocument()
  })

  it('al elegir otro campo propone la gráfica de su tipo y solo ofrece las admitidas', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await userEvent.selectOptions(screen.getByLabelText('¿Qué quiere graficar?'), 'Destino del crédito (mejoras logradas)')
    expect(screen.getByLabelText('Tipo de gráfica')).toHaveValue('barras_horizontales')
    const tipos = within(screen.getByLabelText('Tipo de gráfica')).getAllByRole('option').map((o) => o.textContent)
    expect(tipos).toEqual(['Barras horizontales', 'Solo tabla'])
    expect(screen.getByRole('heading', { level: 3, name: 'Destino del crédito (mejoras logradas)' })).toBeInTheDocument()
  })

  it('comparar por otro campo agrupa y suprime las cifras de menos de 5', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await userEvent.selectOptions(screen.getByLabelText('Comparar por'), 'Convocatoria')
    expect(screen.getByRole('heading', { level: 3, name: 'Satisfacción por convocatoria' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/menos de 5 beneficiarios no se muestran/)
    const fila = screen.getByRole('row', { name: /^Satisfecho/, hidden: true })
    expect(fila).toHaveTextContent('<5')
  })

  it('la medida por categoría de un campo numérico exige elegir el campo de comparación', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await userEvent.selectOptions(screen.getByLabelText('¿Qué quiere graficar?'), 'Crédito utilizado (%)')
    expect(screen.getByLabelText('Tipo de gráfica')).toHaveValue('histograma')
    expect(screen.queryByLabelText('Comparar por')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Medida')).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Tipo de gráfica'), 'Barras por categoría')
    expect(screen.getByLabelText('Calcular por (obligatorio)')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/Elija un campo/)

    await userEvent.selectOptions(screen.getByLabelText('Calcular por (obligatorio)'), 'Convocatoria')
    expect(screen.getByRole('heading', { level: 3, name: 'Promedio de crédito utilizado (%) por convocatoria' })).toBeInTheDocument()
  })

  it('la barra apilada al 100 % no ofrece medida (siempre es porcentaje)', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await userEvent.selectOptions(screen.getByLabelText('Comparar por'), 'Convocatoria')
    await userEvent.selectOptions(screen.getByLabelText('Tipo de gráfica'), 'Barra apilada al 100 %')
    expect(screen.queryByLabelText('Medida')).not.toBeInTheDocument()
    expect(ultimaOpcion().series.every((s) => s.type === 'bar')).toBe(true)
  })

  it('la dona solo existe para campos categóricos y no ofrece comparación', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    // Satisfacción es ordinal: no tiene dona.
    expect(within(screen.getByLabelText('Tipo de gráfica')).queryByRole('option', { name: 'Dona' })).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('¿Qué quiere graficar?'), 'Convocatoria')
    await userEvent.selectOptions(screen.getByLabelText('Tipo de gráfica'), 'Dona')
    expect(screen.queryByLabelText('Comparar por')).not.toBeInTheDocument()
    expect(ultimaOpcion().series[0]!.type).toBe('pie')
  })

  it('"Solo tabla" no dibuja el lienzo y muestra la tabla a la vista', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await userEvent.selectOptions(screen.getByLabelText('Tipo de gráfica'), 'Solo tabla')
    expect(screen.queryByTestId('lienzo')).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Satisfacción' })).toBeVisible()
  })

  it('sin respuestas para el filtro, lo dice en vez de dibujar una gráfica vacía', () => {
    render(<PaginaGraficas datos={datos()} filtros={{ ...SIN, municipio: '76834' }} />)
    expect(screen.getByRole('status')).toHaveTextContent(/No hay respuestas/)
    expect(screen.queryByTestId('lienzo')).not.toBeInTheDocument()
  })
})
