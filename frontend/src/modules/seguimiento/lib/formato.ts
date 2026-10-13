// Fechas en formato yyyy-mm-dd, calculadas en UTC para que la zona horaria
// del navegador no corra el día (mismo criterio que acta-inicio).

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function sumarMeses(fechaISO: string, meses: number): string {
  if (!fechaISO) return ''
  const [a, m, d] = fechaISO.split('-').map(Number)
  const fecha = new Date(Date.UTC(a, m - 1 + meses, d))
  // 31 de enero + 1 mes no debe saltar a marzo: se queda en el último día del mes.
  if (fecha.getUTCDate() < d) fecha.setUTCDate(0)
  return fecha.toISOString().slice(0, 10)
}

export function sumarDias(fechaISO: string, dias: number): string {
  if (!fechaISO) return ''
  const [a, m, d] = fechaISO.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

export function diasEntre(desdeISO: string, hastaISO: string): number {
  const [a1, m1, d1] = desdeISO.split('-').map(Number)
  const [a2, m2, d2] = hastaISO.split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000)
}

export function formatoFecha(fechaISO: string | null | undefined): string {
  if (!fechaISO) return '—'
  const [a, m, d] = fechaISO.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export const formatoPesos = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)
