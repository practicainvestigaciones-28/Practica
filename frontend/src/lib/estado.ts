export type Estado = 'Pendiente' | 'En revisión' | 'Aprobado' | 'Correcciones' | 'Rechazado'

export const estadoConfig: Record<Estado, { color: string }> = {
  'Pendiente': { color: '#c9c9c9' },
  'En revisión': { color: '#f2c94c' },
  'Aprobado': { color: '#27ae60' },
  'Correcciones': { color: '#2f5fa8' },
  'Rechazado': { color: '#c0392b' },
}

export const ordenEstados: Estado[] = ['Pendiente', 'En revisión', 'Aprobado', 'Correcciones', 'Rechazado']

/** Traduce el estado_actual real del backend al tipo Estado que usa la UI. */
export function mapearEstado(estadoBackend: string): Estado {
  switch (estadoBackend) {
    case 'revision':
      return 'En revisión'
    case 'aprobado':
    case 'finalizado':
      return 'Aprobado'
    case 'aprobado_con_correcciones':
      return 'Correcciones'
    case 'rechazado':
    case 'no_cumple':
      return 'Rechazado'
    default:
      return 'Pendiente'
  }
}