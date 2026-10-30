// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
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
  vi.unstubAllGlobals()
})

const EJEMPLO = [
  'Municipio',
  'Destino del crédito (mejoras logradas) por municipio',
  'Satisfacción',
  'Canales de venta',
  '¿Lleva registros contables?',
  'Empleados actuales',
]
const tarjetas = () => within(screen.getByRole('list', { name: 'Gráficas del tablero' })).getAllByRole('listitem')
const titulos = () => tarjetas().map((t) => within(t).getByRole('heading', { level: 3 }).textContent)

async function agregar(campo: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Agregar gráfica' }))
  const panel = screen.getByRole('dialog', { name: 'Agregar gráfica' })
  await userEvent.selectOptions(within(panel).getByLabelText('¿Qué quiere graficar?'), campo)
  await userEvent.click(within(panel).getByRole('button', { name: 'Agregar al tablero' }))
}

describe('tablero: varias gráficas', () => {
  it('agrega una gráfica nueva desde el panel y cierra el panel', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await agregar('Convocatoria')
    expect(titulos()).toEqual(['Satisfacción', 'Convocatoria'])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('2 de 24 gráficas')).toBeInTheDocument()
  })

  it('cancelar o Escape cierran el panel sin agregar nada', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await userEvent.click(screen.getByRole('button', { name: 'Agregar gráfica' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(titulos()).toEqual(['Satisfacción'])

    await userEvent.click(screen.getByRole('button', { name: 'Agregar gráfica' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(titulos()).toEqual(['Satisfacción'])
  })

  it('el foco entra al panel y vuelve al botón que lo abrió', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    const boton = screen.getByRole('button', { name: 'Agregar gráfica' })
    await userEvent.click(boton)
    expect(screen.getByRole('dialog')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(boton).toHaveFocus()
  })

  it('editar cambia solo esa gráfica', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await agregar('Convocatoria')
    await userEvent.click(screen.getByRole('button', { name: 'Editar: Convocatoria' }))
    const panel = screen.getByRole('dialog', { name: 'Editar gráfica' })
    await userEvent.selectOptions(within(panel).getByLabelText('¿Qué quiere graficar?'), 'Mes de la asesoría')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar cambios' }))
    expect(titulos()).toEqual(['Satisfacción', 'Mes de la asesoría'])
  })

  it('duplicar pone la copia justo después; subir y bajar reordenan y los extremos no se mueven', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await agregar('Convocatoria')
    await userEvent.click(screen.getByRole('button', { name: 'Duplicar: Satisfacción' }))
    expect(titulos()).toEqual(['Satisfacción', 'Satisfacción', 'Convocatoria'])

    expect(within(tarjetas()[0]!).getByRole('button', { name: 'Mover antes: Satisfacción' })).toBeDisabled()
    expect(within(tarjetas()[2]!).getByRole('button', { name: 'Mover después: Convocatoria' })).toBeDisabled()

    await userEvent.click(within(tarjetas()[2]!).getByRole('button', { name: 'Mover antes: Convocatoria' }))
    expect(titulos()).toEqual(['Satisfacción', 'Convocatoria', 'Satisfacción'])
  })

  it('quitar avisa y permite deshacer', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await agregar('Convocatoria')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar: Satisfacción' }))
    expect(titulos()).toEqual(['Convocatoria'])
    const aviso = screen.getByRole('status')
    expect(aviso).toHaveTextContent('Se quitó «Satisfacción».')
    await userEvent.click(within(aviso).getByRole('button', { name: 'Deshacer' }))
    expect(titulos()).toEqual(['Satisfacción', 'Convocatoria'])
  })

  it('sin gráficas muestra el estado vacío y no deja exportar', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar: Satisfacción' }))
    expect(screen.getByRole('heading', { name: 'Su tablero está vacío' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar gráfica' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('ampliar muestra la gráfica en una ventana y Escape la cierra', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ampliar: Satisfacción' }))
    const ventana = screen.getByRole('dialog', { name: 'Gráfica ampliada' })
    expect(within(ventana).getByRole('heading', { level: 3, name: 'Satisfacción' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('tablero: gráficas de ejemplo', () => {
  it('la primera visita trae tres gráficas para no armar todo desde cero', () => {
    localStorage.clear()
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    expect(titulos()).toEqual(EJEMPLO)
  })

  it('con el tablero vacío se pueden volver a cargar', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar: Satisfacción' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cargar gráficas de ejemplo' }))
    expect(titulos()).toEqual(EJEMPLO)
  })
})

describe('tablero: filtros propios', () => {
  it('una gráfica puede tener su propio filtro, que se suma a los globales y se ve en la tarjeta', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await userEvent.click(screen.getByRole('button', { name: 'Editar: Satisfacción' }))
    const panel = screen.getByRole('dialog', { name: 'Editar gráfica' })
    await userEvent.selectOptions(within(panel).getByLabelText('Agregar filtro por…'), 'Convocatoria')
    // Parte de la primera convocatoria (6 beneficiarios) y la vista previa ya lo refleja.
    expect(within(panel).getByText(/Base: 6 beneficiarios con respuesta de 6/)).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('checkbox', { name: 'Segunda convocatoria' }))
    expect(within(panel).getByText(/Base: 13 beneficiarios con respuesta de 13/)).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('checkbox', { name: 'Primera convocatoria' }))
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar cambios' }))

    const t = tarjetas()[0]!
    expect(within(t).getByText(/Filtro propio — Convocatoria: Segunda convocatoria/)).toBeInTheDocument()
    expect(within(t).getByText(/Base: 7 beneficiarios con respuesta de 7/)).toBeInTheDocument()
  })

  it('"Quitar filtro" lo elimina', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await userEvent.click(screen.getByRole('button', { name: 'Editar: Satisfacción' }))
    const panel = screen.getByRole('dialog')
    await userEvent.selectOptions(within(panel).getByLabelText('Agregar filtro por…'), 'Convocatoria')
    await userEvent.click(within(panel).getByRole('button', { name: 'Quitar filtro de convocatoria' }))
    expect(within(panel).getByText(/Base: 13 beneficiarios con respuesta de 13/)).toBeInTheDocument()
    expect(within(panel).queryByRole('checkbox')).not.toBeInTheDocument()
  })
})

