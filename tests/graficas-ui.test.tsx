// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaginaGraficas } from '../src/interfaz/PaginaGraficas'
import { CLAVE_TABLERO } from '../src/tablero/almacen'
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
    mejoras: ['CT'], canales: [], atipica: false, linea: null, ...o,
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

const UNA = JSON.stringify({ version: 1, tarjetas: [{ id: 's1', def: { campo: 'satisfaction', grafica: 'barras', medida: 'conteo', desglose: null }, filtros: {} }] })
// Casi todas las pruebas parten de un tablero con una sola gráfica; la primera visita se prueba aparte.
beforeEach(() => {
  lienzo.mockClear()
  localStorage.clear()
  localStorage.setItem(CLAVE_TABLERO, UNA)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const abrirEditor = async (titulo = 'Satisfacción') => {
  await userEvent.click(screen.getByRole('button', { name: `Editar: ${titulo}` }))
  return screen.getByRole('dialog', { name: 'Editar gráfica' })
}

describe('PaginaGraficas: una gráfica', () => {
  it('arranca con una gráfica de satisfacción, su base y su tabla de datos', () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    expect(screen.getByRole('heading', { name: 'Mis gráficas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Satisfacción' })).toBeInTheDocument()
    expect(screen.getByText(/Base: 13 beneficiarios con respuesta de 13/)).toBeInTheDocument()
    expect(screen.getByTestId('lienzo')).toHaveAttribute('aria-label', 'Gráfica: Satisfacción')
    const tabla = screen.getByRole('table', { name: 'Satisfacción', hidden: true })
    expect(within(tabla).getByRole('row', { name: /Muy satisfecho/, hidden: true })).toHaveTextContent('11')
  })

  it('el constructor no ocupa la pantalla: solo existe dentro del panel de edición', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    expect(screen.queryByLabelText('Tipo de gráfica')).not.toBeInTheDocument()
    const panel = await abrirEditor()
    expect(within(panel).getByLabelText('Tipo de gráfica')).toBeInTheDocument()
  })

  it('los filtros globales cambian los datos de la gráfica', () => {
    render(<PaginaGraficas datos={datos()} filtros={{ ...SIN, proyecto: 'fondervallesegundaconvocatoria' }} />)
    expect(screen.getByText(/Base: 7 beneficiarios con respuesta de 7/)).toBeInTheDocument()
  })

  it('sin respuestas para el filtro, lo dice en vez de dibujar una gráfica vacía', () => {
    render(<PaginaGraficas datos={datos()} filtros={{ ...SIN, municipio: '76834' }} />)
    expect(screen.getByRole('status')).toHaveTextContent(/No hay respuestas/)
    expect(screen.queryByTestId('lienzo')).not.toBeInTheDocument()
  })
})

