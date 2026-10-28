-- F2 · Formato v2 del TSV
--
-- La consulta de extracción ampliada trae nueve columnas más de `beneficiarios`. Aquí se agregan
-- a la tabla (capa privada) y se endurece `reemplazar_datos` para que una carga nunca pierda
-- datos en silencio.
--
-- Orden de aplicación: ESTA migración primero, después desplegar la función `cargar-datos` y
-- por último cargar el archivo v2.
--
-- Ninguna de estas columnas sale a la capa pública: las vistas `vista_publica_*` eligen sus
-- columnas una por una y no usan `b.*`. `anon` no tiene permisos y `authenticated` solo lee
-- con rol admin o asesor (RLS de la migración inicial).

alter table public.beneficiarios
  add column if not exists municipio_empresa  text,     -- texto original; el código DIVIPOLA elegido está en municipio_codigo
  add column if not exists tipo_empresa       text,
  add column if not exists anio_fundacion     integer,
  add column if not exists empleos_generados  text,
  add column if not exists empleos_a_generar  text,
  -- Situación financiera de la solicitud (dato personal). `numeric` sin escala: el tipo de origen
  -- no está confirmado y un valor decimal no debe truncarse ni desbordar.
  add column if not exists patrimonio         numeric,
  add column if not exists pasivos            numeric,
  add column if not exists dinero_solicitado  numeric,
  add column if not exists cuotas             numeric;

comment on column public.beneficiarios.municipio_empresa is
  'Municipio de la empresa tal como viene del origen (formato v2). municipio_codigo usa este texto si es del Valle y, si no, la ciudad de residencia.';
comment on column public.beneficiarios.patrimonio is 'Formato v2. Dato personal: solo capa privada.';
comment on column public.beneficiarios.pasivos is 'Formato v2. Dato personal: solo capa privada.';
comment on column public.beneficiarios.dinero_solicitado is 'Formato v2. Dato personal: solo capa privada.';
comment on column public.beneficiarios.cuotas is 'Formato v2. Dato personal: solo capa privada.';

-- ---------------------------------------------------------------------------
-- reemplazar_datos con control de columnas.
--
-- jsonb_populate_recordset ignora en silencio las claves que la tabla no tiene. Si alguien carga
-- un archivo v2 sin haber aplicado esta migración, la carga "funcionaría" y descartaría las
-- columnas nuevas sin avisar. Ahora una clave sin columna es un error y la transacción no
-- cambia nada. El resto de la función es idéntico al de la migración 20261028000000.
-- ---------------------------------------------------------------------------
create or replace function public.reemplazar_datos(p jsonb, p_usuario uuid default null)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_carga      bigint;
  v_esperadas  integer;
  v_insertadas integer;
  v_faltan     text[];
begin
  if p is null or jsonb_typeof(p) <> 'object' or p -> 'carga' is null then
    raise exception 'Carga útil inválida';
  end if;

  -- Toda clave de la carga debe tener su columna (se revisa la primera fila de cada tabla:
  -- todas las filas se arman con las mismas claves).
  select array_agg(k order by k) into v_faltan
  from jsonb_object_keys(coalesce(p -> 'beneficiarios' -> 0, '{}'::jsonb)) as k
  where k not in (select column_name from information_schema.columns
                   where table_schema = 'public' and table_name = 'beneficiarios');
  if v_faltan is not null then
    raise exception 'La tabla beneficiarios no tiene las columnas: %. Aplique las migraciones pendientes.',
      array_to_string(v_faltan, ', ');
  end if;

  select array_agg(k order by k) into v_faltan
  from jsonb_object_keys(coalesce(p -> 'asesorias' -> 0, '{}'::jsonb)) as k
  where k not in (select column_name from information_schema.columns
                   where table_schema = 'public' and table_name = 'asesorias');
  if v_faltan is not null then
    raise exception 'La tabla asesorias no tiene las columnas: %. Aplique las migraciones pendientes.',
      array_to_string(v_faltan, ', ');
  end if;

  -- Registro de la carga (si algo falla más abajo, se revierte junto con todo lo demás)
  insert into public.cargas
    (usuario_id, archivo, formato, filas_leidas, asesorias_conservadas,
     asesorias_descartadas, beneficiarios_distintos)
  select p_usuario, c.archivo, c.formato, c.filas_leidas, c.asesorias_conservadas,
         c.asesorias_descartadas, c.beneficiarios_distintos
  from jsonb_to_record(p -> 'carga') as c(
    archivo text, formato text, filas_leidas integer, asesorias_conservadas integer,
    asesorias_descartadas integer, beneficiarios_distintos integer)
  returning id into v_carga;

  -- Borrado (WHERE true: algunas configuraciones rechazan DELETE sin WHERE)
  delete from public.asesoria_mejoras        where true;
  delete from public.asesoria_canales        where true;
  delete from public.asesorias               where true;
  delete from public.beneficiarios_proyecto  where true;
  delete from public.beneficiarios           where true;

  insert into public.proyectos (nombre)
  select distinct x
  from jsonb_array_elements_text(coalesce(p -> 'proyectos', '[]'::jsonb)) as x
  on conflict (nombre) do nothing;

  insert into public.beneficiarios
  select * from jsonb_populate_recordset(
    null::public.beneficiarios, coalesce(p -> 'beneficiarios', '[]'::jsonb));

  insert into public.beneficiarios_proyecto (beneficiario_id, proyecto_id)
  select distinct r.beneficiario_id, pr.id
  from jsonb_to_recordset(coalesce(p -> 'beneficiarios_proyecto', '[]'::jsonb))
         as r(beneficiario_id bigint, proyecto text)
  join public.proyectos pr on pr.nombre = r.proyecto;

  insert into public.asesorias
  select * from jsonb_populate_recordset(
    null::public.asesorias, coalesce(p -> 'asesorias', '[]'::jsonb));

  update public.asesorias set carga_id = v_carga where true;

  insert into public.asesoria_mejoras (asesoria_id, codigo)
  select distinct r.asesoria_id, r.codigo
  from jsonb_to_recordset(coalesce(p -> 'asesoria_mejoras', '[]'::jsonb))
         as r(asesoria_id bigint, codigo text);

  insert into public.asesoria_canales (asesoria_id, codigo)
  select distinct r.asesoria_id, r.codigo
  from jsonb_to_recordset(coalesce(p -> 'asesoria_canales', '[]'::jsonb))
         as r(asesoria_id bigint, codigo text);

  -- Control: lo que quedó en la tabla debe ser lo que se envió
  v_esperadas := jsonb_array_length(coalesce(p -> 'asesorias', '[]'::jsonb));
  select count(*) into v_insertadas from public.asesorias;
  if v_insertadas <> v_esperadas then
    raise exception 'Se esperaban % asesorías y quedaron %', v_esperadas, v_insertadas;
  end if;

  return v_carga;
end;
$$;

comment on function public.reemplazar_datos(jsonb, uuid) is
  'Reemplaza todos los datos de asesorías en una transacción. Solo service_role.';

-- Se repiten los permisos por si el entorno no conserva los de la versión anterior.
revoke all on function public.reemplazar_datos(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.reemplazar_datos(jsonb, uuid) to service_role;
