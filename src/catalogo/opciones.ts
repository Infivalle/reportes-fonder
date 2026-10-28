/**
 * Opciones válidas de las respuestas categóricas del formulario "Información de la Asesoría".
 *
 * Salen del PDF del formulario (© 2025 InfiValle). Un valor que no esté aquí NO se descarta:
 * se conserva tal cual y se lista en el resumen de la carga como "fuera de catálogo".
 *
 * La clave es la columna del TSV. Las opciones van en el orden del formulario.
 */
export const OPCIONES_FORMULARIO: Readonly<Record<string, readonly string[]>> = {
  creditusedasapproved: ['Sí', 'No', 'Parcialmente'],
  timetoresults: ['1 mes', 'Entre 1 y 6 meses', 'Más de 6 meses', 'Todavía no se ha evidenciado'],
  resultsasexpected: ['Sí', 'No', 'Parcialmente', 'Todavía no se ha evidenciado'],
  financialRecords: ['Sí', 'No'],
  resourcemanager: ['El beneficiario', 'Otro'],
  paymentsonschedule: ['Sí', 'No', 'Parcialmente'],
  satisfaction: ['Muy satisfecho', 'Satisfecho', 'Poco satisfecho', 'Insatisfecho'],
  needanothercredit: ['Sí', 'No', 'Tal vez'],
  currentemployees: ['De 1 a 5', 'De 5 a 10', 'De 10 a 15'],
}
