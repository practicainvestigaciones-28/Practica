import { apiFetch, type RespuestaPaginada } from './client'

export interface DatosCrearProyecto {
  id_convocatoria: number
  id_modalidad_proyecto: number
  id_tipo_proyecto: number
  titulo: string
  ciudad?: string
  departamento?: string
  resumen?: string
  planteamiento_problema?: string
  pregunta_investigacion?: string
  justificacion?: string
  marco_teorico?: string
  metodologia_preliminar?: string
  funciones_estudiante_auxiliar?: string
  duracion_periodos?: number
}

export interface ProyectoCreado {
  id_proyecto: number
  titulo: string
}

export interface ProyectoListado {
  id_proyecto: number
  titulo: string
  estado_actual: string
  convocatoria: { nombre: string } | null
  modalidad: { nombre: string } | null
  tipoProyecto: { nombre: string } | null
  creador: { id_usuario: number; nombre: string; apellido: string }
}

export interface FiltrosListarProyectos {
  page?: number
  limit?: number
  estado?: string
  id_convocatoria?: number
  q?: string
}

export function listarProyectos(
  filtros: FiltrosListarProyectos = {}
): Promise<RespuestaPaginada<ProyectoListado>> {
  const params = new URLSearchParams()
  if (filtros.page) params.set('page', String(filtros.page))
  if (filtros.limit) params.set('limit', String(filtros.limit))
  if (filtros.estado) params.set('estado', filtros.estado)
  if (filtros.id_convocatoria) params.set('id_convocatoria', String(filtros.id_convocatoria))
  if (filtros.q) params.set('q', filtros.q)

  const qs = params.toString()
  return apiFetch(`/proyectos${qs ? `?${qs}` : ''}`)
}

interface RespuestaProyecto {
  mensaje: string
  proyecto: ProyectoCreado
}

export async function crearProyecto(datos: DatosCrearProyecto): Promise<ProyectoCreado> {
  const respuesta = await apiFetch<RespuestaProyecto>('/proyectos', {
    method: 'POST',
    body: JSON.stringify(datos),
  })
  return respuesta.proyecto
}

export interface CamposEditablesProyecto {
  titulo?: string
  ciudad?: string
  departamento?: string
  resumen?: string
  planteamiento_problema?: string
  pregunta_investigacion?: string
  justificacion?: string
  marco_teorico?: string
  metodologia_preliminar?: string
  componente_etico?: string
  funciones_estudiante_auxiliar?: string
}

export function actualizarProyecto(id_proyecto: number, cambios: CamposEditablesProyecto): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}`, {
    method: 'PUT',
    body: JSON.stringify(cambios),
  })
}

export function agregarAreaProyecto(id_proyecto: number, id_area_conocimiento: number): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}/areas`, {
    method: 'POST',
    body: JSON.stringify({ id_area_conocimiento }),
  })
}

export function agregarProgramaProyecto(
  id_proyecto: number,
  datos: { id_programa?: number; programa_otro?: string }
): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}/programas`, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export function agregarGrupoProyecto(
  id_proyecto: number,
  datos: { id_grupo: number; id_linea_investigacion?: number; id_ods?: number }
): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}/grupos`, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export function registrarFinanciacionProyecto(
  id_proyecto: number,
  datos: { valor_solicitado_unicesmag: number; valor_contrapartida: number }
): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}/financiacion`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  })
}

export function agregarAntecedenteProyecto(id_proyecto: number, descripcion: string): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}/antecedentes`, {
    method: 'POST',
    body: JSON.stringify({ descripcion }),
  })
}

export function agregarReferenciaProyecto(id_proyecto: number, referencia: string): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}/referencias`, {
    method: 'POST',
    body: JSON.stringify({ referencia }),
  })
}

export interface ObjetivoCreado {
  id_objetivo: number
  tipo_objetivo: string
  descripcion: string
}

interface RespuestaObjetivo {
  mensaje: string
  objetivo: ObjetivoCreado
}

export async function agregarObjetivoProyecto(
  id_proyecto: number,
  tipo_objetivo: 'general' | 'especifico',
  descripcion: string
): Promise<ObjetivoCreado> {
  const respuesta = await apiFetch<RespuestaObjetivo>(`/proyectos/${id_proyecto}/objetivos`, {
    method: 'POST',
    body: JSON.stringify({ tipo_objetivo, descripcion }),
  })
  return respuesta.objetivo
}

export function agregarImpactoObjetivo(
  id_proyecto: number,
  id_objetivo: number,
  datos: { impacto_esperado: string; beneficiario_potencial?: string; indicador_verificable?: string }
): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}/objetivos/${id_objetivo}/impactos`, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export function agregarParticipanteProyecto(
  id_proyecto: number,
  datos: { participante: number; id_dedicacion: number; id_rol_pro: number; id_rol_estudiante?: number }
): Promise<{ participante: { id_usuarioproyecto: number } }> {
  return apiFetch(`/proyectos/${id_proyecto}/participantes`, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export function registrarInformacionEgresado(
  id_proyecto: number,
  id_participante: number,
  datos: { facultad?: string; programa_academico?: string; empresa_entidad?: string; dedicacion_horas_semanales?: number }
): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}/participantes/${id_participante}/egresado`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  })
}

export function agregarProductoProyecto(
  id_proyecto: number,
  datos: { id_tipo_producto: number; cantidad: number }
): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}/productos`, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export interface ActividadCronogramaCreada {
  id_actividad: number
}

interface RespuestaActividad {
  mensaje: string
  actividad: ActividadCronogramaCreada
}

export async function agregarActividadCronograma(
  id_proyecto: number,
  datos: { responsable: number; actividad: string; resultado?: string }
): Promise<ActividadCronogramaCreada> {
  const respuesta = await apiFetch<RespuestaActividad>(`/proyectos/${id_proyecto}/cronograma`, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
  return respuesta.actividad
}

export function programarActividadCronograma(
  id_proyecto: number,
  id_actividad: number,
  datos: { id_periodo: number; año: number; mes: number }
): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}/cronograma/${id_actividad}/periodos`, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}
