# Carga de datos y capa pública (F1)

Guía para dejar funcionando la carga del TSV y la generación de `publico.json`.
Las direcciones y llaves reales **no** van en este repositorio (es público): se reemplazan
`<REF>`, `<…>` y similares por los valores del proyecto.

`<REF>` es el identificador de tu proyecto Supabase: la parte inicial de su URL
(`https://<REF>.supabase.co`).

## 1. Aplicar las migraciones nuevas

En **Supabase → SQL Editor**, ejecutar **en este orden**, cada archivo por separado:

1. `supabase/migrations/20261028000000_reemplazar_datos.sql`
   Endurece permisos, agrega la función de carga atómica y hace que el `id` de `proyectos` lo genere la base.
2. `supabase/migrations/20261029000000_capa_publica.sql`
   Crea las funciones de rangos y las cuatro vistas anonimizadas.

Cada una debe responder *Success. No rows returned*.

Luego, para comprobar que la llave pública sigue sin acceso (ahora incluye las vistas), repetir:

```powershell
$env:SUPABASE_URL="https://<REF>.supabase.co"; $env:SUPABASE_ANON_KEY="<llave publishable>"; npm run test:rls
```

## 2. Crear el usuario administrador

1. **Authentication → Users → Add user → Create new user**: correo, contraseña de 12 o más
   caracteres, y marcar *Auto Confirm User*.
2. En **SQL Editor**, darle el rol de admin. El rol va en `app_metadata`, que solo escribe el
   servidor; **nunca** en `user_metadata`, que el propio usuario puede modificar:

```sql
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"rol": "admin"}'::jsonb
 where email = '<correo del admin>';

select email, raw_app_meta_data from auth.users;   -- debe mostrar "rol": "admin"
```

La segunda cuenta de admin (recomendada) se crea igual.

## 3. Desplegar la Edge Function `cargar-datos`

Desde la carpeta del proyecto, con Node 22:

```powershell
npx supabase login
npx supabase functions deploy cargar-datos --project-ref <REF> --no-verify-jwt --use-api
```

- `--no-verify-jwt`: la función verifica la sesión por su cuenta y exige rol admin.
- `--use-api`: empaqueta en el servidor, no necesita Docker.
- El archivo `supabase/functions/cargar-datos/index.ts` es **generado** a partir de `src/`
  (`npm run build:functions`). No se edita a mano; una prueba falla si está desactualizado.

### Aviso automático a GitHub (opcional, recomendado)

Sin esto, la carga funciona igual, pero `publico.json` solo se actualiza con la tarea diaria.

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate**.
   Solo el repositorio `reportes-fonder`; permiso de repositorio **Contents: Read and write**
   (es lo que exige GitHub para disparar un `repository_dispatch`); vencimiento a 1 año y anotarlo.
2. Crear un archivo `.env.funciones` en la raíz (queda fuera de git por `.gitignore`):

```
GITHUB_REPO=infivalle/reportes-fonder
GITHUB_DISPATCH_TOKEN=<el token>
ALLOWED_ORIGIN=https://infivalle.github.io
```

3. Subirlo y borrarlo:

```powershell
npx supabase secrets set --env-file .env.funciones --project-ref <REF>
del .env.funciones
```

## 4. Rol de solo lectura y secretos de GitHub

El generador de `publico.json` se conecta con un rol que **solo** puede leer las cuatro vistas
anonimizadas: no ve tablas ni escribe.

1. Abrir `docs/sql/rol-publico-ro.sql`, copiar su contenido en el **SQL Editor** y reemplazar
   `<CONTRASEÑA_NUEVA>` por una contraseña de 32 caracteres, **solo letras y números** (así no
   hay que codificarla en la URL). No la guardes en el repositorio. Ejecutar.
2. **Connect → Session pooler** (funciona por IPv4, que es lo que usan los runners de GitHub).
   La cadena tiene la forma `postgresql://postgres.<REF>:[YOUR-PASSWORD]@<host del pooler>:5432/postgres`.
   Cambiar el usuario por `publico_ro.<REF>` y la contraseña por la del paso anterior.
3. GitHub → **Settings → Secrets and variables → Actions → Secrets → New repository secret**:
   - `PUBLICO_DB_URL`: la cadena anterior.
   - `PUBLICO_DB_CA` (opcional): certificado CA de Supabase en PEM
     (**Database → Settings → SSL Configuration → Download certificate**, pegar el contenido).
     Sin él la conexión va cifrada pero sin verificar el certificado.
4. En la pestaña **Variables** del mismo lugar (son públicas por diseño):
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (la llave publishable).

## 5. Cargar el TSV

1. Generar el TSV con la consulta de extracción (está en la documentación interna, no aquí) y
   guardarlo en `data\asesorias.tsv`. La carpeta `data/` está fuera de git.
2. Primero solo validar (no cambia nada):

```powershell
$env:SUPABASE_URL="https://<REF>.supabase.co"; $env:SUPABASE_ANON_KEY="<llave publishable>"
npm run cargar -- data\asesorias.tsv
```

Pide el correo y la contraseña del admin (la contraseña no se muestra al escribirla).

3. Revisar el resumen. Con los datos del 27 de octubre debe dar **204 filas, 168 asesorías
   conservadas, 36 descartadas y 168 beneficiarios**. Si hay municipios sin reconocer o valores
   fuera de catálogo, se listan ahí.
4. Cargar de verdad:

```powershell
npm run cargar -- data\asesorias.tsv --confirmar
```

La carga reemplaza todo en una sola transacción: o entra el archivo completo o no cambia nada.
Los proyectos y los denominadores se conservan.

5. Si configuraste el aviso a GitHub, el workflow **Deploy** arranca solo (2 a 5 minutos). Si no,
   en **Actions → Deploy → Run workflow**.
6. Comprobar `https://infivalle.github.io/reportes-fonder/publico.json`: no debe haber correos,
   documentos ni nombres. El generador ya lo verifica y detiene el despliegue si algo no cumple.

## Qué se rechaza y qué se advierte

**Se rechaza el archivo completo** (no cambia nada): encabezado distinto al formato v1, filas con
distinto número de columnas, fechas/números/ids que no se pueden convertir, asesoría sin documento
de beneficiario, ids de asesoría repetidos, o el mismo documento en dos beneficiarios.

**Se advierte y se continúa**: municipios que no se pueden ubicar en el Valle, respuestas fuera
del catálogo (se conservan tal cual) y montos atípicos (se marcan, no se corrigen).

## Agregar un alias de municipio

Si el resumen lista un texto que sí es un municipio del Valle (por ejemplo, "Guadalajara Buga"):

1. Agregarlo en `ALIAS` de `src/limpieza/municipios.ts` (texto sin tildes y en mayúsculas).
2. `npm run build:functions`, commit y push.
3. Volver a desplegar la función (paso 3).

## Límites conocidos

- Los workflows programados de un repositorio público se desactivan tras 60 días sin commits.
  Si el repositorio queda quieto, reactivar `Diario` en la pestaña Actions.
- El token de GitHub del paso 3 vence: renovarlo antes de la fecha anotada.
- Las opciones de las respuestas (`src/catalogo/opciones.ts`) son provisionales hasta tener el
  PDF del formulario.
