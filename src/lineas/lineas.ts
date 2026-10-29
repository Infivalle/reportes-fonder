/**
 * Línea de crédito (Línea 1 / Línea 2) de cada beneficiario neto.
 *
 * El origen de las asesorías no guarda la línea. Se toma del Excel de beneficiarios netos, que es la
 * fuente de verdad: aquí NO se recalcula con los topes de monto, solo se lee la columna "Línea" y se
 * comprueba que el archivo sea utilizable. Este módulo es puro (sin archivos ni red) para poder
 * probarlo; scripts/preparar-lineas.ts lo usa y escribe el SQL de carga.
 *
 * Privacidad: el resultado lleva cédulas. Nunca va al repositorio ni a publico.json (ahí solo sale la línea).
 */

export const LINEAS = ['Línea 1', 'Línea 2'] as const
export type Linea = (typeof LINEAS)[number]

/**
 * Clave de cruce entre el Excel y el TSV: solo letras y números, en mayúsculas y sin ceros a la
 * izquierda ("1.234.567", "1234567 " y "01234567" son la misma persona). null si queda vacía.
 * La función SQL public.clave_documento() de la migración 20261101000000 hace exactamente lo mismo.
 */
export function claveDocumento(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  const texto = typeof valor === 'number' ? (Number.isFinite(valor) ? valor.toFixed(0) : '') : String(valor)
  const limpio = texto.replace(/[^0-9A-Za-z]/g, '').toUpperCase().replace(/^0+/, '')
  return limpio === '' ? null : limpio
}

/** Acepta "Línea 1", "linea 1", "LÍNEA 2", "1", 2 … Devuelve null si no es una de las dos líneas. */
export function normalizarLinea(valor: unknown): Linea | null {
  if (valor === null || valor === undefined) return null
  const t = String(valor).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const m = /^(?:linea\s*)?([12])$/.exec(t)
  if (!m) return null
  return m[1] === '1' ? 'Línea 1' : 'Línea 2'
}

function anioDe(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : Number(String(valor ?? '').trim())
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null
}

export interface FilaExcel {
  /** Número de fila en el Excel (para los mensajes). */
  fila: number
  cedula: unknown
  anio: unknown
  linea: unknown
}

export interface Desembolso {
  clave: string
  linea: Linea
  anio: number | null
}

export interface ResultadoLineas {
  desembolsos: Desembolso[]
  /** Filas leídas con algún dato. */
  leidas: number
  /** Cédulas que aparecían más de una vez: se conservó el año más reciente. */
  repetidas: number
  /** Cédulas repetidas con el mismo año y distinta línea: no se pueden resolver, detienen la carga. */
  conflictos: number[]
  /** Problemas que impiden cargar (cédula vacía, línea desconocida…). Solo números de fila, nunca datos. */
  errores: string[]
  porLinea: Record<Linea, number>
}

const MAX_ERRORES_LISTADOS = 15

/** Valida las filas y deja una sola línea por persona (la del año más reciente). */
export function procesarLineas(filas: readonly FilaExcel[]): ResultadoLineas {
  const errores: string[] = []
  const conflictos: number[] = []
  const porClave = new Map<string, Desembolso & { fila: number }>()
  let leidas = 0
  let repetidas = 0
  let erroresTotales = 0
  const anotar = (msg: string) => {
    erroresTotales += 1
    if (errores.length < MAX_ERRORES_LISTADOS) errores.push(msg)
  }

  for (const f of filas) {
    const vacia = [f.cedula, f.anio, f.linea].every((v) => v === null || v === undefined || String(v).trim() === '')
    if (vacia) continue
    leidas += 1
    const clave = claveDocumento(f.cedula)
    const linea = normalizarLinea(f.linea)
    if (clave === null) {
      anotar(`Fila ${f.fila}: la cédula está vacía.`)
      continue
    }
    if (linea === null) {
      anotar(`Fila ${f.fila}: la línea no es "Línea 1" ni "Línea 2".`)
      continue
    }
    const nuevo = { clave, linea, anio: anioDe(f.anio), fila: f.fila }
    const previo = porClave.get(clave)
    if (!previo) {
      porClave.set(clave, nuevo)
      continue
    }
    repetidas += 1
    const a = previo.anio ?? -1
    const b = nuevo.anio ?? -1
    if (b > a) porClave.set(clave, nuevo)
    else if (a === b && previo.linea !== nuevo.linea) conflictos.push(nuevo.fila)
  }
  if (erroresTotales > errores.length) errores.push(`… y ${erroresTotales - errores.length} problemas más.`)
  for (const fila of conflictos) {
    errores.push(`Fila ${fila}: la misma cédula tiene líneas distintas en el mismo año; no se puede elegir.`)
  }

  const desembolsos = [...porClave.values()].map(({ clave, linea, anio }) => ({ clave, linea, anio }))
  const porLinea: Record<Linea, number> = { 'Línea 1': 0, 'Línea 2': 0 }
  for (const d of desembolsos) porLinea[d.linea] += 1
  return { desembolsos, leidas, repetidas, conflictos, errores, porLinea }
}

/** SQL de carga: reemplaza por completo la tabla de líneas, en una transacción. */
export function sqlDeCarga(desembolsos: readonly Desembolso[]): string {
  if (desembolsos.length === 0) throw new Error('No hay desembolsos que cargar.')
  const lote = 500
  const sentencias: string[] = []
  for (let i = 0; i < desembolsos.length; i += lote) {
    const valores = desembolsos
      .slice(i, i + lote)
      .map((d) => `('${d.clave.replace(/'/g, "''")}', '${d.linea}', ${d.anio ?? 'null'})`)
      .join(',\n  ')
    sentencias.push(`insert into public.desembolsos (clave_documento, linea, anio) values\n  ${valores};`)
  }
  return [
    '-- Generado por scripts/preparar-lineas.ts. CONTIENE CÉDULAS: no subir al repositorio.',
    'begin;',
    'delete from public.desembolsos where true;',
    ...sentencias,
    `do $$ begin if (select count(*) from public.desembolsos) <> ${desembolsos.length} then raise exception 'La tabla desembolsos no quedó con ${desembolsos.length} filas'; end if; end $$;`,
    'commit;',
    '',
    '-- Comprobación: cuántas personas con asesoría quedaron con línea.',
    'select count(*) as con_asesoria,',
    '       count(d.linea) as con_linea,',
    '       count(*) - count(d.linea) as sin_linea',
    'from public.beneficiarios b',
    'left join public.desembolsos d on d.clave_documento = public.clave_documento(b.documento)',
    'where exists (select 1 from public.asesorias a where a.beneficiario_id = b.id and a.conservada);',
    '',
  ].join('\n')
}
