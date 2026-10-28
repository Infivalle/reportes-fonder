// Empaqueta las Edge Functions en un solo archivo.
//
// Por qué: el CLI de Supabase solo incluye al desplegar lo que está dentro de
// supabase/functions/<función>/. La lógica de limpieza vive en src/limpieza/ (la comparte
// el navegador), así que se empaqueta aquí y el resultado se versiona. Una prueba verifica
// que el archivo generado está al día.
//
// Uso:  npm run build:functions

import { build } from 'esbuild'
import { FUNCIONES, opciones } from './funciones.config.mjs'

for (const f of FUNCIONES) {
  await build(opciones(f, true))
  console.log(`✓ ${f.salida}`)
}
