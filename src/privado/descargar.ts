const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Entrega un archivo al navegador como descarga. */
export function descargarXlsx(contenido: ArrayBuffer, nombre: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: TIPO_XLSX }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
  // Se libera más tarde: algunos navegadores aún están leyendo el objeto al terminar el clic.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
