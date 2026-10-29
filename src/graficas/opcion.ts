/**
 * Convierte los datos de una gráfica en la configuración de ECharts. Función pura (sin DOM):
 * se prueba sin dibujar nada. La tabla de datos alternativa vive en VistaGrafica.
 */
import type { EChartsCoreOption } from 'echarts/core'
import type { DatosGrafica } from './datos'
import type { GraficaDef } from './definicion'

/** Tonos de las tarjetas (--t-*) y algunos más para series adicionales. Todos legibles sobre fondo claro. */
export const PALETA = ['#3a69b8', '#2f8f94', '#5d9a3a', '#c98a1b', '#7b5ea7', '#b5533c', '#5b6b8c', '#8a9a3a'] as const

/** Con más series que esto la tarjeta compacta no lleva leyenda ni cifras sobre las barras: no caben. */
export const MAX_SERIES_LEGIBLES = 4

const TEXTO = '#14213d'
const SUAVE = '#44546f'
const BORDE = '#c5d7ee'

const escapar = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

interface DatoConTexto {
  value: number | null
  texto: string
  /** Solo en barras agrupadas: el grupo al que pertenece la barra (la serie es un "hueco", no un grupo). */
  grupo?: string
}

interface ParametroTooltip {
  marker?: string
  seriesName?: string
  name?: string
  data?: DatoConTexto
}

/**
 * Patrones (además del color) de las barras agrupadas. Se fijan a mano porque en ese modo la serie
 * no identifica al grupo, así que ECharts no puede asignarlos solo.
 */
const DECALES = [
  { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 5], rotation: Math.PI / 6 },
  { symbol: 'circle', symbolSize: 0.8, dashArrayX: [[8, 8], [0, 8, 8, 0]], dashArrayY: [6, 0] },
  { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 5], rotation: -Math.PI / 6 },
  { symbol: 'rect', dashArrayX: [[6, 6], [0, 6, 6, 0]], dashArrayY: [6, 0] },
  { symbol: 'triangle', dashArrayX: [[9, 9], [0, 9, 9, 0]], dashArrayY: [7, 0] },
  { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 5], rotation: 0 },
  { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 5], rotation: Math.PI / 2 },
  { symbol: 'diamond', symbolSize: 0.8, dashArrayX: [[8, 8], [0, 8, 8, 0]], dashArrayY: [6, 0] },
] as const

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
 * Barras agrupadas sin huecos. En ECharts cada serie reserva su sitio en cada categoría, así que un
 * grupo en 0 dejaba un espacio vacío. Aquí las series son "huecos": en cada categoría solo entran
 * los grupos con valor, de izquierda a derecha y centrados, y cada barra lleva el color y el patrón
 * de su grupo.
 */
function barrasSinHuecos(datos: DatosGrafica) {
  const hayValor = (v: number | null | undefined): v is number => v !== null && v !== undefined && v > 0
  const porCategoria = datos.categorias.map((_, c) =>
    datos.series.flatMap((s, g) => {
      const celda = s.celdas[c]
      return celda && hayValor(celda.valor) ? [{ g, nombre: s.nombre, celda }] : []
    }),
  )
  const huecos = Math.max(1, ...porCategoria.map((b) => b.length))
  return {
    huecos,
    // Series sin datos, en un par de ejes ocultos: solo existen para que la leyenda muestre cada grupo con su color y patrón.
    leyenda: datos.series.map((s, g) => ({
      type: 'bar' as const,
      name: s.nombre,
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: [] as never[],
      itemStyle: { color: PALETA[g % PALETA.length], decal: DECALES[g % DECALES.length] },
    })),
    series: Array.from({ length: huecos }, (_, k) => ({
      k,
      data: porCategoria.map((barras) => {
        const desfase = Math.floor((huecos - barras.length) / 2)
        const b = barras[k - desfase]
        return b
          ? {
              value: b.celda.valor,
              texto: b.celda.texto,
              grupo: b.nombre,
              itemStyle: { color: PALETA[b.g % PALETA.length], decal: DECALES[b.g % DECALES.length] },
            }
          : null
      }),
    })),
  }
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
        const todos = Array.isArray(raw) ? raw : [raw]
        // Con muchas series el cursor listaría decenas de ceros: se omiten (la tabla los tiene todos).
        const ps = todos.filter((p) => p.data != null && (p.data.grupo !== undefined || todos.length <= MAX_SERIES_LEGIBLES || (p.data.value ?? 0) > 0))
        const cabecera = escapar(todos[0]?.name ?? '')
        const lineas = ps.map((p) => `${p.marker ?? ''} ${escapar(p.data?.grupo ?? p.seriesName ?? '')}: <b>${escapar(textoDe(p))}</b>`)
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
  const pocasSeries = datos.series.length <= MAX_SERIES_LEGIBLES
  // La leyenda de una tarjeta compacta con muchos grupos taparía las barras: se oculta y se lee con el cursor o ampliando.
  const leyenda = varias && (pocasSeries || !compacta)
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

  const ejePrincipalX = () => (horizontal ? eje('value') : eje('category'))
  const ejePrincipalY = () => (horizontal ? eje('category') : eje('value'))
  const ejeOculto = (tipo: 'category' | 'value') => ({ type: tipo, show: false, ...(tipo === 'category' ? { data: [] as string[] } : {}) })
  const agrupada = varias && !apilada
  const sinHuecos = agrupada ? barrasSinHuecos(datos) : null
  const posicion = apilada ? ('inside' as const) : horizontal ? ('right' as const) : ('top' as const)
  const etiqueta = {
    // Con muchos grupos las cifras se montarían unas sobre otras: se quitan (están en el cursor y en la tabla).
    show: pocasSeries,
    position: posicion,
    color: apilada ? '#ffffff' : TEXTO,
    formatter: (p: { data?: DatoConTexto }) => (varias && p.data?.value === 0 ? '' : textoDe(p)),
  }

  return {
    ...comun,
    legend: leyenda
      ? {
          type: 'scroll' as const,
          top: 0,
          textStyle: { color: TEXTO },
          // En barras sin huecos las series reales son huecos, no grupos: la leyenda lista los grupos y no oculta barras.
          ...(sinHuecos ? { data: datos.series.map((s) => s.nombre), selectedMode: false } : {}),
        }
      : undefined,
    grid: { left: 8, right: 24, top: leyenda ? 44 : 20, bottom: 8, containLabel: true },
    xAxis: sinHuecos ? [ejePrincipalX(), ejeOculto(horizontal ? 'value' : 'category')] : ejePrincipalX(),
    yAxis: sinHuecos ? [ejePrincipalY(), ejeOculto(horizontal ? 'category' : 'value')] : ejePrincipalY(),
    series: sinHuecos
      ? [
          ...sinHuecos.series.map((h) => ({ type: 'bar' as const, name: `Hueco ${h.k + 1}`, data: h.data, label: etiqueta })),
          ...sinHuecos.leyenda,
        ]
      : datos.series.map((s) => ({
          type: 'bar' as const,
          name: s.nombre,
          ...(apilada ? { stack: 'total' } : {}),
          ...(def.grafica === 'histograma' ? { barCategoryGap: '8%' } : {}),
          data: s.celdas.map(dato),
          label: etiqueta,
        })),
  }
}
