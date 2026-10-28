# Despliegue de F0

## 1. GitHub

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Code security**: activar *Secret scanning* y *Push protection*.
3. (Más adelante, cuando exista Supabase) **Settings → Secrets and variables → Actions → Variables**:
   crear `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Ambas son públicas por diseño,
   por eso son *variables* y no *secrets*.

El workflow `deploy.yml` publica en cada push a `main`. La primera vez, el sitio queda en
`https://<owner>.github.io/repotes-fonder/`.

## 2. Supabase

1. Crear el proyecto en la región **São Paulo (sa-east-1)**.
2. **Authentication → Sign In / Providers → Email**: desactivar *Allow new users to sign up*.
3. **SQL Editor**: pegar y ejecutar `supabase/migrations/20261027000000_inicial.sql`.
4. Verificar con la prueba de F0 (solo necesita la URL y la llave **anon**):

```bash
SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=eyJ... npm run test:rls
```

Debe pasar sin errores: la llave `anon` no lee ni escribe ninguna tabla.

**Nunca** pegar en el chat, en el repositorio ni en una variable de Actions la llave
`service_role` ni la contraseña de la base de datos.
