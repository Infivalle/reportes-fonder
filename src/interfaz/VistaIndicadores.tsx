import { useId, useMemo, useState } from 'react'
import { calcularIndicadores } from '../indicadores/calcular'
import { formatoEntero, formatoFecha, formatoPorcentaje } from '../indicadores/formato'
import { listarProyectos } from '../indicadores/proyectos'
import type { PublicoJson } from '../publico/tipos'
import './estilos.css'
import { Progreso, Tarjeta, TablaDistribucion } from './Tarjeta'

interface Props {
  datos: PublicoJson
}

const TODOS = '__todos__'

export function VistaIndicadores({ datos }: Props) {
  const idFiltro = useId()
  const [seleccion, setSeleccion] = useState<string>(TODOS)

  const proyectos = useMemo(
    () => listarProyectos([...datos.asesorias.map((a) => a.proyecto), ...datos.denominadores.map((d) => d.proyecto)]),
    [datos],
  )
  const r = useMemo(
    () => calcularIndicadores(datos, { proyecto: seleccion === TODOS ? null : seleccion }),
    [datos, seleccion],
  )
  const fecha = formatoFecha(datos.fecha_corte)
  const c = r.cobertura
  const m = r.municipios
  // Rango más frecuente; si empatan, el primero en el orden del formulario.
  const masFrecuente = r.empleo.items.reduce<(typeof r.empleo.items)[number] | null>(
    (mejor, i) => (i.conteo > (mejor?.conteo ?? 0) ? i : mejor),
    null,
  )
  const rangoMasFrecuente = masFrecuente?.valor ?? 'Sin dato'

  return (
    <section className="indicadores" aria-labelledby="titulo-indicadores">
      <header className="indicadores__encabezado">
        <div>
          <h2 id="titulo-indicadores">Indicadores de las asesorías</h2>
          <p className="indicadores__meta">
            {fecha ? `Fecha de corte: ${fecha}. ` : ''}
            {formatoEntero(r.beneficiarios)} beneficiarios con asesoría · {formatoEntero(r.asesorias)} asesorías.
          </p>
        </div>
        <div className="filtro">
          <label htmlFor={idFiltro}>Convocatoria</label>
          <select id={idFiltro} value={seleccion} onChange={(e) => setSeleccion(e.target.value)}>
            <option value={TODOS}>Todas las convocatorias</option>
            {proyectos.map((p) => (
              <option key={p.clave} value={p.clave}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </header>

      {r.asesorias === 0 && (
        <p className="indicadores__vacio" role="status">
          No hay asesorías para este filtro.
        </p>
      )}

      <section className="resumen" aria-labelledby="titulo-resumen">
        <h3 id="titulo-resumen" className="seccion__titulo">
          Resumen
        </h3>
        <div className="rejilla">
          <Tarjeta
            resumen
            tono="azul"
            titulo="Cobertura"
            valor={c.total === null ? 'Sin dato' : formatoPorcentaje(c.porcentaje)}
            descripcion={
              c.total === null
                ? `${formatoEntero(c.atendidos)} beneficiarios atendidos. Falta cargar el total de beneficiarios de la convocatoria.`
                : `${formatoEntero(c.atendidos)} de ${formatoEntero(c.total)} beneficiarios con asesoría.`
            }
            n={null}
          >
            <Progreso porcentaje={c.porcentaje} etiqueta="Cobertura de beneficiarios" />
            {c.inconsistente && (
              <p className="tarjeta__aviso" role="note">
                Hay más beneficiarios atendidos que el total cargado: el total está desactualizado.
              </p>
            )}
          </Tarjeta>

          <Tarjeta
            resumen
            tono="turquesa"
            titulo="Cubrimiento de municipios"
            valor={`${formatoEntero(m.visitados)} de ${formatoEntero(m.total)}`}
            descripcion={`Municipios del Valle con beneficiarios atendidos (${formatoPorcentaje(m.porcentaje)}).`}
            n={null}
          >
            <Progreso porcentaje={m.porcentaje} etiqueta="Municipios con beneficiarios atendidos" />
          </Tarjeta>

          <Tarjeta
            resumen
            tono="verde"
            titulo="Satisfacción"
            valor={formatoPorcentaje(r.satisfaccion.valor)}
            descripcion="Muy satisfechos o satisfechos."
            n={r.satisfaccion.n}
          >
            <Progreso porcentaje={r.satisfaccion.valor} etiqueta="Beneficiarios satisfechos" />
          </Tarjeta>
        </div>
      </section>

      <section className="detalle" aria-labelledby="titulo-detalle">
        <h3 id="titulo-detalle" className="seccion__titulo">
          Detalle de las respuestas
        </h3>
        <div className="rejilla">
          <Tarjeta tono="verde" titulo="Detalle de satisfacción" descripcion="Cómo calificaron la asesoría." n={null}>
            <TablaDistribucion
              titulo="Satisfacción con la asesoría"
              distribucion={r.satisfaccion.distribucion}
              resaltar={['Muy satisfecho', 'Satisfecho']}
            />
          </Tarjeta>

          <Tarjeta
            tono="azul"
            titulo="Resultados esperados"
            valor={formatoPorcentaje(r.resultados.valor)}
            descripcion="Obtuvieron los resultados que esperaban."
            n={r.resultados.n}
          >
            <TablaDistribucion
              titulo="Resultados frente a lo esperado"
              distribucion={r.resultados.distribucion}
              resaltar={['Sí']}
            />
          </Tarjeta>

          <Tarjeta
            tono="turquesa"
            titulo="Pagos al día"
            valor={formatoPorcentaje(r.pagos.valor)}
            descripcion="Pagan según el cronograma."
            n={r.pagos.n}
          >
            <TablaDistribucion titulo="Pagos según cronograma" distribucion={r.pagos.distribucion} resaltar={['Sí']} />
          </Tarjeta>

          <Tarjeta
            tono="ambar"
            titulo="Necesidad de nuevo crédito"
            valor={formatoPorcentaje(r.nuevoCredito.valor)}
            descripcion="Necesitan otro crédito."
            n={r.nuevoCredito.n}
          >
            <TablaDistribucion
              titulo="Necesidad de otro crédito"
              distribucion={r.nuevoCredito.distribucion}
              resaltar={['Sí']}
            />
          </Tarjeta>

          <Tarjeta
            tono="azul"
            titulo="Crédito utilizado"
            valor={r.creditoUtilizado.mediana === null ? 'Sin dato' : formatoPorcentaje(r.creditoUtilizado.mediana)}
            descripcion="Mediana del porcentaje del crédito utilizado."
            n={r.creditoUtilizado.n}
          >
            <TablaDistribucion titulo="Porcentaje del crédito utilizado" distribucion={r.creditoUtilizado.distribucion} />
          </Tarjeta>

          <Tarjeta
            tono="turquesa"
            titulo="Empleo"
            valor={rangoMasFrecuente}
            descripcion="Rango de empleados más frecuente."
            n={r.empleo.n}
          >
            <TablaDistribucion titulo="Empleados actuales" distribucion={r.empleo} />
          </Tarjeta>
        </div>
      </section>

      <details className="metodo">
        <summary>¿Cómo se calculan los indicadores?</summary>
        <p>
          Cada porcentaje se calcula sobre las respuestas recibidas a esa pregunta. Si un beneficiario tiene más de una
          asesoría, se usa la más reciente. Las asesorías repetidas se descartan al cargar los datos.
        </p>
      </details>
    </section>
  )
}
