/**
 * Carga un TSV a Supabase llamando a la Edge Function `cargar-datos`.
 * Es el reemplazo de la pantalla de carga del admin hasta la fase F4.
 *
 *   npm run cargar -- <archivo.tsv>              (solo valida y muestra el resumen)
 *   npm run cargar -- <archivo.tsv> --confirmar  (reemplaza los datos)
 *
 * Variables de entorno:
 *   SUPABASE_URL        https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY   llave pública (anon o publishable)
 *   ADMIN_EMAIL         correo del admin (si falta, se pregunta)
 *   ADMIN_PASSWORD      contraseña (si falta, se pide sin mostrarla en pantalla)
 *
 * El archivo nunca se imprime ni se guarda en otro sitio.
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { createInterface } from 'node:readline/promises'

interface Resumen {
  /** 'v1' (52 columnas) o 'v2' (61). */
  formato?: string
  filasLeidas: number
  asesoriasConservadas: number
  asesoriasDescartadas: number
  beneficiariosDistintos: number
  beneficiariosConAsesoria: number
  municipiosSinReconocer: { texto: string; motivo: string; beneficiarios: number; campo?: string }[]
  /** Solo v2: de dónde salió el municipio de cada beneficiario. */
  municipiosPorOrigen?: { empresa: number; residencia: number; sin_ubicar: number }
  valoresFueraDeCatalogo: { campo: string; valor: string; filas: number }[]
  montosAtipicos: number
  advertencias: string[]
}

function salir(mensaje: string): never {
  console.error(`\n✗ ${mensaje}`)
  process.exit(1)
}

async function preguntar(texto: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await rl.question(texto)).trim()
  } finally {
    rl.close()
  }
}

/** Lee una línea sin mostrarla (contraseña). */
function preguntarOculto(texto: string): Promise<string> {
  const stdin = process.stdin
  if (!stdin.isTTY) return preguntar(texto)
  process.stdout.write(texto)
  stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding('utf8')
  return new Promise((resolver) => {
    let valor = ''
    const alRecibir = (trozo: string) => {
      for (const c of trozo) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', alRecibir)
          process.stdout.write('\n')
          resolver(valor)
          return
        }
        if (c === '\u0003') process.exit(130) // Ctrl+C
        if (c === '\u007f' || c === '\b') valor = valor.slice(0, -1)
        else valor += c
      }
    }
    stdin.on('data', alRecibir)
  })
}

function imprimirResumen(r: Resumen) {
  console.log('\nResumen')
  console.log(`  Formato del archivo:        ${r.formato ?? 'v1'}`)
  console.log(`  Filas leídas:               ${r.filasLeidas}`)
  console.log(`  Asesorías conservadas:      ${r.asesoriasConservadas}`)
  console.log(`  Descartadas por duplicado:  ${r.asesoriasDescartadas}`)
  console.log(`  Beneficiarios distintos:    ${r.beneficiariosDistintos}`)
  console.log(`  Montos atípicos marcados:   ${r.montosAtipicos}`)
  if (r.municipiosPorOrigen) {
    const o = r.municipiosPorOrigen
    console.log(`  Municipio según:            empresa ${o.empresa} · residencia ${o.residencia} · sin ubicar ${o.sin_ubicar}`)
  }

  if (r.municipiosSinReconocer.length > 0) {
    console.log('\n  Municipios sin reconocer (agregar alias en src/limpieza/municipios.ts si son del Valle):')
    for (const m of r.municipiosSinReconocer) {
      const columna = m.campo === undefined ? '' : `columna ${m.campo}, `
      console.log(`    - "${m.texto}" (${columna}${m.motivo}, ${m.beneficiarios} beneficiario/s)`)
    }
  }
  if (r.valoresFueraDeCatalogo.length > 0) {
    console.log('\n  Valores fuera de catálogo (se conservan tal cual):')
    for (const v of r.valoresFueraDeCatalogo) console.log(`    - ${v.campo}: "${v.valor}" (${v.filas})`)
  }
  for (const a of r.advertencias) console.log(`  ! ${a}`)
}

async function main() {
  const args = process.argv.slice(2)
  const confirmar = args.includes('--confirmar')
  const ruta = args.find((a) => !a.startsWith('--'))
  if (ruta === undefined) salir('Uso: npm run cargar -- <archivo.tsv> [--confirmar]')

  const url = process.env['SUPABASE_URL']?.replace(/\/$/, '')
  const anon = process.env['SUPABASE_ANON_KEY']
  if (!url || !anon) salir('Faltan las variables SUPABASE_URL y SUPABASE_ANON_KEY')

  let contenido: string
  try {
    contenido = readFileSync(ruta, 'utf-8')
  } catch {
    return salir(`No se pudo leer el archivo: ${ruta}`)
  }

  const email = process.env['ADMIN_EMAIL'] ?? (await preguntar('Correo del admin: '))
  const password = process.env['ADMIN_PASSWORD'] ?? (await preguntarOculto('Contraseña: '))

  // 1. Iniciar sesión
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!login.ok) salir('No se pudo iniciar sesión (correo o contraseña incorrectos)')
  const { access_token: token } = (await login.json()) as { access_token?: string }
  if (!token) salir('La respuesta de inicio de sesión no trae token')

  // 2. Enviar el archivo
  console.log(`\n${confirmar ? 'Cargando' : 'Validando'} ${basename(ruta)} …`)
  const r = await fetch(`${url}/functions/v1/cargar-datos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ archivo: basename(ruta), contenido, confirmar }),
  })
  const j = (await r.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    errores?: string[]
    aplicado?: boolean
    cargaId?: number
    dispatch?: string
    resumen?: Resumen
  }

  if (r.status === 422 && j.errores) {
    console.error('\n✗ El archivo se rechazó completo:')
    for (const e of j.errores) console.error(`  - ${e}`)
    process.exit(1)
  }
  if (!r.ok || !j.ok) salir(j.error ?? `La función respondió ${r.status}`)

  if (j.resumen) imprimirResumen(j.resumen)

  if (j.aplicado) {
    console.log(`\n✓ Datos reemplazados (carga n.º ${j.cargaId}).`)
    const aviso: Record<string, string> = {
      enviado: 'Se pidió a GitHub regenerar la capa pública (tarda 2 a 5 minutos).',
      omitido: 'No hay token de GitHub configurado: la capa pública se actualiza con la tarea diaria o a mano.',
      fallo: 'No se pudo avisar a GitHub: la capa pública se actualizará con la tarea diaria.',
    }
    console.log(aviso[j.dispatch ?? 'omitido'] ?? '')
  } else {
    console.log('\nSolo validación: no se cambió nada. Para cargar, repetir con --confirmar.')
  }
}

await main()
