import { apiFetch } from '../../../shared/api/client'

export interface ProductoSeguimiento {
  id_tipo_producto: number
  nombre: string
  subcategoria: string
  categoria: string
  proyectado: number
  obtenido: number | null
}

export interface EstudianteSeguimiento {
  id_usuarioproyecto: number
  nombre: string
  rol: string | null
  id_programa: number | null
  programa: string | null
}

export interface EgresadoSeguimiento {
  nombre: string
  programa: string | null
}

/** Pendiente / en ejecución (acta de inicio legalizada) / finalizado (acta de cierre cerrada) — para el semáforo. */
export type EstadoEjecucion = 'pendiente' | 'en_ejecucion' | 'finalizado'

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
  estudiantes: EstudianteSeguimiento[]
  egresados: EgresadoSeguimiento[]
  centro_costos: string | null
  estado_actual: string
  estado_ejecucion: EstadoEjecucion
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

export interface ProyectoAprobadoLider {
  id_proyecto: number
  titulo: string
  fecha_registro: string
  estado_actual: string
  convocatoria: string | null
  creador: { id_usuario: number; nombre: string; apellido: string; correo: string }
  grupos: { grupo: { nombre: string } }[]
  /** Cuándo este líder le dio el visto bueno (el más reciente, si fueron varios). */
  fecha_visto_bueno: string
}

/** Proyectos a los que este líder ya les dio el visto bueno, con el estado en que van ahora. */
export function listarAprobadosPorLider(): Promise<ProyectoAprobadoLider[]> {
  return apiFetch('/lider/proyectos/aprobados')
}