describe('PaginaGraficas: constructor en el panel', () => {
  it('al elegir otro campo propone la gráfica de su tipo y solo ofrece las admitidas', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    const panel = await abrirEditor()
    await userEvent.selectOptions(within(panel).getByLabelText('¿Qué quiere graficar?'), 'Destino del crédito (mejoras logradas)')
    expect(within(panel).getByLabelText('Tipo de gráfica')).toHaveValue('barras_horizontales')
    const tipos = within(within(panel).getByLabelText('Tipo de gráfica')).getAllByRole('option').map((o) => o.textContent)
    expect(tipos).toEqual(['Barras horizontales', 'Solo tabla'])
    expect(within(panel).getByRole('heading', { level: 3, name: 'Destino del crédito (mejoras logradas)' })).toBeInTheDocument()
  })

  it('comparar por otro campo agrupa y muestra las cifras reales, también las de menos de 5', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    const panel = await abrirEditor()
    await userEvent.selectOptions(within(panel).getByLabelText('Comparar por'), 'Convocatoria')
    expect(within(panel).getByRole('heading', { level: 3, name: 'Satisfacción por convocatoria' })).toBeInTheDocument()
    expect(within(panel).queryByRole('note')).not.toBeInTheDocument()
    const fila = within(panel).getByRole('row', { name: /^Satisfecho/, hidden: true })
    expect(within(fila).getAllByRole('cell', { hidden: true }).map((c) => c.textContent)).toEqual(['0', '2'])
  })

  it('la medida por categoría de un campo numérico exige elegir el campo de comparación', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    const panel = await abrirEditor()
    const p = within(panel)
    await userEvent.selectOptions(p.getByLabelText('¿Qué quiere graficar?'), 'Crédito utilizado (%)')
    expect(p.getByLabelText('Tipo de gráfica')).toHaveValue('histograma')
    expect(p.queryByLabelText('Comparar por')).not.toBeInTheDocument()
    expect(p.queryByLabelText('Medida')).not.toBeInTheDocument()

    await userEvent.selectOptions(p.getByLabelText('Tipo de gráfica'), 'Barras por categoría')
    expect(p.getByLabelText('Calcular por (obligatorio)')).toBeInTheDocument()
    expect(p.getByRole('note')).toHaveTextContent(/Elija un campo/)

    await userEvent.selectOptions(p.getByLabelText('Calcular por (obligatorio)'), 'Convocatoria')
    expect(p.getByRole('heading', { level: 3, name: 'Promedio de crédito utilizado (%) por convocatoria' })).toBeInTheDocument()
  })

  it('la barra apilada al 100 % no ofrece medida (siempre es porcentaje)', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    const panel = await abrirEditor()
    await userEvent.selectOptions(within(panel).getByLabelText('Comparar por'), 'Convocatoria')
    await userEvent.selectOptions(within(panel).getByLabelText('Tipo de gráfica'), 'Barra apilada al 100 %')
    expect(within(panel).queryByLabelText('Medida')).not.toBeInTheDocument()
    expect(ultimaOpcion().series.every((s) => s.type === 'bar')).toBe(true)
  })

  it('la dona solo existe para campos categóricos y no ofrece comparación', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    const panel = await abrirEditor()
    const p = within(panel)
    expect(within(p.getByLabelText('Tipo de gráfica')).queryByRole('option', { name: 'Dona' })).not.toBeInTheDocument()
    await userEvent.selectOptions(p.getByLabelText('¿Qué quiere graficar?'), 'Convocatoria')
    await userEvent.selectOptions(p.getByLabelText('Tipo de gráfica'), 'Dona')
    expect(p.queryByLabelText('Comparar por')).not.toBeInTheDocument()
    expect(ultimaOpcion().series[0]!.type).toBe('pie')
  })

  it('"Solo tabla" no dibuja el lienzo de la vista previa y muestra la tabla a la vista', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    const panel = await abrirEditor()
    await userEvent.selectOptions(within(panel).getByLabelText('Tipo de gráfica'), 'Solo tabla')
    expect(within(panel).queryByTestId('lienzo')).not.toBeInTheDocument()
    expect(within(panel).getByRole('table', { name: 'Satisfacción' })).toBeVisible()
  })
})

describe('tabla de datos con muchos grupos', () => {
  const MUN = ['76001', '76109', '76111', '76147', '76233', '76243', '76364', '76400']
  function datosMuchosMunicipios(): PublicoJson {
    const d = datos()
    return { ...d, asesorias: d.asesorias.map((f, i) => ({ ...f, municipio_codigo: MUN[i % MUN.length]! })) }
  }

  it('se pone de lado (un grupo por fila) para no desbordar la tarjeta', async () => {
    render(<PaginaGraficas datos={datosMuchosMunicipios()} filtros={SIN} />)
    const panel = await abrirEditor()
    await userEvent.selectOptions(within(panel).getByLabelText('Comparar por'), 'Municipio')
    const tabla = within(panel).getByRole('table', { name: 'Satisfacción por municipio', hidden: true })
    // Primera columna = el campo de comparación; las demás, las categorías de satisfacción.
    expect(within(tabla).getAllByRole('columnheader', { hidden: true }).map((c) => c.textContent)).toEqual(['Municipio', 'Muy satisfecho', 'Satisfecho'])
    expect(within(tabla).getAllByRole('row', { hidden: true })).toHaveLength(1 + MUN.length)
  })

  it('la tabla va en un contenedor con desplazamiento propio, accesible con teclado', async () => {
    render(<PaginaGraficas datos={datosMuchosMunicipios()} filtros={SIN} />)
    const panel = await abrirEditor()
    await userEvent.selectOptions(within(panel).getByLabelText('Comparar por'), 'Municipio')
    const region = within(panel).getByRole('region', { name: 'Tabla de datos: Satisfacción por municipio', hidden: true })
    expect(region).toHaveClass('grafica__tabla')
    expect(region).toHaveAttribute('tabindex', '0')
  })
})
