import { apiFetch } from '../../../shared/api/client'

export interface ProductoSeguimiento {
  id_tipo_producto: number
  nombre: string
  subcategoria: string
  categoria: string
  proyectado: number
  obtenido: number | null
}

export interface ProyectoSeguimiento {
  id_proyecto: number
  titulo: string
  objetivo_general: string | null
  convocatoria: string
  modalidad: string
  id_tipo_articulacion: number | null
  tipo_articulacion: string | null
  investigador_principal: string | null
  co_investigadores: string[]
  grupos: string[]
  lineas_investigacion: string[]
  programas_academicos: string[]
  duracion_periodos: number | null
  duracion_meses: number | null
  fecha_inicio_real: string | null
  fecha_fin_real: string | null
  valor_total: string | null
  num_estudiantes: number
  num_egresados: number
  centro_costos: string | null
  estado_actual: string
  evidencias_resultados: string | null
  observaciones_resultados: string | null
  productos: ProductoSeguimiento[]
}

export function listarProyectosSeguimiento(): Promise<ProyectoSeguimiento[]> {
  return apiFetch('/lider/proyectos')
}

export interface DatosSeguimientoProyecto {
  id_tipo_articulacion?: number | null
  centro_costos?: string | null
  fecha_inicio_real?: string | null
  fecha_fin_real?: string | null
  duracion_meses?: number | null
  evidencias_resultados?: string | null
  observaciones_resultados?: string | null
}

export function actualizarSeguimientoProyecto(id_proyecto: number, datos: DatosSeguimientoProyecto): Promise<unknown> {
  return apiFetch(`/lider/proyectos/${id_proyecto}`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  })
}

export function registrarProductoObtenido(
  id_proyecto: number,
  id_tipo_producto: number,
  cantidad_obtenida: number
): Promise<unknown> {
  return apiFetch(`/lider/proyectos/${id_proyecto}/productos/${id_tipo_producto}`, {
    method: 'PATCH',
    body: JSON.stringify({ cantidad_obtenida }),
  })
}

export interface ProyectoPendienteVistoBueno {
  id_proyecto: number
  titulo: string
  fecha_registro: string
  creador: { id_usuario: number; nombre: string; apellido: string; correo: string }
  grupos: { grupo: { nombre: string } }[]
}

/** Proyectos recién creados que esperan el visto bueno de este líder (reemplaza la antigua "carta aval"). */
export function listarPendientesVistoBueno(): Promise<ProyectoPendienteVistoBueno[]> {
  return apiFetch('/lider/proyectos/pendientes-visto-bueno')
}

export function darVistoBueno(id_proyecto: number): Promise<unknown> {
  return apiFetch(`/lider/proyectos/${id_proyecto}/visto-bueno`, { method: 'PATCH' })
}

export function rechazarProyectoPendiente(id_proyecto: number, motivo: string): Promise<unknown> {
  return apiFetch(`/lider/proyectos/${id_proyecto}/rechazar`, {
    method: 'PATCH',
    body: JSON.stringify({ motivo }),
  })
}

export interface TipoArticulacionItem {
  id_tipo_articulacion: number
  nombre: string
  activo: boolean
}

export function listarTiposArticulacion(): Promise<TipoArticulacionItem[]> {
  return apiFetch('/catalogos/tipos-articulacion')
}
