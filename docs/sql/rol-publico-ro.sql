-- Rol de solo lectura para generar la capa pública (publico.json)
--
-- Se ejecuta UNA vez en Supabase → SQL Editor, DESPUÉS de las migraciones.
-- Antes de ejecutarlo, reemplazar <CONTRASEÑA_NUEVA> por una contraseña larga y
-- aleatoria que NO se haya usado en otro lugar. No guardarla en el repositorio:
-- va solo en el secreto PUBLICO_DB_URL de GitHub Actions.
--
-- Este rol solo puede leer las cuatro vistas anonimizadas. No ve tablas, no escribe.

create role publico_ro login password '<CONTRASEÑA_NUEVA>'
  nosuperuser nocreatedb nocreaterole noinherit;

grant usage on schema public to publico_ro;

grant select on public.vista_publica_asesorias,
                public.vista_publica_agregados,
                public.vista_publica_denominadores,
                public.vista_publica_meta
  to publico_ro;

-- Quien consulta una vista necesita permiso sobre las funciones que la vista usa.
grant execute on function public.rango_monto(numeric), public.rango_conteo(integer)
  to publico_ro;

alter role publico_ro set default_transaction_read_only = on;
alter role publico_ro set statement_timeout = '15s';
alter role publico_ro connection limit 3;
