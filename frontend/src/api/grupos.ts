import { apiFetch } from './client'

export interface GrupoInvestigacionItem {
  id_grupo: number
  nombre: string
  lider_grupo: string | null
  tipoGrupo: { nombre: string }
  facultad: { nombre: string } | null
  programa: { nombre: string } | null
}

export function listarGrupos(): Promise<GrupoInvestigacionItem[]> {
  return apiFetch('/grupos-investigacion')
}
