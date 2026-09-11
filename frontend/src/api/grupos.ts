import { apiFetch } from './client'

export interface GrupoInvestigacionItem {
  id_grupo: number
  nombre: string
  lider_grupo: string | null
  tipoGrupo: { nombre: string }
  facultad: { nombre: string } | null
  programa: { nombre: string } | null
  // Se diligencian manualmente en el catálogo solo si la facultad/programa
  // no existe ahí (típico de grupos externos a la universidad).
  facultad_otra: string | null
  programa_otro: string | null
  cod_gruplac: string | null
  reconocido_minciencias: boolean
  categoria: string | null
  acuerdo_institucional: string | null
  /** Aplica principalmente a grupos externos. */
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

/** RQF23 - registra un grupo nuevo en el catálogo institucional. Solo Administrador. */
export function crearGrupo(datos: DatosGrupoInvestigacion): Promise<RespuestaGrupoCreado> {
  return apiFetch('/grupos-investigacion', { method: 'POST', body: JSON.stringify(datos) })
}
