import { apiFetch } from './client'

export interface ConteoPorEstado {
  estado: string
  cantidad: number
}

export interface ProyectoReciente {
  id_proyecto: number
  titulo: string
  estado_actual: string
  fecha_registro: string
  convocatoria: string
  creador: string
}

export interface EstadisticasDashboard {
  totalProyectos: number
  proyectosPorEstado: ConteoPorEstado[]
  totalConvocatorias: number
  convocatoriasActivas: number
  totalUsuarios: number
  proyectosRecientes: ProyectoReciente[]
}

export function obtenerEstadisticas(): Promise<EstadisticasDashboard> {
  return apiFetch('/dashboard/estadisticas')
}
