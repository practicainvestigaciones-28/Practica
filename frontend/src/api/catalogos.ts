import { apiFetch } from './client'

export interface CatalogoItem {
  id_modalidad?: number
  id_tipo_proyecto?: number
  id_area_conocimiento?: number
  id_linea?: number
  id_ods?: number
  id_periodo?: number
  id_dedicacion?: number
  id_rol_pro?: number
  id_rolestudiante?: number
  nombre: string
  descripcion?: string | null
}

export interface ProgramaItem {
  id_programa: number
  nombre: string
  facultad?: { nombre: string }
  tipoPrograma?: { nombre: string }
}

export function listarModalidadesProyecto(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/modalidades-proyecto')
}

interface RespuestaCatalogoCreado {
  mensaje: string
  registro: CatalogoItem
}

/** Solo Administrador. Queda disponible de inmediato para elegir al crear un proyecto. */
export function crearModalidadProyecto(nombre: string): Promise<RespuestaCatalogoCreado> {
  return apiFetch('/catalogos/modalidades-proyecto', { method: 'POST', body: JSON.stringify({ nombre }) })
}

export function listarTiposProyecto(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/tipos-proyecto')
}

/** Solo Administrador. Queda disponible de inmediato para elegir al crear un proyecto. */
export function crearTipoProyecto(nombre: string): Promise<RespuestaCatalogoCreado> {
  return apiFetch('/catalogos/tipos-proyecto', { method: 'POST', body: JSON.stringify({ nombre }) })
}

export function listarAreasConocimiento(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/areas-conocimiento')
}

/** Solo Administrador. Queda disponible de inmediato para elegir al crear un proyecto. */
export function crearAreaConocimiento(nombre: string, descripcion?: string): Promise<RespuestaCatalogoCreado> {
  return apiFetch('/catalogos/areas-conocimiento', { method: 'POST', body: JSON.stringify({ nombre, descripcion }) })
}

export function listarProgramas(): Promise<ProgramaItem[]> {
  return apiFetch('/catalogos/programas')
}

export interface FacultadItem {
  id_facultad: number
  nombre: string
}

export function listarFacultades(): Promise<FacultadItem[]> {
  return apiFetch('/catalogos/facultades')
}

export interface TipoProgramaItem {
  id_tipo_programa: number
  nombre: string
}

export function listarTiposPrograma(): Promise<TipoProgramaItem[]> {
  return apiFetch('/catalogos/tipos-programa')
}

interface RespuestaProgramaCreado {
  mensaje: string
  registro: { id_programa: number; nombre: string }
}

/** Solo Administrador. `id_facultad` y `id_tipo_programa` son obligatorios en el backend. */
export function crearPrograma(
  nombre: string,
  id_facultad: number,
  id_tipo_programa: number
): Promise<RespuestaProgramaCreado> {
  return apiFetch('/catalogos/programas', {
    method: 'POST',
    body: JSON.stringify({ nombre, id_facultad, id_tipo_programa }),
  })
}

export function listarLineasInvestigacion(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/lineas-investigacion')
}

export function listarOds(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/ods')
}

export function listarPeriodos(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/periodos')
}

/** Solo Administrador. Queda disponible de inmediato para elegir al crear un proyecto. */
export function crearPeriodo(nombre: string): Promise<RespuestaCatalogoCreado> {
  return apiFetch('/catalogos/periodos', { method: 'POST', body: JSON.stringify({ nombre }) })
}

export function listarDedicaciones(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/dedicaciones')
}

export function listarRolesProyecto(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/roles-proyecto')
}

export function listarRolesEstudiante(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/roles-estudiante')
}
