# Formato v1 del TSV

Archivo tabulado generado con `mysql --batch` por el administrador. **52 columnas**,
una fila por registro de asesoría, más una fila de encabezado.

## Reglas de lectura

- Separar por salto de línea (`\n`) y tabulador (`\t`). **No** usar un parser de CSV con comillas:
  hay un registro con un salto de línea suelto dentro de un campo.
- El texto `NULL` es nulo.
- El encabezado debe coincidir **exactamente** (nombres y orden) con la tabla siguiente.
  Si no coincide, o si alguna fila no tiene 52 columnas, se rechaza el archivo completo.

## Columnas

| # | Columna | Grupo |
|---|---|---|
| 1–37 | `id`, `idbeneficiario`, `idasesor`, `creditusedasapproved`, `creditUsageDescription`, `idimprovements`, `otherimprovement`, `timetoresults`, `resultsasexpected`, `resultsExplanation`, `evidenceFile`, `financialRecords`, `resourcemanager`, `otherResourceManager`, `paymentsonschedule`, `paymentExplanation`, `satisfaction`, `needanothercredit`, `creditINTendedUse`, `monthlyIncome`, `fixedCosts`, `variableCosts`, `debtLevel`, `creditUsedPercentage`, `monthlyPayment`, `emergencyReserve`, `monthlyClients`, `monthlySales`, `totalSalesValue`, `currentemployees`, `idsaleschannels`, `othersaleschannel`, `evidenceVisitFile`, `estado`, `observaciones`, `created_at`, `updated_at` | Asesoría |
| 38–39 | `es_duplicado`, `asesor` | Calculadas por la consulta |
| 40–49 | `documento`, `benef_nombres`, `benef_apellidos`, `email`, `celular`, `departamento`, `ciudad`, `nombreempresa`, `nit`, `actividadeconomica` | Beneficiario |
| 50–52 | `proyectos`, `mejoras_codigos`, `canales_venta_codigos` | Agregadas |

La fuente de verdad del orden es [`src/formato/v1.ts`](../src/formato/v1.ts); una prueba
automática verifica que el fixture sintético la cumple.

## Notas

- `idasesor` vale 0 en todas las filas y `asesor` queda como "NO REGISTRADO": el asesor
  está fuera del modelo en la v1.
- `es_duplicado` viene de la consulta, pero la app **no** se apoya en ella: aplica su propia
  regla (mismo beneficiario a menos de 30 días del último registro conservado).
- `created_at` se asume en UTC y se convierte a hora de Colombia (UTC−5). Pendiente de
  confirmar con una asesoría de hora conocida.
- En v1 el municipio sale de `ciudad` (residencia). El formato v2 agregará `municipioempresa`.
