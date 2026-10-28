import type { BuildOptions } from 'esbuild'

export interface FuncionEmpaquetada {
  entrada: string
  salida: string
}

export const FUNCIONES: FuncionEmpaquetada[]
export const BANNER: string
export function opciones(funcion: FuncionEmpaquetada, escribir: boolean): BuildOptions
