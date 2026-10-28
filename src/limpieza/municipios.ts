import { normalizarTexto } from './texto.ts'

export interface Municipio {
  /** Código DIVIPOLA de 5 dígitos (DANE). */
  codigo: string
  nombre: string
}

/** Los 42 municipios del Valle del Cauca (departamento 76). Fuente: DIVIPOLA / DANE. */
export const MUNICIPIOS_VALLE: readonly Municipio[] = [
  { codigo: '76001', nombre: 'Cali' },
  { codigo: '76020', nombre: 'Alcalá' },
  { codigo: '76036', nombre: 'Andalucía' },
  { codigo: '76041', nombre: 'Ansermanuevo' },
  { codigo: '76054', nombre: 'Argelia' },
  { codigo: '76100', nombre: 'Bolívar' },
  { codigo: '76109', nombre: 'Buenaventura' },
  { codigo: '76111', nombre: 'Guadalajara de Buga' },
  { codigo: '76113', nombre: 'Bugalagrande' },
  { codigo: '76122', nombre: 'Caicedonia' },
  { codigo: '76126', nombre: 'Calima' },
  { codigo: '76130', nombre: 'Candelaria' },
  { codigo: '76147', nombre: 'Cartago' },
  { codigo: '76233', nombre: 'Dagua' },
  { codigo: '76243', nombre: 'El Águila' },
  { codigo: '76246', nombre: 'El Cairo' },
  { codigo: '76248', nombre: 'El Cerrito' },
  { codigo: '76250', nombre: 'El Dovio' },
  { codigo: '76275', nombre: 'Florida' },
  { codigo: '76306', nombre: 'Ginebra' },
  { codigo: '76318', nombre: 'Guacarí' },
  { codigo: '76364', nombre: 'Jamundí' },
  { codigo: '76377', nombre: 'La Cumbre' },
  { codigo: '76400', nombre: 'La Unión' },
  { codigo: '76403', nombre: 'La Victoria' },
  { codigo: '76497', nombre: 'Obando' },
  { codigo: '76520', nombre: 'Palmira' },
  { codigo: '76563', nombre: 'Pradera' },
  { codigo: '76606', nombre: 'Restrepo' },
  { codigo: '76616', nombre: 'Riofrío' },
  { codigo: '76622', nombre: 'Roldanillo' },
  { codigo: '76670', nombre: 'San Pedro' },
  { codigo: '76736', nombre: 'Sevilla' },
  { codigo: '76823', nombre: 'Toro' },
  { codigo: '76828', nombre: 'Trujillo' },
  { codigo: '76834', nombre: 'Tuluá' },
  { codigo: '76845', nombre: 'Ulloa' },
  { codigo: '76863', nombre: 'Versalles' },
  { codigo: '76869', nombre: 'Vijes' },
  { codigo: '76890', nombre: 'Yotoco' },
  { codigo: '76892', nombre: 'Yumbo' },
  { codigo: '76895', nombre: 'Zarzal' },
]

/**
 * Alias conocidos (texto ya normalizado -> código). Cuando el resumen de carga
 * liste un texto sin reconocer que sí es un municipio del Valle, se agrega aquí.
 */
const ALIAS: Record<string, string> = {
  'SANTIAGO DE CALI': '76001',
  BUGA: '76111',
  'GUADALAJARA DE BUGA': '76111',
  'CALIMA EL DARIEN': '76126',
  'EL DARIEN': '76126',
  'ANSERMA NUEVO': '76041',
  AGUILA: '76243',
  'SAN PEDRO VALLE': '76670',
  // Registros de origen con la letra acentuada dañada ("�"): al normalizar, el "�" queda como espacio.
  'LA UNI N': '76400',
  'BOL VAR': '76100',
  'EL GUILA': '76243',
  // Mismo daño en el resto de municipios con tilde. Tuluá apareció en la consulta v2; los otros
  // cinco se agregan de una vez para no esperar a que aparezcan en una carga.
  TULU: '76834',
  ALCAL: '76020',
  'ANDALUC A': '76036',
  GUACAR: '76318',
  JAMUND: '76364',
  'RIOFR O': '76616',
}

const POR_NOMBRE = new Map<string, string>([
  ...MUNICIPIOS_VALLE.map((m): [string, string] => [normalizarTexto(m.nombre), m.codigo]),
  ...Object.entries(ALIAS),
])

const POR_CODIGO = new Map(MUNICIPIOS_VALLE.map((m) => [m.codigo, m]))

export function nombreMunicipio(codigo: string): string | undefined {
  return POR_CODIGO.get(codigo)?.nombre
}

export type MotivoMunicipio = 'ok' | 'vacio' | 'otro_departamento' | 'no_reconocido'

export interface ResultadoMunicipio {
  codigo: string | null
  motivo: MotivoMunicipio
}

/** Quita el sufijo "Valle" / "Valle del Cauca" ("Cali, Valle del Cauca" -> "CALI"). */
function sinSufijoValle(normalizado: string): string {
  return normalizado.replace(/ VALLE DEL CAUCA$| VALLE$/, '')
}

function esDepartamentoValle(departamento: string | null): boolean {
  if (departamento === null) return true // sin dato: no se descarta por departamento
  const d = normalizarTexto(departamento)
  return d === '' || d === 'VALLE' || d === 'VALLE DEL CAUCA'
}

/**
 * Resuelve el municipio del Valle a partir del texto de la ciudad.
 * El departamento evita confundir homónimos (La Unión, Florida, Bolívar, Argelia existen
 * en otros departamentos).
 */
export function resolverMunicipio(
  ciudad: string | null,
  departamento: string | null,
): ResultadoMunicipio {
  if (ciudad === null || normalizarTexto(ciudad) === '') return { codigo: null, motivo: 'vacio' }
  if (!esDepartamentoValle(departamento)) return { codigo: null, motivo: 'otro_departamento' }

  const normalizado = normalizarTexto(ciudad)
  const codigo = POR_NOMBRE.get(normalizado) ?? POR_NOMBRE.get(sinSufijoValle(normalizado))
  if (codigo === undefined) return { codigo: null, motivo: 'no_reconocido' }
  return { codigo, motivo: 'ok' }
}

export type OrigenMunicipio = 'empresa' | 'residencia' | 'sin_ubicar'

export interface UbicacionBeneficiario {
  codigo: string | null
  origen: OrigenMunicipio
  /** Resultado de buscar el municipio de la empresa. */
  empresa: ResultadoMunicipio
  /** Resultado de buscar la ciudad de residencia. */
  residencia: ResultadoMunicipio
}

/**
 * Formato v2: el municipio es el de la empresa; si está vacío o no es del Valle se usa la ciudad
 * de residencia; si tampoco, queda sin ubicar.
 *
 * El municipio de la empresa no trae departamento, así que no se puede descartar por ese criterio:
 * un texto como "Bolívar" se toma como el del Valle. Es razonable porque el programa es del
 * Valle, pero es la razón por la que la residencia solo entra como respaldo.
 */
export function resolverUbicacion(
  municipioEmpresa: string | null,
  ciudad: string | null,
  departamento: string | null,
): UbicacionBeneficiario {
  const empresa = resolverMunicipio(municipioEmpresa, null)
  const residencia = resolverMunicipio(ciudad, departamento)
  if (empresa.codigo !== null) return { codigo: empresa.codigo, origen: 'empresa', empresa, residencia }
  if (residencia.codigo !== null) return { codigo: residencia.codigo, origen: 'residencia', empresa, residencia }
  return { codigo: null, origen: 'sin_ubicar', empresa, residencia }
}
