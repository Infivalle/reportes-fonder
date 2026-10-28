-- F1 · Capa pública anonimizada
--
-- Vistas que alimentan `publico.json`. Las lee el rol `publico_ro` (solo lectura, solo estas
-- vistas; ver docs/sql/rol-publico-ro.sql) desde GitHub Actions. Nadie más debe verlas:
-- se revoca todo a anon y authenticated.
--
-- Qué NO sale nunca de aquí: documento, nombres, correo, celular, NIT, empresa, dirección,
-- textos libres, archivos de evidencia, ids de base, montos exactos, fecha exacta.
--
-- Qué sí: respuestas categóricas, montos en rangos, mes, proyecto, municipio (DIVIPOLA),
-- códigos de mejoras y canales, porcentajes. Los agregados de montos solo existen para
-- grupos de 5 o más beneficiarios.

-- ---------------------------------------------------------------------------
-- Rangos. Las etiquetas deben coincidir con src/publico/rangos.ts (una prueba lo verifica).
-- ---------------------------------------------------------------------------
create or replace function public.rango_monto(v numeric)
returns text
language sql
immutable
as $fn$
  select case
    when v is null or v < 0   then null
    when v < 500000           then 'Menos de $500 mil'
    when v < 1000000          then '$500 mil a $1 millón'
    when v < 2000000          then '$1 a $2 millones'
    when v < 5000000          then '$2 a $5 millones'
    when v < 10000000         then '$5 a $10 millones'
    when v < 20000000         then '$10 a $20 millones'
    else                           'Más de $20 millones'
  end
$fn$;

create or replace function public.rango_conteo(v integer)
returns text
language sql
immutable
as $fn$
  select case
    when v is null or v < 0 then null
    when v <= 10            then '0 a 10'
    when v <= 25            then '11 a 25'
    when v <= 50            then '26 a 50'
    when v <= 100           then '51 a 100'
    else                         'Más de 100'
  end
$fn$;

-- ---------------------------------------------------------------------------
-- Una fila por asesoría conservada y proyecto del beneficiario.
-- asesoria_ref y beneficiario_ref son números consecutivos sin relación con los ids de la
-- base; el generador los reemplaza por identificadores aleatorios nuevos en cada carga.
-- ---------------------------------------------------------------------------
create or replace view public.vista_publica_asesorias as
select
  dense_rank() over (order by a.id)              as asesoria_ref,
  dense_rank() over (order by a.beneficiario_id) as beneficiario_ref,
  coalesce(p.nombre, 'Sin proyecto')             as proyecto,
  b.municipio_codigo,
  -- Mes en hora de Colombia (UTC-5, sin horario de verano)
  to_char((a.creada_en at time zone 'UTC') - interval '5 hours', 'YYYY-MM') as mes,

  a.credit_used_as_approved,
  a.time_to_results,
  a.results_as_expected,
  a.financial_records,
  a.resource_manager,
  a.payments_on_schedule,
  a.satisfaction,
  a.need_another_credit,
  a.current_employees,

  public.rango_monto(a.monthly_income)      as rango_ingreso_mensual,
  public.rango_monto(a.fixed_costs)         as rango_costos_fijos,
  public.rango_monto(a.variable_costs)      as rango_costos_variables,
  public.rango_monto(a.monthly_payment)     as rango_cuota_mensual,
  public.rango_monto(a.emergency_reserve)   as rango_reserva_emergencia,
  public.rango_monto(a.total_sales_value)   as rango_ventas_total,
  public.rango_conteo(a.monthly_clients)    as rango_clientes_mes,
  public.rango_conteo(a.monthly_sales)      as rango_ventas_mes,

  a.credit_used_percentage,
  a.debt_level,

  coalesce((select array_agg(m.codigo order by m.codigo)
              from public.asesoria_mejoras m where m.asesoria_id = a.id), '{}'::text[]) as mejoras,
  coalesce((select array_agg(c.codigo order by c.codigo)
              from public.asesoria_canales c where c.asesoria_id = a.id), '{}'::text[]) as canales,

  a.atipica
from public.asesorias a
join public.beneficiarios b             on b.id = a.beneficiario_id
left join public.beneficiarios_proyecto bp on bp.beneficiario_id = b.id
left join public.proyectos p            on p.id = bp.proyecto_id
where a.conservada;

