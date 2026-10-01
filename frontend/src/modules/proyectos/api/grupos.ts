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
  activo: boolean
}

export function listarGrupos(soloActivos?: boolean): Promise<GrupoInvestigacionItem[]> {
  return apiFetch(`/grupos-investigacion${soloActivos ? '?activo=true' : ''}`)
}

export interface DatosGrupoInvestigacion {
  nombre: string
  id_tipo_grupo: number
  id_facultad?: number
  id_programa?: number
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

interface RespuestaGrupoActualizado {
  mensaje: string
  registro: GrupoInvestigacionItem
}

export function actualizarGrupo(id_grupo: number, nombre: string): Promise<RespuestaGrupoActualizado> {
  return apiFetch(`/grupos-investigacion/${id_grupo}`, {
    method: 'PUT',
    body: JSON.stringify({ nombre }),
  })
}

export function cambiarEstadoGrupo(id_grupo: number, activo: boolean): Promise<RespuestaGrupoActualizado> {
  return apiFetch(`/grupos-investigacion/${id_grupo}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  })
}

/** Borrado real: el backend rechaza con 409 si algún proyecto ya usa este grupo. */
export function eliminarGrupo(id_grupo: number): Promise<{ mensaje: string }> {
  return apiFetch(`/grupos-investigacion/${id_grupo}`, { method: 'DELETE' })
}

/** Reordena los grupos de investigación según el arreglo de ids recibido (arrastrar y soltar). */
export function reordenarGrupos(ids: number[]): Promise<{ mensaje: string }> {
  return apiFetch('/grupos-investigacion/reordenar', { method: 'PATCH', body: JSON.stringify({ ids }) })
}
