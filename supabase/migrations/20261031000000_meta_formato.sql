-- F2 · La vista de meta informa el formato de la última carga
--
-- `publico.json` declara de dónde sale el municipio (`fuente_municipio`): con una carga v1 es la
-- ciudad de residencia; con una v2, el municipio de la empresa (con la residencia de respaldo).
-- Se agrega una columna AL FINAL de la vista; las existentes no cambian.
--
-- `create or replace view` conserva los permisos de la vista (el rol `publico_ro` sigue leyéndola
-- sin ningún GRANT nuevo). Aplicar después de 20261030000000_formato_v2.sql.

create or replace view public.vista_publica_meta as
select
  (select max(creada_en) from public.cargas)                                  as ultima_carga,
  count(*) filter (where conservada)::integer                                 as asesorias_conservadas,
  count(*) filter (where not conservada)::integer                             as asesorias_descartadas,
  count(distinct beneficiario_id) filter (where conservada)::integer          as beneficiarios_con_asesoria,
  (select formato from public.cargas order by id desc limit 1)                as ultimo_formato
from public.asesorias;
