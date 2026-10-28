/**
 * Genera public/publico.json, el único dato que ve el visitante sin sesión.
 * Lo ejecutan los workflows de GitHub Actions antes de compilar el sitio.
 *
 *   npm run generar-publico
 *
 * Variables de entorno:
 *   PUBLICO_DB_URL  cadena de conexión del rol de solo lectura `publico_ro`
 *                   (usar el "Session pooler" de Supabase). Si falta, se escribe un archivo
 *                   vacío y el sitio sigue compilando.
 *   PUBLICO_DB_CA   (opcional) certificado CA de Supabase en formato PEM, para verificar la conexión.
 *
 * Si el contenido no pasa la verificación de publicación, el script termina con error y el
 * despliegue se detiene: es preferible no actualizar que publicar un dato que no debe salir.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import pg from 'pg'
import { generarPublico } from '../src/publico/generar.ts'
import type { PublicoVacio } from '../src/publico/tipos.ts'

const SALIDA = 'public/publico.json'

function escribir(contenido: unknown) {
  mkdirSync(dirname(SALIDA), { recursive: true })
  writeFileSync(SALIDA, JSON.stringify(contenido) + '\n')
}

/** Quita lo que suele colarse al pegar el secreto: espacios, comillas o el prefijo "PUBLICO_DB_URL=". */
function normalizarCadena(bruta: string): string {
  return bruta
    .trim()
    .replace(/^PUBLICO_DB_URL\s*=\s*/i, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim()
}

/**
 * Pistas sobre por qué la cadena no es válida. Solo describe su forma (sí/no, cantidades):
 * nunca imprime partes de la cadena, porque el registro de Actions de un repositorio público es visible.
 */
function diagnosticar(cadena: string): string[] {
  const pistas: string[] = []
  const arrobas = (cadena.match(/@/g) ?? []).length
  if (!/^postgres(ql)?:\/\//i.test(cadena)) pistas.push('no empieza por postgresql://')
  if (arrobas !== 1) pistas.push(`tiene ${arrobas} caracteres "@" (debe tener exactamente uno: la contraseña no puede llevar "@")`)
  if (/\s/.test(cadena)) pistas.push('contiene espacios o saltos de línea')
  if (/[[\]]/.test(cadena)) pistas.push('contiene corchetes [ ]')
  if (/["'`]/.test(cadena)) pistas.push('contiene comillas')
  if (!/:\d+\/[^/]+$/.test(cadena.split('?')[0] ?? '')) pistas.push('no termina en :PUERTO/base (por ejemplo :5432/postgres)')
  return pistas
}

async function main() {
  const generadoEn = new Date().toISOString()
  const cadena = normalizarCadena(process.env['PUBLICO_DB_URL'] ?? '')

  if (!cadena) {
    const vacio: PublicoVacio = { version: 1, vacio: true, motivo: 'PUBLICO_DB_URL no está configurada', generado_en: generadoEn }
    escribir(vacio)
    console.warn('! PUBLICO_DB_URL no está configurada: se escribió un publico.json vacío.')
    return
  }

  // El parámetro sslmode de la URL se reemplaza por la configuración explícita de abajo
  let url: URL
  try {
    url = new URL(cadena)
  } catch {
    const pistas = diagnosticar(cadena)
    throw new Error(
      'PUBLICO_DB_URL no es una URL válida' +
        (pistas.length > 0 ? `: ${pistas.join('; ')}` : '. Formato: postgresql://usuario:contraseña@host:5432/postgres'),
    )
  }
  url.searchParams.delete('sslmode')

  const ca = process.env['PUBLICO_DB_CA']
  if (!ca) {
    console.warn('! PUBLICO_DB_CA no está configurado: la conexión va cifrada pero sin verificar el certificado.')
  }

  const cliente = new pg.Client({
    connectionString: url.toString(),
    ssl: ca ? { ca } : { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  })
  await cliente.connect()
  try {
    const publico = await generarPublico({ query: (sql) => cliente.query(sql) }, { generadoEn })
    escribir(publico)
    console.log(
      `✓ ${SALIDA}: ${publico.asesorias.length} asesorías, ${publico.agregados.length} agregados, ` +
        `${publico.denominadores.length} denominadores (corte: ${publico.fecha_corte ?? 'sin datos'})`,
    )
  } finally {
    await cliente.end()
  }
}

main().catch((error: unknown) => {
  // Se imprime el mensaje, nunca la cadena de conexión ni filas de la base
  console.error('✗ No se pudo generar publico.json:', error instanceof Error ? error.message : 'error desconocido')
  process.exit(1)
})
