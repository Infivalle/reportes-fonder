# Asesorías Fonder Valle — Dashboard

Dashboard de las asesorías a beneficiarios de Fonder Valle (Infivalle).
Sitio estático (React + Vite) publicado en GitHub Pages, con datos en Supabase.

> **Estado:** F0 · cimientos. El sitio publica una página vacía.

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

## Estructura

```
src/
  catalogo/     # tipo, etiqueta y opciones de cada campo (F2)
  formato/      # columnas esperadas de cada formato de TSV
  limpieza/     # lectura, duplicados, municipios, categorías (F1)
  lib/          # cliente de Supabase
supabase/
  migrations/   # tablas, RLS, bitácora
tests/
  fixtures/     # TSV sintéticos
  rls/          # prueba de acceso con la llave anon
docs/           # formato de datos y pasos de despliegue
```

## Documentación

- [`docs/formato-v1.md`](docs/formato-v1.md) — columnas que espera el TSV actual.
- [`docs/despliegue-f0.md`](docs/despliegue-f0.md) — configuración de GitHub Pages y Supabase.
