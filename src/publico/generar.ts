import { ensamblarPublico } from './ensamblar.ts'
import type {
  FilaAgregadoVista,
  FilaDenominadorVista,
  FilaMetaVista,
  FilaVista,
  PublicoJson,
} from './tipos.ts'
import { verificarPublico } from './verificar.ts'

/** Lo mínimo que necesita de una conexión (la cumplen pg y PGlite). */
export interface Consulta {
  query(sql: string): Promise<{ rows: unknown[] }>
}

export interface OpcionesGenerar {
  generadoEn: string
  aleatorio?: () => number
}

/**
 * Lee las cuatro vistas anonimizadas, arma publico.json y lo verifica.
 * Lanza un error (y por lo tanto el despliegue se detiene) si el contenido no se puede publicar.
 */
export async function generarPublico(db: Consulta, opciones: OpcionesGenerar): Promise<PublicoJson> {
  const leer = async <T>(vista: string): Promise<T[]> =>
    (await db.query(`select * from public.${vista}`)).rows as T[]

  const [filas, agregados, denominadores, metas] = [
    await leer<FilaVista>('vista_publica_asesorias'),
    await leer<FilaAgregadoVista>('vista_publica_agregados'),
    await leer<FilaDenominadorVista>('vista_publica_denominadores'),
    await leer<FilaMetaVista>('vista_publica_meta'),
  ]

  const publico = ensamblarPublico(filas, agregados, denominadores, metas[0], opciones)
  verificarPublico(publico)
  return publico
}
