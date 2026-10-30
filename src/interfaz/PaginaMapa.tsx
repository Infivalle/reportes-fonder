import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { formatoEntero } from '../indicadores/formato'
import { calcularMapa, clasesDeColor, detalleMunicipio } from '../mapa/datos'
import { ID_TABLA_MUNICIPIOS, ListaMunicipios } from '../mapa/ListaMunicipios'
import { EtiquetaCursor } from '../mapa/EtiquetaCursor'
import { LeyendaMapa, MapaValle } from '../mapa/MapaValle'
import { PanelMunicipio } from '../mapa/PanelMunicipio'
import { BENEFICIARIOS_POR_MUNICIPIO } from '../mapa/totalesMunicipio'
import type { ModoVista } from '../mapa/proyeccion'
import type { PublicoJson } from '../publico/tipos'
import { construirHash, type FiltrosGlobales } from './ruta'
import './estilos.css'
import '../mapa/mapa.css'

interface Props {
  datos: PublicoJson
  filtros: FiltrosGlobales
}

const TOTAL_MUNICIPIOS = 42

/** "Mapa": beneficiarios por municipio del Valle, con el detalle de cada uno y la lista de municipios. */
export function PaginaMapa({ datos, filtros }: Props) {
  // El municipio del filtro global solo sirve para abrir el panel al entrar; el mapa muestra los 42.
  const [seleccionado, setSeleccionado] = useState<string | null>(filtros.municipio)
  const [vista, setVista] = useState<ModoVista>('plana')
  const [activo, setActivo] = useState<string | null>(null)
  const panel = useRef<HTMLElement>(null)
  const figura = useRef<HTMLElement>(null)
  /** Selector del elemento que abrió el detalle (el trazado o el botón de la lista), para devolverle el foco al cerrar. */
  const origen = useRef<string | null>(null)
  const enfocarPanel = useRef(false)

  const { proyecto, mes } = filtros
  const filtrosMapa = useMemo(() => ({ proyecto, mes }), [proyecto, mes])
  const mapa = useMemo(() => calcularMapa(datos, filtrosMapa), [datos, filtrosMapa])
  const nombres = useMemo(() => new Map(mapa.municipios.map((m) => [m.codigo, m.nombre])), [mapa.municipios])
  const clases = useMemo(() => clasesDeColor(mapa.municipios.map((m) => m.beneficiarios)), [mapa.municipios])
  const detalle = useMemo(
    () => (seleccionado === null ? null : detalleMunicipio(datos, filtrosMapa, seleccionado)),
    [datos, filtrosMapa, seleccionado],
  )

  const elegir = (codigo: string) => {
    // Se guarda un selector y no el elemento: al elegir, el trazado cambia de grupo en el SVG y React lo recrea.
    const activo = document.activeElement
    // Los trazados del mapa son SVGElement, no HTMLElement.
    const { mapaCodigo, listaCodigo } = activo instanceof HTMLElement || activo instanceof SVGElement ? activo.dataset : {}
    origen.current = mapaCodigo !== undefined ? `[data-mapa-codigo="${mapaCodigo}"]` : listaCodigo !== undefined ? `[data-lista-codigo="${listaCodigo}"]` : null
    enfocarPanel.current = true
    setSeleccionado(codigo)
    // En celular el detalle es una hoja que tapa la parte baja de la pantalla: se sube el mapa para que quede a la vista.
    if (window.matchMedia('(max-width: 899px)').matches) figura.current?.scrollIntoView({ block: 'start' })
  }
  const cerrar = () => {
    setSeleccionado(null)
    const volver = origen.current
    origen.current = null
    if (volver !== null) {
      // Espera a que React dibuje de nuevo el elemento.
      requestAnimationFrame(() => document.querySelector<HTMLElement>(volver)?.focus({ preventScroll: true }))
    }
  }
  const alRenderizar = (el: HTMLElement | null) => {
    panel.current = el
    if (el !== null && enfocarPanel.current) {
      enfocarPanel.current = false
      el.focus({ preventScroll: true })
    }
  }
  const teclas = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && seleccionado !== null) cerrar()
  }
  const irALista = () => {
    const tabla = document.getElementById(ID_TABLA_MUNICIPIOS)
    tabla?.focus()
    tabla?.scrollIntoView({ block: 'start' })
  }

  const lectura = mapa.municipios.find((m) => m.codigo === (activo ?? seleccionado))
  const aviso = (texto: string) => (
    <p className="mapa__nota" key={texto}>
      {texto}
    </p>
  )

  return (
    <section className="indicadores mapa" aria-labelledby="titulo-mapa" onKeyDown={teclas}>
      <header className="indicadores__encabezado">
        <div>
          <h2 id="titulo-mapa">Mapa de beneficiarios</h2>
          <p className="indicadores__meta">
            {formatoEntero(mapa.ubicados)} beneficiarios con asesoría en {formatoEntero(mapa.visitados)} de {TOTAL_MUNICIPIOS} municipios del Valle.
          </p>
        </div>
      </header>

      <div className="mapa__rejilla">
        <div className="mapa__principal">
          <div className="mapa__herramientas" role="group" aria-label="Opciones del mapa">
            <button type="button" className="boton" aria-pressed={vista === '3d'} onClick={() => setVista(vista === '3d' ? 'plana' : '3d')}>
              Vista 3D
            </button>
            <button type="button" className="boton" onClick={irALista}>
              Ir a la lista de municipios
            </button>
          </div>

          <figure ref={figura} className="mapa__figura">
            <MapaValle municipios={mapa.municipios} clases={clases} seleccionado={seleccionado} vista={vista} onElegir={elegir} onActivo={setActivo} />
            <figcaption className="mapa__lectura">
              {lectura === undefined
                ? 'Pase el cursor o toque un municipio para ver su detalle.'
                : `${lectura.nombre}: ${formatoEntero(lectura.beneficiarios)} ${lectura.beneficiarios === 1 ? 'beneficiario' : 'beneficiarios'}`}
            </figcaption>
            <EtiquetaCursor contenedor={figura} nombres={nombres} />
          </figure>

          <LeyendaMapa clases={clases} />

          {mapa.total === 0 && (
            <p className="indicadores__vacio" role="status">
              No hay asesorías para este filtro.
            </p>
          )}
        </div>

        {detalle !== null ? (
          <PanelMunicipio
            ref={alRenderizar}
            detalle={detalle}
            enlaceIndicadores={detalle.beneficiarios > 0 ? construirHash('indicadores', { ...filtros, municipio: detalle.codigo }) : null}
            onCerrar={cerrar}
          />
        ) : (
          <aside className="mapa-ayuda" aria-label="Detalle de un municipio">
            <h3 className="mapa-panel__titulo">Elija un municipio</h3>
            <p>Toque un municipio del mapa, o búsquelo en la lista, para ver sus beneficiarios, la satisfacción y los resultados.</p>
          </aside>
        )}
      </div>

      <ListaMunicipios
        municipios={mapa.municipios}
        seleccionado={seleccionado}
        maximo={mapa.maximo}
        sinUbicar={mapa.sinUbicar}
        total={mapa.total}
        onElegir={elegir}
      />

      <div className="mapa__notas">
        {mapa.sinUbicar > 0 &&
          aviso(
            `${formatoEntero(mapa.sinUbicar)} ${mapa.sinUbicar === 1 ? 'beneficiario no se pudo ubicar' : 'beneficiarios no se pudieron ubicar'} en un municipio del Valle (municipio vacío, de otro departamento o no reconocido), por eso no aparecen en el mapa.`,
          )}
        {aviso(
          mapa.fuente === 'empresa'
            ? 'El municipio es el de la empresa del beneficiario; cuando falta, se usa el de su residencia.'
            : 'El municipio es la ciudad de residencia del beneficiario: la carga actual no incluye el municipio de la empresa.',
        )}
        {aviso(
          Object.keys(BENEFICIARIOS_POR_MUNICIPIO).length === 0
            ? 'El mapa cuenta beneficiarios, no cobertura: falta cargar el total de beneficiarios de cada municipio para calcular qué porcentaje fue atendido.'
            : 'El color del mapa cuenta beneficiarios. La cobertura de cada municipio (beneficiarios con asesoría sobre el total de su convocatoria) se ve en el detalle y no se calcula si hay un mes filtrado.',
        )}
        {filtros.municipio !== null &&
          aviso('El filtro de municipio no se aplica al mapa: aquí se ven los 42 municipios y el municipio se elige tocándolo. Los filtros de convocatoria y mes sí aplican.')}
      </div>

      <details className="metodo">
        <summary>¿Cómo se calcula el mapa?</summary>
        <p>
          Cada municipio cuenta los beneficiarios distintos con al menos una asesoría ahí. Los porcentajes del detalle se calculan sobre las
          respuestas recibidas a cada pregunta, igual que en Indicadores, y se muestra siempre cuántas respuestas son: en municipios con pocos
          beneficiarios un porcentaje puede basarse en una o dos personas. Los límites municipales son del Marco Geoestadístico Nacional del
          DANE, simplificados para el sitio.
        </p>
      </details>
    </section>
  )
}
