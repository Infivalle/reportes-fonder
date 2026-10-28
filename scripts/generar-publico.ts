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

async function main() {
  const generadoEn = new Date().toISOString()
  const cadena = process.env['PUBLICO_DB_URL']

  if (!cadena) {
    const vacio: PublicoVacio = { version: 1, vacio: true, motivo: 'PUBLICO_DB_URL no está configurada', generado_en: generadoEn }
    escribir(vacio)
    console.warn('! PUBLICO_DB_URL no está configurada: se escribió un publico.json vacío.')
    return
  }

  // El parámetro sslmode de la URL se reemplaza por la configuración explícita de abajo
  const url = new URL(cadena)
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
