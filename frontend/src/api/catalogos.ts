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

export function listarTiposProyecto(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/tipos-proyecto')
}

export function listarAreasConocimiento(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/areas-conocimiento')
}

export function listarProgramas(): Promise<ProgramaItem[]> {
  return apiFetch('/catalogos/programas')
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

export function listarDedicaciones(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/dedicaciones')
}

export function listarRolesProyecto(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/roles-proyecto')
}

export function listarRolesEstudiante(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/roles-estudiante')
}
