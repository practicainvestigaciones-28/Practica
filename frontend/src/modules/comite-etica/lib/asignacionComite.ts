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
  /** ids de los responsables ya asignados en BD ([] si aún no tiene ninguno). Puede haber más de uno (ej. Pares admite 2). */
  asignadosA: number[]
  /** Nombres de los responsables ya asignados, en el mismo orden que asignadosA — para mostrarlos en "Asignados" sin entrar al detalle. */
  nombresAsignados: string[]
}

interface ConfigComite {
  tituloSidebar: string
  tituloPagina: string
  subtitulo: string
  maxPares: number
  tituloPanelIzquierdo: string
  placeholderBuscarPar: string
  notaLimite: (max: number) => string
  /** Encabezado de la columna con el nombre de la persona — "Par evaluador" solo tiene sentido para Pares. */
  etiquetaEvaluador: string
  /** Título del panel de la derecha ("Pares seleccionados" solo aplica a Pares). */
  tituloPanelDerecho: string
}

export const configComite: Record<TipoComite, ConfigComite> = {
  etica: {
    tituloSidebar: 'Asignación Comité Ética',
    tituloPagina: 'Asignación de proyectos a comité de ética',
    subtitulo: 'Selecciona un proyecto y asígnalo al integrante de comité de ética correspondiente',
    maxPares: 1,
    tituloPanelIzquierdo: 'Seleccionar comité de ética',
    placeholderBuscarPar: 'Buscar por comité de ética...',
    notaLimite: (max) => `Puedes asignar solamente ${max} evaluador${max === 1 ? '' : 'es'} por proyecto`,
    etiquetaEvaluador: 'Integrante de comité de ética',
    tituloPanelDerecho: 'Integrante seleccionado',
  },
  investigacion: {
    tituloSidebar: 'Asignación Comité Investigación',
    tituloPagina: 'Asignación de proyectos a comité investigación',
    subtitulo: 'Selecciona un proyecto y asígnalos a comité de investigación correspondiente',
    maxPares: 1,
    tituloPanelIzquierdo: 'Seleccionar comité de investigación',
    placeholderBuscarPar: 'Buscar por comité de investigación...',
    notaLimite: (max) => `Puedes asignar solamente ${max} evaluador${max === 1 ? '' : 'es'} por proyecto`,
    etiquetaEvaluador: 'Integrante de comité de investigación',
    tituloPanelDerecho: 'Integrante seleccionado',
  },
  pares: {
    tituloSidebar: 'Asignación Pares',
    tituloPagina: 'Asignación de proyectos a pares',
    subtitulo: 'Selecciona un proyecto y asígnalos a los pares evaluadores correspondientes',
    maxPares: 2,
    tituloPanelIzquierdo: 'Seleccionar pares evaluadores',
    placeholderBuscarPar: 'Buscar por par evaluador...',
    notaLimite: (max) => `Puedes asignar solamente ${max} evaluadores a cada proyecto`,
    etiquetaEvaluador: 'Par evaluador',
    tituloPanelDerecho: 'Pares seleccionados',
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
 * Trae de BD las asignaciones ABIERTAS de la etapa correspondiente (RQF44) y
 * arma la lista de proyectos a mostrar. Solo las abiertas: si se incluyeran
 * también las ya cerradas, un proyecto que ya pasó una vez por este comité
 * (con responsable asignado) y que ahora vuelve con una asignación nueva —
 * por ejemplo, el investigador reenvía correcciones tras Pares y el proyecto
 * se reabre aquí sin responsable todavía — se mezclaría con esa asignación
 * vieja y cerrada, y aparecería como "ya asignado" (con el responsable de la
 * vez anterior) en vez de en "Pendientes", dejando esa asignación nueva
 * invisible para el Administrador.
 */
export async function sincronizarAsignaciones(tipo: TipoComite): Promise<void> {
  try {
    const idEtapa = etapaIdPorTipo[tipo]
    const todasLasAsignaciones = await evaluacionesApi.listarAsignaciones({ id_etapa: idEtapa })
    const asignacionesDelBackend = todasLasAsignaciones.filter((a) => a.fecha_finalizacion === null)

    // Un mismo proyecto puede tener varias filas de AsignacionRevision
    // ABIERTAS para esta etapa (Pares admite 2 evaluadores simultáneos, cada
    // uno en su propia fila) — se agrupan en una sola entrada por proyecto.
    const porProyecto = new Map<number, ProyectoParaAsignar>()
    for (const asig of asignacionesDelBackend) {
      const entrada = porProyecto.get(asig.proyecto.id_proyecto) ?? {
        id: asig.proyecto.id_proyecto,
        titulo: asig.proyecto.titulo,
        investigador: `${asig.proyecto.creador.nombre} ${asig.proyecto.creador.apellido}`,
        asignadosA: [],
        nombresAsignados: [],
      }
      if (asig.asignadoA && !entrada.asignadosA.includes(asig.asignadoA.id_usuario)) {
        entrada.asignadosA.push(asig.asignadoA.id_usuario)
        entrada.nombresAsignados.push(`${asig.asignadoA.nombre} ${asig.asignadoA.apellido}`)
      }
      porProyecto.set(asig.proyecto.id_proyecto, entrada)
    }
    proyectosEnCache = [...porProyecto.values()]
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

/** Los responsables reales que tiene el proyecto en BD para esta etapa (o [] si aún no tiene ninguno). */
export function getAsignacion(_tipo: TipoComite, proyectoId: number): number[] {
  const proyecto = proyectosEnCache.find((p) => p.id === proyectoId)
  return proyecto?.asignadosA ?? []
}

export function estaAsignado(tipo: TipoComite, proyectoId: number): boolean {
  return getAsignacion(tipo, proyectoId).length > 0
}

/**
 * Confirma el conjunto de responsables elegido en la UI. El proyecto ya
 * llegó a esta bandeja con una AsignacionRevision abierta (creada al
 * "Aceptar y enviar a Comité" desde Proyectos Postulados, o automáticamente
 * al aprobar la etapa anterior) — aquí solo se completa/reemplaza con
 * PATCH .../responsable, nunca se vuelve a crear a mano. Se manda la lista
 * completa que debe quedar asignada (no solo el que se agrega): el backend
 * se encarga de reutilizar filas libres o crear las que falten hasta el
 * cupo de la etapa (1 para comités, 2 para Pares).
 */
export async function guardarAsignacion(tipo: TipoComite, proyectoId: number, evaluadoresIds: number[]): Promise<void> {
  if (evaluadoresIds.length === 0) return

  const idEtapa = etapaIdPorTipo[tipo]

  await evaluacionesApi.asignarResponsable(proyectoId, idEtapa, evaluadoresIds)

  // Refleja de inmediato en el cache local; sincronizarAsignaciones() en el
  // siguiente ciclo lo reconfirmará contra BD.
  const proyecto = proyectosEnCache.find((p) => p.id === proyectoId)
  if (proyecto) {
    proyecto.asignadosA = evaluadoresIds
    proyecto.nombresAsignados = evaluadoresIds.map((id) => paresEnCache.find((p) => p.id === id)?.nombre ?? '')
  }
}