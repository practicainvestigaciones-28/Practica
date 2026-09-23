import * as evaluacionesApi from '../../evaluaciones/api/evaluaciones'
import * as usuariosApi from '../../usuarios/api/usuarios'

export type TipoComite = 'etica' | 'investigacion' | 'pares'

export interface ParEvaluador {
  id: number
  nombre: string
  especialidad: string
}

export interface ProyectoParaAsignar {
  id: number
  titulo: string
  investigador: string
  /** id_usuario del responsable ya asignado en BD, o null si aún no tiene */
  asignadoA: number | null
}

interface ConfigComite {
  tituloSidebar: string
  tituloPagina: string
  subtitulo: string
  maxPares: number
  tituloPanelIzquierdo: string
  placeholderBuscarPar: string
  notaLimite: (max: number) => string
}

export const configComite: Record<TipoComite, ConfigComite> = {
  etica: {
    tituloSidebar: 'Asignación Comité Ética',
    tituloPagina: 'Asignación de proyectos a pares',
    subtitulo: 'Selecciona un proyecto y asígnalos a los pares evaluadores correspondientes',
    maxPares: 3,
    tituloPanelIzquierdo: 'Seleccionar pares evaluadores',
    placeholderBuscarPar: 'Buscar por par evaluador...',
    notaLimite: (max) => `Puedes asignar solamente ${max} evaluadores a cada proyecto`,
  },
  investigacion: {
    tituloSidebar: 'Asignación Comité Investigación',
    tituloPagina: 'Asignación de proyectos a comité investigación',
    subtitulo: 'Selecciona un proyecto y asígnalos a comité de investigación correspondiente',
    maxPares: 1,
    tituloPanelIzquierdo: 'Seleccionar comité de investigación',
    placeholderBuscarPar: 'Buscar por comité de investigación...',
    notaLimite: (max) => `Puedes asignar solamente ${max} evaluador${max === 1 ? '' : 'es'} por proyecto`,
  },
  pares: {
    tituloSidebar: 'Asignación Pares',
    tituloPagina: 'Asignación de proyectos a pares',
    subtitulo: 'Selecciona un proyecto y asígnalos a los pares evaluadores correspondientes',
    maxPares: 2,
    tituloPanelIzquierdo: 'Seleccionar pares evaluadores',
    placeholderBuscarPar: 'Buscar por par evaluador...',
    notaLimite: (max) => `Puedes asignar solamente ${max} evaluadores a cada proyecto`,
  },
}

// IDs de etapa según el seed (backend/prisma/seed.ts, orden de creación):
// 1=General/Inicial, 2=Comite_Investigacion, 3=Etica, 4=Pares
const etapaIdPorTipo: Record<TipoComite, number> = {
  investigacion: 2,
  etica: 3,
  pares: 4,
}

// Mapeo de TipoComite a rol que debe asignarse (evaluadores)
const rolEvaluadorPorTipo: Record<TipoComite, string> = {
  investigacion: 'Comité de Investigación',
  etica: 'Comité de Ética',
  pares: 'Par Evaluador',
}

// Cache en memoria de la última sincronización con BD (ver sincronizarAsignaciones
// / sincronizarEvaluadores). BD es la única fuente de verdad — no se usa
// localStorage: tras recargar la página, el componente vuelve a sincronizar.
let proyectosEnCache: ProyectoParaAsignar[] = []
let paresEnCache: ParEvaluador[] = []

/**
 * Trae de BD las asignaciones de la etapa correspondiente (RQF44) y arma la
 * lista de proyectos a mostrar. Sin filtro `pendientes`: trae tanto las
 * abiertas (sin responsable, recién "aceptadas y enviadas a comité" desde
 * Proyectos Postulados) como las ya cerradas con responsable, porque la UI
 * separa "Pendientes"/"Asignados" localmente según tengan o no evaluador.
 */
export async function sincronizarAsignaciones(tipo: TipoComite): Promise<void> {
  try {
    const idEtapa = etapaIdPorTipo[tipo]
    const asignacionesDelBackend = await evaluacionesApi.listarAsignaciones({ id_etapa: idEtapa })

    proyectosEnCache = asignacionesDelBackend.map((asig) => ({
      id: asig.proyecto.id_proyecto,
      titulo: asig.proyecto.titulo,
      investigador: `${asig.proyecto.creador.nombre} ${asig.proyecto.creador.apellido}`,
      asignadoA: asig.asignadoA?.id_usuario ?? null,
    }))
  } catch (error) {
    console.error('Error sincronizando asignaciones:', error)
    proyectosEnCache = []
  }
}

/**
 * Trae de BD los usuarios activos que tienen el rol evaluador de esta etapa
 * (Comité de Investigación / Comité de Ética / Par Evaluador), para que el
 * Administrador elija entre ellos al responsable de la revisión.
 */
export async function sincronizarEvaluadores(tipo: TipoComite): Promise<void> {
  try {
    const rolBuscado = rolEvaluadorPorTipo[tipo]
    const { data } = await usuariosApi.listarUsuarios({ limit: 100 })

    paresEnCache = data
      .filter((u) => u.roles.includes(rolBuscado))
      .map((u) => ({
        id: u.id_usuario,
        nombre: `${u.nombre} ${u.apellido}`,
        especialidad: rolBuscado,
      }))
  } catch (error) {
    console.error('Error sincronizando evaluadores:', error)
    paresEnCache = []
  }
}

export function getProyectosParaAsignar(): ProyectoParaAsignar[] {
  return proyectosEnCache
}

export function getParesEvaluadores(): ParEvaluador[] {
  return paresEnCache
}

/** El responsable real que tiene el proyecto en BD para esta etapa (o [] si aún no tiene). */
export function getAsignacion(_tipo: TipoComite, proyectoId: number): number[] {
  const proyecto = proyectosEnCache.find((p) => p.id === proyectoId)
  return proyecto?.asignadoA ? [proyecto.asignadoA] : []
}

export function estaAsignado(tipo: TipoComite, proyectoId: number): boolean {
  return getAsignacion(tipo, proyectoId).length > 0
}

/**
 * Confirma el responsable elegido en la UI. El proyecto ya llegó a esta
 * bandeja con una AsignacionRevision abierta y sin integrante (creada al
 * "Aceptar y enviar a Comité" desde Proyectos Postulados) — aquí solo se
 * completa con PATCH .../responsable, nunca se vuelve a crear.
 */
export async function guardarAsignacion(tipo: TipoComite, proyectoId: number, paresIds: number[]): Promise<void> {
  if (paresIds.length === 0) return

  const asignado_a = paresIds[0] // Para Comité Investigación = 1 responsable
  const idEtapa = etapaIdPorTipo[tipo]

  await evaluacionesApi.asignarResponsable(proyectoId, idEtapa, asignado_a)

  // Refleja de inmediato en el cache local; sincronizarAsignaciones() en el
  // siguiente ciclo lo reconfirmará contra BD.
  const proyecto = proyectosEnCache.find((p) => p.id === proyectoId)
  if (proyecto) proyecto.asignadoA = asignado_a
}