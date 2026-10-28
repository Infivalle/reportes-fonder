// Configuración del empaquetado de las Edge Functions (la usan build-functions.mjs y las pruebas).

export const FUNCIONES = [
  {
    entrada: 'src/funciones/cargar-datos/entrada.ts',
    salida: 'supabase/functions/cargar-datos/index.ts',
  },
]

export const BANNER = [
  '// @ts-nocheck',
  '// GENERADO por scripts/build-functions.mjs a partir de src/. No editar a mano.',
  '// Para regenerar: npm run build:functions',
].join('\n')

/** Opciones de esbuild para una función. `escribir: false` devuelve el resultado sin tocar el disco. */
export function opciones(funcion, escribir) {
  return {
    entryPoints: [funcion.entrada],
    outfile: funcion.salida,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    legalComments: 'none',
    banner: { js: BANNER },
    write: escribir,
    logLevel: 'warning',
  }
}
