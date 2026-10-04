import { apiFetch, type RespuestaPaginada } from '../../../shared/api/client'

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
  componente_etico?: string
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

export interface ProyectoDetalle {
  id_proyecto: number
  titulo: string
  estado_actual: string
  fecha_registro: string
  ciudad: string | null
  departamento: string | null
  resumen: string | null
  planteamiento_problema: string | null
  pregunta_investigacion: string | null
  justificacion: string | null
  marco_teorico: string | null
  metodologia_preliminar: string | null
  componente_etico: string | null
  funciones_estudiante_auxiliar: string | null
  duracion_periodos: number | null
  convocatoria: { id_convocatoria: number; nombre: string } | null
  modalidad: { nombre: string } | null
  tipoProyecto: { nombre: string } | null
  creador: { id_usuario: number; nombre: string; apellido: string; correo: string }
}

export function obtenerProyecto(id_proyecto: number): Promise<ProyectoDetalle> {
  return apiFetch(`/proyectos/${id_proyecto}`)
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
  duracion_periodos?: number
}

export function actualizarProyecto(id_proyecto: number, cambios: CamposEditablesProyecto): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}`, {
    method: 'PUT',
    body: JSON.stringify(cambios),
  })
}

// --- Lectura de los sub-recursos del proyecto, para vistas de "ver todo lo
// que diligenció el investigador" (comités, revisión inicial, etc). ---

export interface ParticipanteProyecto {
  id_usuarioproyecto: number
  // null = participante sin cuenta en el sistema (ver usuario/_manual más abajo).
  participante: number | null
  orcid: string | null
  google_academico: string | null
  codigo_estudiantil: string | null
  // null = participante escrito a mano, sin cuenta en el sistema (ver los campos _manual).
  usuario: { id_usuario: number; nombre: string; apellido: string; correo: string } | null
  nombre_manual: string | null
  apellido_manual: string | null
  correo_manual: string | null
  dedicacion: { nombre: string }
  rolProyecto: { nombre: string }
  rolEstudiante: { nombre: string } | null
}

export function listarParticipantes(id_proyecto: number): Promise<ParticipanteProyecto[]> {
  return apiFetch(`/proyectos/${id_proyecto}/participantes`)
}

export interface AreaDelProyecto {
  area: { id_area_conocimiento: number; nombre: string }
}

export function listarAreasProyecto(id_proyecto: number): Promise<AreaDelProyecto[]> {
  return apiFetch(`/proyectos/${id_proyecto}/areas`)
}

export interface ProgramaDelProyecto {
  programa: { id_programa: number; nombre: string; id_facultad: number } | null
  programa_otro: string | null
}

export function listarProgramasProyecto(id_proyecto: number): Promise<ProgramaDelProyecto[]> {
  return apiFetch(`/proyectos/${id_proyecto}/programas`)
}

export interface FinanciacionProyecto {
  valor_solicitado_unicesmag: string
  valor_contrapartida: string
  valor_total: string
}

/** 404 si el proyecto todavía no registró financiación. */
export function obtenerFinanciacionProyecto(id_proyecto: number): Promise<FinanciacionProyecto> {
  return apiFetch(`/proyectos/${id_proyecto}/financiacion`)
}

export interface GrupoDelProyecto {
  grupo: {
    id_grupo: number
    id_facultad: number | null
    nombre: string
    lider_grupo: string | null
    facultad_otra: string | null
    programa_otro: string | null
    cod_gruplac: string | null
    reconocido_minciencias: boolean
    categoria: string | null
    acuerdo_institucional: string | null
    linea_medular: string | null
  }
  lineaInvestigacion: { nombre: string } | null
  ods: { nombre: string } | null
}

export function listarGruposDelProyecto(id_proyecto: number): Promise<GrupoDelProyecto[]> {
  return apiFetch(`/proyectos/${id_proyecto}/grupos`)
}

export interface ImpactoObjetivo {
  impacto_esperado: string
  beneficiario_potencial: string | null
  indicador_verificable: string | null
}

export interface ObjetivoProyecto {
  id_objetivo: number
  tipo_objetivo: string
  descripcion: string
  impactos: ImpactoObjetivo[]
}

export function listarObjetivosProyecto(id_proyecto: number): Promise<ObjetivoProyecto[]> {
  return apiFetch(`/proyectos/${id_proyecto}/objetivos`)
}

export interface AntecedenteProyecto {
  descripcion: string
  fecha_publicacion: string | null
  autor: string | null
  fuente: string | null
}

export function listarAntecedentesProyecto(id_proyecto: number): Promise<AntecedenteProyecto[]> {
  return apiFetch(`/proyectos/${id_proyecto}/antecedentes`)
}

export interface ReferenciaProyecto {
  referencia: string
}

export function listarReferenciasProyecto(id_proyecto: number): Promise<ReferenciaProyecto[]> {
  return apiFetch(`/proyectos/${id_proyecto}/referencias`)
}

export interface ActividadCronogramaProyecto {
  id_actividad: number
  actividad: string
  resultado: string | null
  /** Responsable escrito a mano en el formulario (nombre libre). */
  responsable_manual: string | null
  responsables: { usuario: { nombre: string; apellido: string } }[]
  periodos: { año: number; mes: number; periodo: { nombre: string } }[]
}

export function listarActividadesCronograma(id_proyecto: number): Promise<ActividadCronogramaProyecto[]> {
  return apiFetch(`/proyectos/${id_proyecto}/cronograma`)
}

export interface ProductoDelProyecto {
  cantidad: number
  tipoProducto: {
    nombre: string
    subcategoria: { nombre: string; categoria: { nombre: string } }
  }
}

export function listarProductosProyecto(id_proyecto: number): Promise<ProductoDelProyecto[]> {
  return apiFetch(`/proyectos/${id_proyecto}/productos`)
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
  datos: (
    | { participante: number }
    | { nombre: string; apellido?: string; correo: string }
  ) & {
    id_dedicacion: number
    id_rol_pro: number
    id_rol_estudiante?: number
    orcid?: string
    google_academico?: string
    codigo_estudiantil?: string
  }
): Promise<{ participante: { id_usuarioproyecto: number } }> {
  return apiFetch(`/proyectos/${id_proyecto}/participantes`, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export interface InformacionEgresado {
  id_facultad: number | null
  id_programa: number | null
  facultad: string | null
  programa_academico: string | null
  empresa_entidad: string | null
  dedicacion_horas_semanales: number | null
  cedula: string | null
}

/** 404 si el participante todavía no tiene información de egresado registrada. */
export function obtenerInformacionEgresado(id_proyecto: number, id_participante: number): Promise<InformacionEgresado> {
  return apiFetch(`/proyectos/${id_proyecto}/participantes/${id_participante}/egresado`)
}

export function registrarInformacionEgresado(
  id_proyecto: number,
  id_participante: number,
  datos: {
    id_facultad?: number
    id_programa?: number
    facultad?: string
    programa_academico?: string
    empresa_entidad?: string
    dedicacion_horas_semanales?: number
    cedula?: string
  }
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
  datos: { responsables: number[]; actividad: string; resultado?: string; responsable_manual?: string }
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
