# Asesorías Fonder Valle — Dashboard

Dashboard de las asesorías a beneficiarios de Fonder Valle (Infivalle).
Sitio estático (React + Vite) publicado en GitHub Pages, con datos en Supabase.

> **Estado:** F1 · datos y carga. Ya existen la validación y limpieza del TSV, la carga atómica a
> Supabase y la capa pública anonimizada. La interfaz (indicadores, gráficas, mapa) llega en F2 en adelante.

## Reglas de este repositorio (es público)

Todo lo que se sube se considera publicado, incluso si luego se borra.

**Nunca entran:** archivos TSV/Excel con datos, el instructivo de conexión, IPs o
endpoints de producción, archivos `.env`, llaves (`.pem`, `service_role`) ni las
consultas de extracción. Las pruebas usan solo datos sintéticos
(`tests/fixtures/`, con nombres y documentos inventados).

## Desarrollo local

Requiere Node 22 o superior.

```bash
npm install
cp .env.example .env.local   # completar URL y llave anon de Supabase (opcional en F0)
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor local |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript estricto |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run test:rls` | Prueba que la llave `anon` no accede a nada (necesita `SUPABASE_URL` y `SUPABASE_ANON_KEY`) |
| `npm run build` | Compila a `dist/` |
| `npm run build:functions` | Regenera la Edge Function empaquetada (`supabase/functions/cargar-datos/index.ts`) |
| `npm run cargar -- <archivo.tsv> [--confirmar]` | Valida o carga un TSV a Supabase (admin) |
| `npm run generar-publico` | Genera `public/publico.json` (lo usan los workflows) |

## Estructura

```
src/
  catalogo/     # tipo, etiqueta y opciones de cada campo
  formato/      # columnas esperadas de cada formato de TSV
  limpieza/     # lectura, validación, duplicados, municipios, categorías, atípicos
  funciones/    # lógica de las Edge Functions (se empaqueta en supabase/functions)
  publico/      # capa pública: ensamblado de publico.json y verificación de publicación
  lib/          # cliente de Supabase
scripts/        # carga local, generador de publico.json, empaquetado de funciones
supabase/
  migrations/   # tablas, RLS, carga atómica, vistas anonimizadas
  functions/    # Edge Functions (archivos generados)
tests/
  fixtures/     # TSV sintéticos
  sql/          # migraciones y vistas probadas en un Postgres embebido
  rls/          # prueba de acceso con la llave anon contra Supabase
docs/           # formato de datos, despliegue y carga
```

## Documentación

- [`docs/formato-v1.md`](docs/formato-v1.md) — columnas que espera el TSV actual.
- [`docs/despliegue-f0.md`](docs/despliegue-f0.md) — configuración de GitHub Pages y Supabase.
- [`docs/carga-datos.md`](docs/carga-datos.md) — migraciones, usuario admin, función de carga, capa pública y cómo cargar un TSV.
