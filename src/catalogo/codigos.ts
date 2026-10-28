/**
 * Significado de los códigos de las preguntas de selección múltiple del formulario.
 *
 * Los códigos salen de las tablas `advices_improvements` y `advices_saleschannels` (sus catálogos
 * en la base de origen están vacíos). El significado se deduce de las iniciales de cada opción del
 * PDF del formulario. AM es el único por eliminación: las otras cinco mejoras ya tienen código.
 * Pendiente de confirmar con InfiValle (ver CODIGOS_POR_CONFIRMAR).
 */

/** "¿Qué mejoras se lograron con el crédito?" */
export const MEJORAS: Readonly<Record<string, string>> = {
  AI: 'Aumento de ingresos',
  AA: 'Adquisición de activos',
  AM: 'Mejora en infraestructura',
  CT: 'Capital de trabajo',
  GE: 'Generación de empleo',
  O: 'Otras',
}

/** "Canales de venta" */
export const CANALES: Readonly<Record<string, string>> = {
  TF: 'Tienda física',
  RS: 'Redes sociales',
  VC: 'Venta por catálogo',
  TE: 'Tienda en línea / e-commerce',
  PT: 'Plataformas de terceros',
  O: 'Otros',
}

/** Códigos cuyo significado es una deducción y no un dato confirmado. */
export const CODIGOS_POR_CONFIRMAR = ['AM', 'TE', 'VC', 'PT'] as const