-- ---------------------------------------------------------------------------
-- Promedios y medianas de montos por proyecto y por proyecto × municipio.
-- Solo grupos con 5 o más beneficiarios distintos. Los montos atípicos no entran.
-- ---------------------------------------------------------------------------
create or replace view public.vista_publica_agregados as
with base as (
  select coalesce(p.nombre, 'Sin proyecto') as proyecto,
         b.municipio_codigo,
         a.beneficiario_id,
         a.id as asesoria_id,
         a.atipica,
         a.monthly_income, a.fixed_costs, a.variable_costs,
         a.monthly_payment, a.emergency_reserve, a.total_sales_value
    from public.asesorias a
    join public.beneficiarios b                on b.id = a.beneficiario_id
    left join public.beneficiarios_proyecto bp on bp.beneficiario_id = b.id
    left join public.proyectos p               on p.id = bp.proyecto_id
   where a.conservada
)
select
  proyecto,
  municipio_codigo,
  case when grouping(municipio_codigo) = 1 then 'proyecto' else 'municipio' end as nivel,
  count(distinct beneficiario_id)::integer as n_beneficiarios,
  count(distinct asesoria_id)::integer     as n_asesorias,

  round(avg(monthly_income)    filter (where not atipica))                                        as promedio_ingreso_mensual,
  round((percentile_cont(0.5) within group (order by monthly_income) filter (where not atipica))::numeric)    as mediana_ingreso_mensual,
  round(avg(total_sales_value) filter (where not atipica))                                        as promedio_ventas_total,
  round((percentile_cont(0.5) within group (order by total_sales_value) filter (where not atipica))::numeric) as mediana_ventas_total,
  round(avg(fixed_costs)       filter (where not atipica))                                        as promedio_costos_fijos,
  round((percentile_cont(0.5) within group (order by fixed_costs) filter (where not atipica))::numeric)       as mediana_costos_fijos,
  round(avg(variable_costs)    filter (where not atipica))                                        as promedio_costos_variables,
  round((percentile_cont(0.5) within group (order by variable_costs) filter (where not atipica))::numeric)    as mediana_costos_variables,
  round(avg(monthly_payment)   filter (where not atipica))                                        as promedio_cuota_mensual,
  round((percentile_cont(0.5) within group (order by monthly_payment) filter (where not atipica))::numeric)   as mediana_cuota_mensual,
  round(avg(emergency_reserve) filter (where not atipica))                                        as promedio_reserva_emergencia,
  round((percentile_cont(0.5) within group (order by emergency_reserve) filter (where not atipica))::numeric) as mediana_reserva_emergencia
from base
group by grouping sets ((proyecto, municipio_codigo), (proyecto))
having count(distinct beneficiario_id) >= 5;

-- ---------------------------------------------------------------------------
-- Denominadores (para la cobertura) y datos de la última carga (fecha de corte).
-- ---------------------------------------------------------------------------
create or replace view public.vista_publica_denominadores as
select p.nombre as proyecto, d.total_beneficiarios
  from public.denominadores d
  join public.proyectos p on p.id = d.proyecto_id;

create or replace view public.vista_publica_meta as
select
  (select max(creada_en) from public.cargas)                                  as ultima_carga,
  count(*) filter (where conservada)::integer                                 as asesorias_conservadas,
  count(*) filter (where not conservada)::integer                             as asesorias_descartadas,
  count(distinct beneficiario_id) filter (where conservada)::integer          as beneficiarios_con_asesoria
from public.asesorias;

-- ---------------------------------------------------------------------------
-- Permisos: ni anon ni authenticated. Solo el rol de solo lectura (docs/sql/rol-publico-ro.sql)
-- y service_role.
-- ---------------------------------------------------------------------------
revoke all on public.vista_publica_asesorias,
              public.vista_publica_agregados,
              public.vista_publica_denominadores,
              public.vista_publica_meta
  from public, anon, authenticated;

revoke execute on function public.rango_monto(numeric), public.rango_conteo(integer)
  from public, anon, authenticated;
grant  execute on function public.rango_monto(numeric), public.rango_conteo(integer)
  to service_role;
