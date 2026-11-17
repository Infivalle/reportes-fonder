-- F4 · Bitácora de exportaciones a Excel
--
-- La acción `exporta_excel_completo` (data limpia) ya existía. Se agrega `exporta_excel_cruce`
-- (cruce de la cartera Fonder con las asesorías).
--
-- Además, la política de inserción se endurece: las exportaciones solo las puede registrar un
-- admin. La interfaz registra ANTES de generar el archivo y no lo entrega si el registro falla,
-- así que un asesor que intente exportar por su cuenta no obtiene el archivo por esta vía.
-- (Ojo: RLS sigue dejando a asesor y admin leer las tablas; esta política protege la bitácora y
-- la ruta de la interfaz, no impide una consulta directa de lectura por parte de un asesor.)
--
-- Aplicar antes de desplegar la interfaz nueva.

alter table public.bitacora drop constraint if exists bitacora_accion_check;
alter table public.bitacora
  add constraint bitacora_accion_check
  check (accion in ('consulta_ficha', 'exporta_ficha_pdf', 'exporta_excel_completo', 'exporta_excel_cruce'));

drop policy if exists "staff registra bitacora" on public.bitacora;

create policy "staff registra bitacora" on public.bitacora
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and (
      (accion in ('consulta_ficha', 'exporta_ficha_pdf') and public.rol_actual() in ('admin', 'asesor'))
      or
      (accion in ('exporta_excel_completo', 'exporta_excel_cruce') and public.rol_actual() = 'admin')
    )
  );
