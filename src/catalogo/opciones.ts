/**
 * Opciones válidas de las respuestas categóricas del formulario.
 *
 * PROVISIONAL: salen de ejemplos del README de arranque. Se confirman y completan con
 * el PDF del formulario (F2). Un valor que no esté aquí NO se descarta: se conserva tal
 * cual y se lista en el resumen de la carga como "fuera de catálogo".
 *
 * La clave es la columna del TSV.
 */
export const OPCIONES_PROVISIONALES: Readonly<Record<string, readonly string[]>> = {
  satisfaction: ['Muy satisfecho', 'Satisfecho', 'Poco satisfecho'],
  resultsasexpected: ['Sí', 'Parcialmente', 'No', 'Todavía no se ha evidenciado'],
  paymentsonschedule: ['Sí', 'No'],
  needanothercredit: ['Sí', 'No'],
  financialRecords: ['Sí', 'No'],
  creditusedasapproved: ['Sí', 'No'],
  currentemployees: ['De 1 a 5', 'De 5 a 10', 'De 10 a 15'],
}
