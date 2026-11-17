-- F4 · Los asesores también pueden descargar los Excel
--
-- Reemplaza la política de inserción de la bitácora: ahora admin y asesor pueden registrar
-- cualquiera de las acciones de consulta y exportación. Cada descarga queda registrada con el
-- usuario, antes de entregar el archivo (la interfaz no entrega el Excel si el registro falla).
--
-- Las acciones de gestión de usuarios (usuario_*) siguen sin poder insertarse desde el cliente:
-- solo las escribe la Edge Function con service_role.

drop policy if exists "staff registra bitacora" on public.bitacora;

create policy "staff registra bitacora" on public.bitacora
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and accion in ('consulta_ficha', 'exporta_ficha_pdf', 'exporta_excel_completo', 'exporta_excel_cruce')
    and public.rol_actual() in ('admin', 'asesor')
  );
