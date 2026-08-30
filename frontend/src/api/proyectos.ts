import { apiFetch } from './client'

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
}

export interface ProyectoCreado {
  id_proyecto: number
  titulo: string
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

export function agregarAreaProyecto(id_proyecto: number, id_area_conocimiento: number): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}/areas`, {
    method: 'POST',
    body: JSON.stringify({ id_area_conocimiento }),
  })
}

export function agregarProgramaProyecto(id_proyecto: number, id_programa: number): Promise<unknown> {
  return apiFetch(`/proyectos/${id_proyecto}/programas`, {
    method: 'POST',
    body: JSON.stringify({ id_programa }),
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
