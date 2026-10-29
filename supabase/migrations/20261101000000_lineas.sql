-- F2 · Línea de crédito (Línea 1 / Línea 2)
--
-- El origen de las asesorías no guarda la línea. Se carga UNA vez desde el Excel de beneficiarios
-- netos (scripts/preparar-lineas.ts genera el SQL de carga) y se vuelve a cargar solo cuando haya
-- beneficiarios nuevos. La tabla es independiente de las asesorías: `reemplazar_datos` no la toca,
-- así que cada carga del TSV vuelve a cruzar por cédula sin perder las líneas.
--
-- Capa privada: la tabla lleva cédulas (en forma de clave normalizada). A la capa pública solo
-- sale `linea`, a través de vista_publica_asesorias (columna nueva AL FINAL; las existentes no cambian).
--
-- Orden: aplicar esta migración, cargar el SQL que genera el script y después desplegar el sitio.

-- Misma regla que src/lineas/lineas.ts (claveDocumento): solo letras y números, mayúsculas, sin ceros a la izquierda.
create or replace function public.clave_documento(d text)
returns text
language sql
immutable
as $fn$
  select nullif(ltrim(upper(regexp_replace(coalesce(d, ''), '[^0-9A-Za-z]', '', 'g')), '0'), '')
$fn$;

revoke execute on function public.clave_documento(text) from public, anon, authenticated;
grant  execute on function public.clave_documento(text) to service_role;

create table if not exists public.desembolsos (
  clave_documento  text primary key,
  linea            text not null check (linea in ('Línea 1', 'Línea 2')),
  anio             integer,                                  -- año del desembolso más reciente (privado)
  cargado_en       timestamptz not null default now()
);

comment on table public.desembolsos is
  'Línea de crédito por persona, cargada desde el Excel de beneficiarios netos. Capa privada: lleva cédulas.';

-- Sin políticas y sin permisos: solo el rol dueño y service_role la leen y escriben.
alter table public.desembolsos enable row level security;
revoke all on public.desembolsos from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vista pública: igual que la de 20261029000000_capa_publica.sql más `linea` al final.
-- `create or replace view` conserva los permisos (publico_ro no necesita ningún GRANT nuevo).
-- ---------------------------------------------------------------------------
create or replace view public.vista_publica_asesorias as
select
  dense_rank() over (order by a.id)              as asesoria_ref,
  dense_rank() over (order by a.beneficiario_id) as beneficiario_ref,
  coalesce(p.nombre, 'Sin proyecto')             as proyecto,
  b.municipio_codigo,
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

  a.atipica,

  -- Nueva. null = la persona no aparece en el Excel (queda fuera de las gráficas por línea).
  d.linea
from public.asesorias a
join public.beneficiarios b             on b.id = a.beneficiario_id
left join public.beneficiarios_proyecto bp on bp.beneficiario_id = b.id
left join public.proyectos p            on p.id = bp.proyecto_id
left join public.desembolsos d          on d.clave_documento = public.clave_documento(b.documento)
where a.conservada;
