-- F2 · Corrección de la vista pública con `linea`
--
-- La migración 20261101000000_lineas.sql cruzaba con la función public.clave_documento(). En
-- PostgreSQL, quien consulta una vista necesita EXECUTE sobre las funciones que la vista llama
-- (no se usan los permisos del dueño), y el rol `publico_ro` no lo tiene: la lectura fallaba con
-- "permission denied for function clave_documento".
--
-- Aquí la vista escribe la misma regla con funciones del sistema (que todo rol puede ejecutar), sin
-- ningún permiso nuevo para `publico_ro`. La regla debe seguir igual a la de public.clave_documento()
-- y a claveDocumento() en src/lineas/lineas.ts. `create or replace view` conserva los permisos.
--
-- Aplicar después de 20261101000000_lineas.sql.

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
left join public.desembolsos d          on d.clave_documento = nullif(ltrim(upper(regexp_replace(coalesce(b.documento, ''), '[^0-9A-Za-z]', '', 'g')), '0'), '')
where a.conservada;
