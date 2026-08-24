export type Estado = 'Pendiente' | 'En revisión' | 'Aprobado' | 'Correcciones' | 'Rechazado'

export const estadoConfig: Record<Estado, { color: string }> = {
  'Pendiente': { color: '#c9c9c9' },
  'En revisión': { color: '#f2c94c' },
  'Aprobado': { color: '#27ae60' },
  'Correcciones': { color: '#2f5fa8' },
  'Rechazado': { color: '#c0392b' },
}

export const ordenEstados: Estado[] = ['Pendiente', 'En revisión', 'Aprobado', 'Correcciones', 'Rechazado']