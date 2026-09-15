import { apiFetch } from '../../../shared/api/client'

export interface GrupoInvestigacionItem {
  id_grupo: number
  nombre: string
  lider_grupo: string | null
  tipoGrupo: { nombre: string }
  facultad: { nombre: string } | null
  programa: { nombre: string } | null

  facultad_otra: string | null
  programa_otro: string | null
  cod_gruplac: string | null
  reconocido_minciencias: boolean
  categoria: string | null
  acuerdo_institucional: string | null

  linea_medular: string | null
}

export function listarGrupos(): Promise<GrupoInvestigacionItem[]> {
  return apiFetch('/grupos-investigacion')
}

export interface DatosGrupoInvestigacion {
  nombre: string
  id_tipo_grupo: number
  facultad_otra?: string
  programa_otro?: string
  lider_grupo?: string
  cod_gruplac?: string
  reconocido_minciencias?: boolean
  categoria?: string
  acuerdo_institucional?: string
  linea_medular?: string
}

interface RespuestaGrupoCreado {
  mensaje: string
  grupo: { id_grupo: number; nombre: string }
}

export function crearGrupo(datos: DatosGrupoInvestigacion): Promise<RespuestaGrupoCreado> {
  return apiFetch('/grupos-investigacion', { method: 'POST', body: JSON.stringify(datos) })
}
