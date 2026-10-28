/**
 * Convierte los datos de una gráfica en la configuración de ECharts. Función pura (sin DOM):
 * se prueba sin dibujar nada. La tabla de datos alternativa vive en VistaGrafica.
 */
import type { EChartsCoreOption } from 'echarts/core'
import type { DatosGrafica } from './datos'
import type { GraficaDef } from './definicion'

/** Tonos de las tarjetas (--t-*) y algunos más para series adicionales. Todos legibles sobre fondo claro. */
export const PALETA = ['#3a69b8', '#2f8f94', '#5d9a3a', '#c98a1b', '#7b5ea7', '#b5533c', '#5b6b8c', '#8a9a3a'] as const

const TEXTO = '#14213d'
const SUAVE = '#44546f'
const BORDE = '#c5d7ee'

const escapar = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

interface DatoConTexto {
  value: number | null
  texto: string
}

interface ParametroTooltip {
  marker?: string
  seriesName?: string
  name?: string
  data?: DatoConTexto
}

const textoDe = (p: { data?: DatoConTexto }): string => p.data?.texto ?? ''

/** ¿Hay algo que dibujar? (la tabla y los avisos se muestran aunque no haya gráfica). */
export function hayQueDibujar(datos: DatosGrafica, def: GraficaDef): boolean {
  return def.grafica !== 'tabla' && datos.series.length > 0 && datos.categorias.length > 0
}

/** Alto del lienzo en píxeles: las barras horizontales crecen con el número de barras. */
export function altoGrafica(datos: DatosGrafica, def: GraficaDef, compacta = false): number {
  if (def.grafica === 'barras_horizontales') {
    const filas = datos.categorias.length * Math.max(1, datos.series.length)
    return compacta ? Math.min(420, Math.max(180, 50 + filas * 24)) : Math.min(720, Math.max(260, 70 + filas * 30))
  }
  if (def.grafica === 'dona') return compacta ? 300 : 360
  return compacta ? 240 : 340
}

function dato(c: { valor: number | null; texto: string }): DatoConTexto {
  return { value: c.valor, texto: c.texto }
}

/**
 * `compacta` (tarjeta del tablero): la dona no lleva leyenda y solo etiqueta las porciones de más
 * de ~4 %; el resto se lee con el cursor, ampliando la gráfica o en la tabla de datos.
 */
export function construirOpcion(datos: DatosGrafica, def: GraficaDef, compacta = false): EChartsCoreOption | null {
  if (!hayQueDibujar(datos, def)) return null

  const varias = datos.series.length > 1
  const comun = {
    color: [...PALETA],
    animation: false, // sin movimiento: respeta a quien lo prefiere y simplifica las pruebas
    textStyle: { color: TEXTO },
    aria: { enabled: true, decal: { show: true } }, // patrones además de color: se distingue sin ver colores
    tooltip: {
      trigger: def.grafica === 'dona' ? 'item' : 'axis',
      confine: true,
      formatter: (raw: ParametroTooltip | ParametroTooltip[]) => {
        const ps = Array.isArray(raw) ? raw : [raw]
        const cabecera = escapar(ps[0]?.name ?? '')
        const lineas = ps.map((p) => `${p.marker ?? ''} ${escapar(p.seriesName ?? '')}: <b>${escapar(textoDe(p))}</b>`)
        return [cabecera, ...lineas].join('<br/>')
      },
    },
  }

  if (def.grafica === 'dona') {
    const s = datos.series[0]!
    return {
      ...comun,
      legend: compacta ? { show: false } : { type: 'scroll' as const, bottom: 0, textStyle: { color: TEXTO } },
      series: [
        {
          type: 'pie',
          radius: compacta ? ['36%', '58%'] : ['42%', '68%'],
          center: ['50%', compacta ? '50%' : '45%'],
          minShowLabelAngle: compacta ? 15 : 0,
          itemStyle: { borderColor: '#f8fbff', borderWidth: 2 },
          label: { color: TEXTO, formatter: (p: { name?: string; data?: DatoConTexto }) => `${p.name ?? ''}: ${textoDe(p)}` },
          data: datos.categorias.map((nombre, i) => ({ name: nombre, ...dato(s.celdas[i] ?? { valor: null, texto: '' }) })).filter((d) => d.value !== null && d.value > 0),
        },
      ],
    }
  }

  const horizontal = def.grafica === 'barras_horizontales'
  const apilada = def.grafica === 'apilada_100'
  const porcentaje = datos.unidad === 'porcentaje'
  const inclinar = !horizontal && datos.categorias.length > 4
  const eje = (tipo: 'category' | 'value') =>
    tipo === 'category'
      ? {
          type: 'category' as const,
          data: datos.categorias,
          inverse: horizontal,
          // Con muchas categorías verticales las etiquetas se inclinan: en una tarjeta estrecha se pisarían.
          axisLabel: {
            color: TEXTO,
            interval: 0,
            width: horizontal ? 150 : inclinar ? 110 : 90,
            overflow: inclinar ? ('truncate' as const) : ('break' as const),
            rotate: inclinar ? 35 : 0,
          },
          axisLine: { lineStyle: { color: BORDE } },
        }
      : {
          type: 'value' as const,
          min: 0,
          ...(apilada ? { max: 100 } : {}),
          axisLabel: { color: SUAVE, formatter: porcentaje ? '{value} %' : '{value}' },
          splitLine: { lineStyle: { color: BORDE } },
        }

  return {
    ...comun,
    legend: varias ? { top: 0, textStyle: { color: TEXTO } } : undefined,
    grid: { left: 8, right: 24, top: varias ? 44 : 20, bottom: 8, containLabel: true },
    xAxis: horizontal ? eje('value') : eje('category'),
    yAxis: horizontal ? eje('category') : eje('value'),
    series: datos.series.map((s) => ({
      type: 'bar' as const,
      name: s.nombre,
      ...(apilada ? { stack: 'total' } : {}),
      ...(def.grafica === 'histograma' ? { barCategoryGap: '8%' } : {}),
      data: s.celdas.map(dato),
      label: {
        show: true,
        position: apilada ? ('inside' as const) : horizontal ? ('right' as const) : ('top' as const),
        color: apilada ? '#ffffff' : TEXTO,
        formatter: textoDe,
      },
    })),
  }
}
