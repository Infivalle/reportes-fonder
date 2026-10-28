/** Se marca (no se corrige) cuando las ventas superan 100 veces el ingreso mensual. */
export const FACTOR_ATIPICO = 100

export function esMontoAtipico(
  monthlyIncome: number | null,
  totalSalesValue: number | null,
): boolean {
  if (monthlyIncome === null || totalSalesValue === null) return false
  if (monthlyIncome <= 0) return false
  return totalSalesValue > FACTOR_ATIPICO * monthlyIncome
}
