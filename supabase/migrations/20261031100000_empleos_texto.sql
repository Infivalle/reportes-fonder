-- F2 · empleos_generados y empleos_a_generar son rangos en texto, no números
--
-- La consulta v2 devuelve respuestas cerradas ("1 a 3", "No genera empleo", "Incrementará 1% a 10%").
-- Si 20261030000000_formato_v2.sql ya se aplicó con `integer`, esta migración convierte las columnas
-- a `text` (están vacías: aún no se ha cargado ningún archivo v2). Si ya son `text`, no hace nada.
-- Aplicar ANTES de cargar el archivo v2.

alter table public.beneficiarios
  alter column empleos_generados type text using empleos_generados::text,
  alter column empleos_a_generar type text using empleos_a_generar::text;
