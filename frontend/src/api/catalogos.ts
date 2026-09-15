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
  id_facultad: number
  id_tipo_programa: number
  activo: boolean
  facultad?: { nombre: string }
  tipoPrograma?: { nombre: string }
}

export interface ModalidadProyectoItem {
  id_modalidad: number
  nombre: string
  descripcion?: string | null
  activo: boolean
}

export function listarModalidadesProyecto(soloActivos?: boolean): Promise<ModalidadProyectoItem[]> {
  return apiFetch(`/catalogos/modalidades-proyecto${soloActivos ? '?activo=true' : ''}`)
}

interface RespuestaCatalogoCreado {
  mensaje: string
  registro: CatalogoItem
}

interface RespuestaModalidadProyecto {
  mensaje: string
  registro: ModalidadProyectoItem
}

export function crearModalidadProyecto(nombre: string): Promise<RespuestaCatalogoCreado> {
  return apiFetch('/catalogos/modalidades-proyecto', { method: 'POST', body: JSON.stringify({ nombre }) })
}

export function actualizarModalidadProyecto(id_modalidad: number, nombre: string): Promise<RespuestaModalidadProyecto> {
  return apiFetch(`/catalogos/modalidades-proyecto/${id_modalidad}`, {
    method: 'PUT',
    body: JSON.stringify({ nombre }),
  })
}

export function cambiarEstadoModalidadProyecto(id_modalidad: number, activo: boolean): Promise<RespuestaModalidadProyecto> {
  return apiFetch(`/catalogos/modalidades-proyecto/${id_modalidad}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  })
}

export interface TipoProyectoItem {
  id_tipo_proyecto: number
  nombre: string
  activo: boolean
}

export function listarTiposProyecto(soloActivos?: boolean): Promise<TipoProyectoItem[]> {
  return apiFetch(`/catalogos/tipos-proyecto${soloActivos ? '?activo=true' : ''}`)
}

interface RespuestaTipoProyecto {
  mensaje: string
  registro: TipoProyectoItem
}

export function crearTipoProyecto(nombre: string): Promise<RespuestaCatalogoCreado> {
  return apiFetch('/catalogos/tipos-proyecto', { method: 'POST', body: JSON.stringify({ nombre }) })
}

export function actualizarTipoProyecto(id_tipo_proyecto: number, nombre: string): Promise<RespuestaTipoProyecto> {
  return apiFetch(`/catalogos/tipos-proyecto/${id_tipo_proyecto}`, {
    method: 'PUT',
    body: JSON.stringify({ nombre }),
  })
}

export function cambiarEstadoTipoProyecto(id_tipo_proyecto: number, activo: boolean): Promise<RespuestaTipoProyecto> {
  return apiFetch(`/catalogos/tipos-proyecto/${id_tipo_proyecto}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  })
}

export function listarAreasConocimiento(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/areas-conocimiento')
}

export function crearAreaConocimiento(nombre: string, descripcion?: string): Promise<RespuestaCatalogoCreado> {
  return apiFetch('/catalogos/areas-conocimiento', { method: 'POST', body: JSON.stringify({ nombre, descripcion }) })
}

export function listarProgramas(soloActivos?: boolean): Promise<ProgramaItem[]> {
  return apiFetch(`/catalogos/programas${soloActivos ? '?activo=true' : ''}`)
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

export interface TipoGrupoItem {
  id_tipo_grupo: number
  nombre: string
}

export function listarTiposGrupo(): Promise<TipoGrupoItem[]> {
  return apiFetch('/catalogos/tipos-grupo')
}

interface RespuestaProgramaCreado {
  mensaje: string
  registro: ProgramaItem
}

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

export function actualizarPrograma(id_programa: number, nombre: string): Promise<RespuestaProgramaCreado> {
  return apiFetch(`/catalogos/programas/${id_programa}`, {
    method: 'PUT',
    body: JSON.stringify({ nombre }),
  })
}

export function cambiarEstadoPrograma(id_programa: number, activo: boolean): Promise<RespuestaProgramaCreado> {
  return apiFetch(`/catalogos/programas/${id_programa}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  })
}

export interface LineaInvestigacionItem {
  id_linea: number
  nombre: string
  descripcion?: string | null
  activa: boolean
}

export function listarLineasInvestigacion(soloActivos?: boolean): Promise<LineaInvestigacionItem[]> {
  return apiFetch(`/catalogos/lineas-investigacion${soloActivos ? '?activo=true' : ''}`)
}

interface RespuestaLineaInvestigacion {
  mensaje: string
  registro: LineaInvestigacionItem
}

export function crearLineaInvestigacion(nombre: string): Promise<RespuestaLineaInvestigacion> {
  return apiFetch('/catalogos/lineas-investigacion', { method: 'POST', body: JSON.stringify({ nombre }) })
}

export function actualizarLineaInvestigacion(id_linea: number, nombre: string): Promise<RespuestaLineaInvestigacion> {
  return apiFetch(`/catalogos/lineas-investigacion/${id_linea}`, {
    method: 'PUT',
    body: JSON.stringify({ nombre }),
  })
}

export function cambiarEstadoLineaInvestigacion(id_linea: number, activa: boolean): Promise<RespuestaLineaInvestigacion> {
  return apiFetch(`/catalogos/lineas-investigacion/${id_linea}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activa }),
  })
}

export function listarOds(): Promise<CatalogoItem[]> {
  return apiFetch('/catalogos/ods')
}

export function crearOds(nombre: string): Promise<RespuestaCatalogoCreado> {
  return apiFetch('/catalogos/ods', { method: 'POST', body: JSON.stringify({ nombre }) })
}

export interface PeriodoItem {
  id_periodo: number
  nombre: string
  activo: boolean
}

export function listarPeriodos(soloActivos?: boolean): Promise<PeriodoItem[]> {
  return apiFetch(`/catalogos/periodos${soloActivos ? '?activo=true' : ''}`)
}

interface RespuestaPeriodo {
  mensaje: string
  registro: PeriodoItem
}

export function crearPeriodo(nombre: string): Promise<RespuestaPeriodo> {
  return apiFetch('/catalogos/periodos', { method: 'POST', body: JSON.stringify({ nombre }) })
}

export function actualizarPeriodo(id_periodo: number, nombre: string): Promise<RespuestaPeriodo> {
  return apiFetch(`/catalogos/periodos/${id_periodo}`, { method: 'PUT', body: JSON.stringify({ nombre }) })
}

export function cambiarEstadoPeriodo(id_periodo: number, activo: boolean): Promise<RespuestaPeriodo> {
  return apiFetch(`/catalogos/periodos/${id_periodo}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  })
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
