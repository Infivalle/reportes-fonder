import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { COLUMNAS_V1 } from '../../src/formato/v1.ts'

/**
 * Postgres embebido (PGlite) con lo que Supabase provee: roles anon / authenticated /
 * service_role, el esquema `auth` y permisos por defecto más permisivos que los del proyecto
 * real (si pasa aquí, pasa allá).
 */

const CARPETA_MIGRACIONES = new URL('../../supabase/migrations/', import.meta.url)

export const SUPABASE_SIMULADO = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_app_meta_data jsonb
  );
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;

  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth   to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`

/** Crea la base y aplica TODAS las migraciones en orden. */
export async function crearBaseSupabase(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_SIMULADO)
  const archivos = readdirSync(CARPETA_MIGRACIONES).filter((f) => f.endsWith('.sql')).sort()
  for (const archivo of archivos) {
    await db.exec(readFileSync(new URL(archivo, CARPETA_MIGRACIONES), 'utf-8'))
  }
  return db
}

export async function contar(db: PGlite, tabla: string): Promise<number> {
  const r = await db.query<{ n: string }>(`select count(*)::text as n from public.${tabla}`)
  return Number(r.rows[0]?.n)
}

/** Ejecuta `fn` con el rol y las claims JWT indicados, y vuelve al rol original. */
export async function comoRol<T>(
  db: PGlite,
  rol: string,
  claims: object | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims ? JSON.stringify(claims) : ''])
  await db.exec(`set role ${rol}`)
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
    await db.query(`select set_config('request.jwt.claims', '', false)`)
  }
}

/** Crea el rol de solo lectura ejecutando el mismo archivo SQL que se usará en Supabase. */
export async function crearRolPublico(db: PGlite): Promise<void> {
  const sql = readFileSync(new URL('../../docs/sql/rol-publico-ro.sql', import.meta.url), 'utf-8')
  await db.exec(sql.replace('<CONTRASEÑA_NUEVA>', 'contraseña-de-prueba'))
}

// ---------------------------------------------------------------------------
// Datos sintéticos para pruebas con volumen
// ---------------------------------------------------------------------------

export interface FilaSintetica {
  id: number
  beneficiario: number
  ciudad: string
  proyecto: string
  creadaEn?: string
  /** Sobrescribe columnas del TSV por nombre. */
  columnas?: Record<string, string | number>
}

const PLANTILLA: Record<string, string> = {
  idasesor: '0', creditusedasapproved: 'Sí', creditUsageDescription: 'texto libre de prueba',
  timetoresults: 'De 1 a 3 meses', resultsasexpected: 'Sí', resultsExplanation: 'explicación de prueba',
  financialRecords: 'Sí', resourcemanager: 'Yo mismo', paymentsonschedule: 'Sí',
  satisfaction: 'Muy satisfecho', needanothercredit: 'No', monthlyIncome: '2500000', fixedCosts: '600000',
  variableCosts: '900000', debtLevel: '12.50', creditUsedPercentage: '100.00', monthlyPayment: '180000',
  emergencyReserve: '300000', monthlyClients: '40', monthlySales: '55', totalSalesValue: '2800000',
  currentemployees: 'De 1 a 5', estado: 'ACTIVO', es_duplicado: 'NO', asesor: 'NO REGISTRADO',
  departamento: 'Valle del Cauca', actividadeconomica: 'Comercio', mejoras_codigos: 'CT', canales_venta_codigos: 'TF',
}

/** Arma un TSV v1 válido (datos inventados) a partir de una lista de filas. */
export function tsvSintetico(filas: readonly FilaSintetica[]): string {
  const lineas = filas.map((f) => {
    const creada = f.creadaEn ?? `2026-10-${String(10 + (f.id % 15)).padStart(2, '0')} 15:00:00`
    const valores: Record<string, string | number> = {
      ...PLANTILLA,
      id: f.id,
      idbeneficiario: f.beneficiario,
      created_at: creada,
      updated_at: creada,
      documento: `99${String(f.beneficiario).padStart(6, '0')}`,
      benef_nombres: `Persona${f.beneficiario}`,
      benef_apellidos: 'Prueba',
      email: `persona${f.beneficiario}@ejemplo.invalid`,
      celular: `3000${String(f.beneficiario).padStart(6, '0')}`,
      ciudad: f.ciudad,
      nombreempresa: `Negocio ficticio ${f.beneficiario}`,
      nit: `9000${f.beneficiario}-1`,
      proyectos: f.proyecto,
      ...f.columnas,
    }
    return COLUMNAS_V1.map((c) => String(valores[c] ?? 'NULL')).join('\t')
  })
  return [COLUMNAS_V1.join('\t'), ...lineas].join('\n') + '\n'
}
