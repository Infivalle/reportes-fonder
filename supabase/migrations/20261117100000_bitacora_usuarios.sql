-- F4 · Acciones de gestión de usuarios en la bitácora
--
-- Las escribe SOLO la Edge Function `gestionar-usuarios` (con service_role, que se salta RLS).
-- La política de inserción de `authenticated` (20261117000000_bitacora_exportaciones.sql) enumera
-- las acciones que un usuario puede registrar por su cuenta y NO incluye estas: desde el navegador
-- nadie puede escribir una acción de usuarios.
--
-- Aplicar antes de desplegar la función.

alter table public.bitacora drop constraint if exists bitacora_accion_check;
alter table public.bitacora
  add constraint bitacora_accion_check
  check (accion in (
    'consulta_ficha', 'exporta_ficha_pdf', 'exporta_excel_completo', 'exporta_excel_cruce',
    'usuario_crea', 'usuario_cambia_rol', 'usuario_desactiva', 'usuario_reactiva',
    'usuario_restablece_clave', 'usuario_quita_2fa'
  ));
