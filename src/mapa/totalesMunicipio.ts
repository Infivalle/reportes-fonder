/**
 * GENERADO por scripts/generar-totales-municipio.ts — no editar a mano.
 * Fuente: fondercompleto.xlsx (1743 filas con cédula; años 2024 y 2026).
 * Total de beneficiarios por municipio (código DIVIPOLA), para la cobertura del panel del mapa.
 * - Personas distintas por cédula. `total` cuenta una vez a quien está en las dos convocatorias,
 *   por eso puede ser menor que primera + segunda.
 * - Municipio: el de la empresa; si falta, el de residencia (0 filas usaron la residencia, 0 sin ubicar).
 * - Sin beneficiarios en el listado (aparecen en 0): Alcalá (76020).
 */
export interface TotalesDelMunicipio {
  primera: number
  segunda: number
  /** Personas distintas en las dos convocatorias. */
  total: number
}

export type TotalesMunicipio = Readonly<Record<string, TotalesDelMunicipio>>

export const BENEFICIARIOS_POR_MUNICIPIO: TotalesMunicipio = {
  '76001': { primera: 430, segunda: 264, total: 694 }, // Cali
  '76020': { primera: 0, segunda: 0, total: 0 }, // Alcalá
  '76036': { primera: 2, segunda: 2, total: 4 }, // Andalucía
  '76041': { primera: 2, segunda: 4, total: 6 }, // Ansermanuevo
  '76054': { primera: 0, segunda: 1, total: 1 }, // Argelia
  '76100': { primera: 1, segunda: 3, total: 4 }, // Bolívar
  '76109': { primera: 226, segunda: 26, total: 252 }, // Buenaventura
  '76111': { primera: 10, segunda: 10, total: 20 }, // Guadalajara de Buga
  '76113': { primera: 14, segunda: 5, total: 19 }, // Bugalagrande
  '76122': { primera: 0, segunda: 1, total: 1 }, // Caicedonia
  '76126': { primera: 2, segunda: 2, total: 4 }, // Calima
  '76130': { primera: 11, segunda: 27, total: 38 }, // Candelaria
  '76147': { primera: 7, segunda: 18, total: 24 }, // Cartago
  '76233': { primera: 5, segunda: 4, total: 9 }, // Dagua
  '76243': { primera: 1, segunda: 0, total: 1 }, // El Águila
  '76246': { primera: 0, segunda: 5, total: 5 }, // El Cairo
  '76248': { primera: 16, segunda: 7, total: 23 }, // El Cerrito
  '76250': { primera: 3, segunda: 3, total: 6 }, // El Dovio
  '76275': { primera: 24, segunda: 16, total: 40 }, // Florida
  '76306': { primera: 5, segunda: 3, total: 8 }, // Ginebra
  '76318': { primera: 1, segunda: 4, total: 5 }, // Guacarí
  '76364': { primera: 19, segunda: 58, total: 77 }, // Jamundí
  '76377': { primera: 7, segunda: 0, total: 7 }, // La Cumbre
  '76400': { primera: 7, segunda: 8, total: 15 }, // La Unión
  '76403': { primera: 2, segunda: 13, total: 15 }, // La Victoria
  '76497': { primera: 5, segunda: 3, total: 8 }, // Obando
  '76520': { primera: 124, segunda: 57, total: 181 }, // Palmira
  '76563': { primera: 23, segunda: 10, total: 33 }, // Pradera
  '76606': { primera: 1, segunda: 2, total: 3 }, // Restrepo
  '76616': { primera: 1, segunda: 5, total: 6 }, // Riofrío
  '76622': { primera: 13, segunda: 11, total: 24 }, // Roldanillo
  '76670': { primera: 2, segunda: 2, total: 4 }, // San Pedro
  '76736': { primera: 2, segunda: 2, total: 4 }, // Sevilla
  '76823': { primera: 7, segunda: 47, total: 54 }, // Toro
  '76828': { primera: 2, segunda: 4, total: 6 }, // Trujillo
  '76834': { primera: 27, segunda: 43, total: 70 }, // Tuluá
  '76845': { primera: 0, segunda: 5, total: 5 }, // Ulloa
  '76863': { primera: 1, segunda: 15, total: 16 }, // Versalles
  '76869': { primera: 12, segunda: 5, total: 17 }, // Vijes
  '76890': { primera: 1, segunda: 0, total: 1 }, // Yotoco
  '76892': { primera: 4, segunda: 14, total: 17 }, // Yumbo
  '76895': { primera: 5, segunda: 9, total: 14 }, // Zarzal
}
