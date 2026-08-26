import { apiFetch } from './client'

export interface CatalogoItem {
  id_modalidad?: number
  id_tipo_proyecto?: number
  id_area_conocimiento?: number
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
