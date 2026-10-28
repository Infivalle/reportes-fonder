# Formato v2 del TSV

La consulta de extracción ampliada entrega **61 columnas**: las 52 de v1, sin cambios y en el mismo
orden, más 9 de `beneficiarios` al final. El cargador reconoce el formato por el encabezado: si trae
alguna de las nueve columnas nuevas se valida como v2; si no, como v1. Las dos versiones siguen
funcionando.

La consulta de extracción **no** se guarda en este repositorio (es público). Vive en el README del
proyecto, fuera del repositorio.

## Columnas nuevas

| Columna del TSV | Columna en la base (`beneficiarios`) | Tipo | Si el valor no se puede leer |
|---|---|---|---|
| `municipioempresa` | `municipio_empresa` | texto original | n/a |
| `tipoempresa` | `tipo_empresa` | texto | n/a |
| `aniofundacion` | `anio_fundacion` | entero entre 1800 y 2100 | se deja vacío y se avisa |
| `empleosgenerado` | `empleos_generados` | texto (rango) | se conserva tal cual; se repara la letra dañada "�" en palabras conocidas |
| `empleosagenerar` | `empleos_a_generar` | texto (rango) | se conserva tal cual; se repara la letra dañada "�" en palabras conocidas |
| `patrimonio` | `patrimonio` | numérico | se deja vacío y se avisa |
| `pasivos` | `pasivos` | numérico | se deja vacío y se avisa |
| `dinerosolicitado` | `dinero_solicitado` | numérico | se deja vacío y se avisa |
| `cuotas` | `cuotas` | numérico | se deja vacío y se avisa |

**Lectura tolerante.** Estas columnas no alimentan ningún indicador y el tipo de origen de las
cuatro financieras no está confirmado. Por eso un valor ilegible (por ejemplo `12 cuotas`) **no
rechaza el archivo**: queda vacío y el resumen de la carga lo lista en `advertencias` (las primeras
10 y el total del resto). Las 52 columnas que ya existían siguen con la regla estricta de siempre.

## Municipio

1. Si `municipioempresa` es un municipio del Valle, se usa ese (`municipio_origen = 'empresa'`).
2. Si está vacío o no es del Valle, se usa la ciudad de residencia (`'residencia'`).
3. Si tampoco, queda sin ubicar (`'sin_ubicar'`).

`municipioempresa` no trae departamento, así que no se puede distinguir "Bolívar, Valle" de
"Bolívar, Cauca": se toma como el del Valle. Es razonable porque el programa es del Valle.

El resumen de la carga trae `municipiosPorOrigen` (cuántos beneficiarios por origen) y, en
`municipiosSinReconocer`, cada texto con el campo del que viene (`municipioempresa` o `ciudad`).
Un texto de empresa que no se reconoce se lista aunque la residencia lo rescate, para poder
agregarle un alias en `src/limpieza/municipios.ts`.

Hay alias para los municipios con tilde cuyo origen trae la letra dañada (`TULU�` y `LA UNI�N`,
entre otros): al normalizar, el carácter dañado queda como espacio o desaparece.

## Capa pública

Ninguna columna nueva sale a `publico.json`. Las vistas `vista_publica_*` eligen sus columnas una
por una. Patrimonio, pasivos, dinero solicitado y cuotas son datos personales: solo capa privada.

## Cómo se aplica (en este orden)

1. **Migración** `supabase/migrations/20261030000000_formato_v2.sql`. Agrega las columnas y
   endurece `reemplazar_datos`: una clave del payload sin columna en la tabla es un error y la
   transacción no cambia nada. Sin esta migración, una carga v2 terminaría "bien" y descartaría
   las columnas nuevas sin avisar.
2. `npm run build:functions` y desplegar la función `cargar-datos`.
3. Cargar el archivo v2 (`npm run cargar -- data\asesorias_v2.tsv`, y luego con `--confirmar`).
4. Lanzar Deploy y verificar.

## Verificación después de cargar

```sql
select count(*)                                                  as beneficiarios,
       count(municipio_empresa)                                  as con_municipio_empresa,
       count(*) filter (where municipio_origen = 'empresa')      as ubicados_por_empresa,
       count(*) filter (where municipio_origen = 'residencia')   as ubicados_por_residencia,
       count(*) filter (where municipio_origen = 'sin_ubicar')   as sin_ubicar,
       count(patrimonio)                                         as con_patrimonio
from public.beneficiarios;
```

Con el archivo del 28 de octubre se espera 173 beneficiarios, todos con municipio de la empresa.
