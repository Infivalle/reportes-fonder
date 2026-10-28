import { useEffect, useRef } from 'react'
import { BarChart, PieChart } from 'echarts/charts'
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
// `use` de ECharts registra módulos; se renombra porque la regla de hooks de React lo confunde con el hook `use` de React.
import { init, use as registrarModulos, type EChartsCoreOption, type EChartsType } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'

// Solo lo que se usa (barras, dona, ejes, leyenda, tooltip, accesibilidad). El render es SVG: así
// la gráfica se puede llevar al PDF sin pixelarse (F5).
registrarModulos([BarChart, PieChart, GridComponent, LegendComponent, TooltipComponent, AriaComponent, SVGRenderer])

interface Props {
  opcion: EChartsCoreOption
  alto: number
  /** Descripción para lectores de pantalla; la tabla de datos es la alternativa completa. */
  etiqueta: string
}

/** Lienzo de ECharts: crea el gráfico una vez, lo actualiza al cambiar la opción y lo libera al salir. */
export function Echarts({ opcion, alto, etiqueta }: Props) {
  const lienzo = useRef<HTMLDivElement>(null)
  const grafico = useRef<EChartsType | null>(null)

  useEffect(() => {
    const el = lienzo.current
    if (!el) return
    const g = init(el, undefined, { renderer: 'svg' })
    grafico.current = g
    const observador = new ResizeObserver(() => g.resize())
    observador.observe(el)
    return () => {
      observador.disconnect()
      g.dispose()
      grafico.current = null
    }
  }, [])

  useEffect(() => {
    // notMerge: al cambiar de campo no deben quedar series viejas.
    grafico.current?.setOption(opcion, true)
  }, [opcion])

  return <div ref={lienzo} className="grafica__lienzo" style={{ height: alto }} role="img" aria-label={etiqueta} />
}
