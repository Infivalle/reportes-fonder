/**
 * Genera src/mapa/geometriaValle.ts a partir del Marco Geoestadístico Nacional (DANE, nivel municipal).
 *
 *   node scripts/generar-geometria-valle.mjs ruta/MGN_ADM_MPIO_GRAFICO.geojson
 *
 * - Toma solo el departamento 76 y cruza por código DIVIPOLA (mpio_cdpmp), nunca por nombre.
 * - Simplifica con mapshaper (Visvalingam, conserva las fronteras compartidas: no quedan huecos ni solapes).
 * - Proyecta a un plano (longitud corregida por el coseno de la latitud media) y escribe cada municipio
 *   como un trazado SVG listo para dibujar, en un viewBox de ancho 1000.
 * Requiere `mapshaper` (devDependency). No se ejecuta en el sitio: el resultado se versiona.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const entrada = process.argv[2]
if (!entrada) throw new Error('Uso: node scripts/generar-geometria-valle.mjs <MGN_ADM_MPIO_*.geojson>')
const PORCENTAJE = 3
const ANCHO = 1000
const SALIDA = new URL('../src/mapa/geometriaValle.ts', import.meta.url)

const dir = mkdtempSync(join(tmpdir(), 'valle-'))
const valle = join(dir, 'valle.geojson')
const simple = join(dir, 'simple.geojson')

const todo = JSON.parse(readFileSync(entrada, 'utf8'))
const features = todo.features.filter((f) => f.properties.dpto_ccdgo === '76')
writeFileSync(valle, JSON.stringify({ type: 'FeatureCollection', features }))
execFileSync('npx', ['mapshaper', valle, '-simplify', 'visvalingam', 'weighted', `${PORCENTAJE}%`, 'keep-shapes', '-o', simple, 'precision=0.0005', 'force'], { stdio: 'inherit' })
const mun = JSON.parse(readFileSync(simple, 'utf8')).features

const anillos = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) // lista de polígonos; cada uno, lista de anillos
let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
for (const f of mun) for (const p of anillos(f.geometry)) for (const [x, y] of p[0]) {
  minLon = Math.min(minLon, x); maxLon = Math.max(maxLon, x); minLat = Math.min(minLat, y); maxLat = Math.max(maxLat, y)
}
const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
const escala = ANCHO / ((maxLon - minLon) * k)
const px = (lon) => (lon - minLon) * k * escala
const py = (lat) => (maxLat - lat) * escala
const alto = Math.ceil(py(minLat))
const n1 = (v) => String(Math.round(v * 10) / 10)

function trazado(poligonos) {
  let d = ''
  for (const p of poligonos) for (const anillo of p) {
    let ax = 0, ay = 0
    anillo.slice(0, -1).forEach(([lon, lat], i) => {
      const x = Math.round(px(lon) * 10) / 10, y = Math.round(py(lat) * 10) / 10
      d += i === 0 ? `M${n1(x)} ${n1(y)}` : `l${n1(x - ax)} ${n1(y - ay)}`
      ax = x; ay = y
    })
    d += 'z'
  }
  return d
}

/** Centroide del polígono más grande (para etiquetas y para anclar paneles). */
function centroide(poligonos) {
  let mejor = null
  for (const p of poligonos) {
    const r = p[0].map(([lon, lat]) => [px(lon), py(lat)])
    let a = 0, cx = 0, cy = 0
    for (let i = 0; i < r.length - 1; i++) {
      const c = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
      a += c; cx += (r[i][0] + r[i + 1][0]) * c; cy += (r[i][1] + r[i + 1][1]) * c
    }
    a /= 2
    if (mejor === null || Math.abs(a) > Math.abs(mejor.a)) mejor = { a, x: cx / (6 * a), y: cy / (6 * a) }
  }
  return [Math.round(mejor.x), Math.round(mejor.y)]
}

const filas = mun
  .map((f) => ({ codigo: f.properties.mpio_cdpmp, poligonos: anillos(f.geometry) }))
  .sort((a, b) => a.codigo.localeCompare(b.codigo))
  .map((m) => {
    const [cx, cy] = centroide(m.poligonos)
    return `  { codigo: '${m.codigo}', cx: ${cx}, cy: ${cy}, d: '${trazado(m.poligonos)}' },`
  })

const texto = `/**
 * GENERADO por scripts/generar-geometria-valle.mjs — no editar a mano.
 * Fuente: Marco Geoestadístico Nacional (MGN), nivel municipal, DANE. Departamento 76 (42 municipios).
 * Simplificado (Visvalingam ${PORCENTAJE} %, fronteras compartidas) y proyectado a un plano de ${ANCHO} de ancho.
 * El municipio se identifica por código DIVIPOLA; el nombre sale de MUNICIPIOS_VALLE.
 */
export interface GeometriaMunicipio {
  codigo: string
  /** Centroide del polígono más grande, en coordenadas del viewBox. */
  cx: number
  cy: number
  /** Trazado SVG (todos los polígonos y anillos). */
  d: string
}

export const VIEWBOX_VALLE = { ancho: ${ANCHO}, alto: ${alto} } as const

export const GEOMETRIA_VALLE: readonly GeometriaMunicipio[] = [
${filas.join('\n')}
]
`
writeFileSync(SALIDA, texto)
console.log(`Escrito ${SALIDA.pathname}: ${mun.length} municipios, ${texto.length} bytes, viewBox ${ANCHO}x${alto}`)