describe('tablero: guardado en el navegador', () => {
  it('lo que se arma sobrevive a recargar la página', async () => {
    const primera = render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await agregar('Convocatoria')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar: Satisfacción' }))
    primera.unmount()

    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    expect(titulos()).toEqual(['Convocatoria'])
  })

  it('un guardado ilegible se avisa y se parte de un tablero nuevo', () => {
    localStorage.setItem(CLAVE_TABLERO, '{no es json')
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudieron leer/)
    expect(titulos()).toEqual(EJEMPLO)
  })

  it('si el navegador no deja guardar, la pantalla sigue funcionando y lo avisa', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError')
    })
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await agregar('Convocatoria')
    expect(titulos()).toEqual(['Satisfacción', 'Convocatoria'])
    expect(screen.getByRole('alert')).toHaveTextContent(/No se pudieron guardar/)
  })

  it('si ni siquiera se puede acceder al almacenamiento, también funciona', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    expect(titulos()).toEqual(EJEMPLO)
    expect(screen.getByRole('alert')).toHaveTextContent(/no deja guardar/)
  })
})

describe('tablero: exportar e importar', () => {
  const archivo = (contenido: unknown) => new File([typeof contenido === 'string' ? contenido : JSON.stringify(contenido)], 'tablero.json', { type: 'application/json' })
  const def = (campo: string) => ({ campo, grafica: 'barras', medida: 'conteo', desglose: null })

  it('exportar descarga un JSON con versión y las gráficas', async () => {
    let contenido = ''
    const crear = vi.fn((b: Blob) => {
      void b.text().then((t) => (contenido = t))
      return 'blob:x'
    })
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: crear, revokeObjectURL: vi.fn() }))
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(crear).toHaveBeenCalledOnce()
    await waitFor(() => expect(contenido).not.toBe(''))
    const json = JSON.parse(contenido) as { version: number; tarjetas: { def: { campo: string } }[] }
    expect(json.version).toBe(1)
    expect(json.tarjetas.map((t) => t.def.campo)).toEqual(['satisfaction'])
    expect(screen.getByRole('status')).toHaveTextContent(/Se descargó/)
  })

  it('importar reemplaza el tablero, avisa lo omitido y permite deshacer', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    const nuevo = { version: 1, tarjetas: [{ id: 'a', def: def('proyecto'), filtros: {} }, { id: 'b', def: def('campo_inexistente'), filtros: {} }] }
    await userEvent.upload(screen.getByLabelText('Archivo de tablero a importar'), archivo(nuevo))
    await waitFor(() => expect(titulos()).toEqual(['Convocatoria']))
    const aviso = screen.getByRole('status')
    expect(aviso).toHaveTextContent(/Se importaron 1 gráfica y reemplazaron las actuales\. Se omitieron 1/)
    await userEvent.click(within(aviso).getByRole('button', { name: 'Deshacer' }))
    expect(titulos()).toEqual(['Satisfacción'])
  })

  it('un archivo inválido no toca el tablero y explica el motivo', async () => {
    render(<PaginaGraficas datos={datos()} filtros={SIN} />)
    await userEvent.upload(screen.getByLabelText('Archivo de tablero a importar'), archivo('esto no es json'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/No se importó: El archivo no es un JSON válido/))
    expect(titulos()).toEqual(['Satisfacción'])
  })
})
