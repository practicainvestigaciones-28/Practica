export type Estado = 'Pendiente' | 'En revisión' | 'Aprobado' | 'Correcciones' | 'Rechazado'

export const estadoConfig: Record<Estado, { color: string; colorTexto: string }> = {
  'Pendiente': { color: '#c9c9c9', colorTexto: '#222222' },
  'En revisión': { color: '#f2c94c', colorTexto: '#222222' },
  'Aprobado': { color: '#27ae60', colorTexto: '#ffffff' },
  'Correcciones': { color: '#2f5fa8', colorTexto: '#ffffff' },
  'Rechazado': { color: '#c0392b', colorTexto: '#ffffff' },
}

export const ordenEstados: Estado[] = ['Pendiente', 'En revisión', 'Aprobado', 'Correcciones', 'Rechazado']

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