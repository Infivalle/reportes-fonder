-- F0 · Migración inicial
-- Capa privada de datos del dashboard de asesorías Fonder Valle.
--
-- Principios:
--   1. RLS activo en TODAS las tablas. El rol `anon` no tiene ningún permiso.
--   2. El rol de la persona (admin / asesor) vive en app_metadata del token,
--      que solo el servidor puede escribir. Nunca en user_metadata.
--   3. Las cargas de datos y los cambios masivos los hacen las Edge Functions
--      con la llave service_role (que se salta RLS). El navegador solo lee.
--   4. Columnas en snake_case. La correspondencia con el TSV (p. ej.
--      creditUsageDescription -> credit_usage_description) la hace la
--      función de carga (F1).
--   5. `idasesor` queda fuera del modelo (siempre vale 0 en el origen).

-- ---------------------------------------------------------------------------
-- Rol de la sesión actual
-- ---------------------------------------------------------------------------
create or replace function public.rol_actual()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', '')
$$;

comment on function public.rol_actual() is
  'Rol de la sesión (admin | asesor) leído de app_metadata del token. Vacío si no hay.';

-- ---------------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------------
create table public.proyectos (
  id      bigint primary key,
  nombre  text not null unique
);

-- Total de beneficiarios por proyecto (lo carga el admin). Base de la cobertura.
create table public.denominadores (
  proyecto_id          bigint primary key references public.proyectos (id) on delete cascade,
  total_beneficiarios  integer not null check (total_beneficiarios >= 0),
  actualizado_en       timestamptz not null default now(),
  actualizado_por      uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Auditoría de cargas
-- ---------------------------------------------------------------------------
create table public.cargas (
  id                      bigint generated always as identity primary key,
  usuario_id              uuid references auth.users (id) on delete set null,
  archivo                 text not null,
  formato                 text not null check (formato in ('v1', 'v2')),
  filas_leidas            integer not null,
  asesorias_conservadas   integer not null,
  asesorias_descartadas   integer not null,
  beneficiarios_distintos integer not null,
  creada_en               timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Beneficiarios (datos personales: solo capa privada)
-- ---------------------------------------------------------------------------
create table public.beneficiarios (
  id                  bigint primary key,           -- id de origen (beneficiarios.id)
  documento           text not null unique,
  nombres             text,
  apellidos           text,
  email               text,
  celular             text,
  departamento        text,
  ciudad              text,                         -- ciudad de residencia (texto original)
  nombre_empresa      text,
  nit                 text,
  actividad_economica text,
  municipio_codigo    text,                         -- DIVIPOLA (42 municipios del Valle)
  municipio_origen    text not null default 'sin_ubicar'
                      check (municipio_origen in ('empresa', 'residencia', 'sin_ubicar'))
);

create index beneficiarios_municipio_idx on public.beneficiarios (municipio_codigo);

create table public.beneficiarios_proyecto (
  beneficiario_id  bigint not null references public.beneficiarios (id) on delete cascade,
  proyecto_id      bigint not null references public.proyectos (id) on delete cascade,
  primary key (beneficiario_id, proyecto_id)
);

-- ---------------------------------------------------------------------------
-- Asesorías (todas las filas del TSV; las descartadas quedan marcadas)
-- ---------------------------------------------------------------------------
create table public.asesorias (
  id                        bigint primary key,     -- id de origen (asesorias.id)
  beneficiario_id           bigint not null references public.beneficiarios (id) on delete cascade,

  credit_used_as_approved   text,
  credit_usage_description  text,
  other_improvement         text,
  time_to_results           text,
  results_as_expected       text,
  results_explanation       text,
  evidence_file             text,
  financial_records         text,
  resource_manager          text,
  other_resource_manager    text,
  payments_on_schedule      text,
  payment_explanation       text,
  satisfaction              text,
  need_another_credit       text,
  credit_intended_use       text,
  monthly_income            numeric(14, 0),
  fixed_costs               numeric(14, 0),
  variable_costs            numeric(14, 0),
  debt_level                numeric(10, 2),
  credit_used_percentage    numeric(10, 2),
  monthly_payment           numeric(14, 0),
  emergency_reserve         numeric(14, 0),
  monthly_clients           integer,
  monthly_sales             integer,
  total_sales_value         numeric(14, 0),
  current_employees         text,
  other_sales_channel       text,
  evidence_visit_file       text,
  estado                    text,
  observaciones             text,

  creada_en                 timestamptz not null,   -- created_at del origen, ya en hora real (UTC)
  actualizada_en            timestamptz,

  conservada                boolean not null default true,
  motivo_descarte           text,
  atipica                   boolean not null default false,  -- monto atípico marcado, no corregido
  carga_id                  bigint references public.cargas (id) on delete set null,

  check (conservada or motivo_descarte is not null)
);

create index asesorias_beneficiario_idx on public.asesorias (beneficiario_id);
create index asesorias_conservada_idx   on public.asesorias (conservada);

create table public.asesoria_mejoras (
  asesoria_id  bigint not null references public.asesorias (id) on delete cascade,
  codigo       text not null,
  primary key (asesoria_id, codigo)
);

create table public.asesoria_canales (
  asesoria_id  bigint not null references public.asesorias (id) on delete cascade,
  codigo       text not null,
  primary key (asesoria_id, codigo)
);

-- ---------------------------------------------------------------------------
-- Bitácora (habeas data): consultas de ficha y exportaciones completas
-- ---------------------------------------------------------------------------
create table public.bitacora (
  id               bigint generated always as identity primary key,
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  accion           text not null
                   check (accion in ('consulta_ficha', 'exporta_ficha_pdf', 'exporta_excel_completo')),
  beneficiario_id  bigint,
  detalle          jsonb,
  creada_en        timestamptz not null default now()
);

create index bitacora_usuario_idx on public.bitacora (usuario_id, creada_en desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.proyectos               enable row level security;
alter table public.denominadores           enable row level security;
alter table public.cargas                  enable row level security;
alter table public.beneficiarios           enable row level security;
alter table public.beneficiarios_proyecto  enable row level security;
alter table public.asesorias               enable row level security;
alter table public.asesoria_mejoras        enable row level security;
alter table public.asesoria_canales        enable row level security;
alter table public.bitacora                enable row level security;

-- Lectura: solo asesor y admin con sesión iniciada.
-- (Las escrituras de datos las hace la Edge Function con service_role.)
create policy "staff lee proyectos" on public.proyectos
  for select to authenticated
  using (public.rol_actual() in ('admin', 'asesor'));

create policy "staff lee denominadores" on public.denominadores
  for select to authenticated
  using (public.rol_actual() in ('admin', 'asesor'));

create policy "staff lee beneficiarios" on public.beneficiarios
  for select to authenticated
  using (public.rol_actual() in ('admin', 'asesor'));

create policy "staff lee beneficiarios_proyecto" on public.beneficiarios_proyecto
  for select to authenticated
  using (public.rol_actual() in ('admin', 'asesor'));

create policy "staff lee asesorias" on public.asesorias
  for select to authenticated
  using (public.rol_actual() in ('admin', 'asesor'));

create policy "staff lee asesoria_mejoras" on public.asesoria_mejoras
  for select to authenticated
  using (public.rol_actual() in ('admin', 'asesor'));

create policy "staff lee asesoria_canales" on public.asesoria_canales
  for select to authenticated
  using (public.rol_actual() in ('admin', 'asesor'));

-- Denominadores: el admin los gestiona desde la app.
create policy "admin escribe denominadores" on public.denominadores
  for all to authenticated
  using (public.rol_actual() = 'admin')
  with check (public.rol_actual() = 'admin');

-- Cargas: solo el admin las ve.
create policy "admin lee cargas" on public.cargas
  for select to authenticated
  using (public.rol_actual() = 'admin');

-- Bitácora: staff registra SUS propias acciones; solo el admin la lee.
create policy "staff registra bitacora" on public.bitacora
  for insert to authenticated
  with check (public.rol_actual() in ('admin', 'asesor') and usuario_id = auth.uid());

create policy "admin lee bitacora" on public.bitacora
  for select to authenticated
  using (public.rol_actual() = 'admin');

-- ---------------------------------------------------------------------------
-- Permisos: `anon` no tiene nada. `authenticated` solo lo que RLS permita.
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

-- Que las tablas futuras tampoco se abran a `anon` por defecto.
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

grant select                         on public.proyectos, public.beneficiarios,
                                        public.beneficiarios_proyecto, public.asesorias,
                                        public.asesoria_mejoras, public.asesoria_canales,
                                        public.cargas                          to authenticated;
grant select, insert, update, delete on public.denominadores                   to authenticated;
grant select, insert                 on public.bitacora                        to authenticated;
grant usage on sequence public.bitacora_id_seq                                 to authenticated;
-- Las funciones nuevas dan EXECUTE a PUBLIC por defecto (y `anon` lo hereda).
revoke execute on function public.rol_actual() from public;
grant  execute on function public.rol_actual() to authenticated;
