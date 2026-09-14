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

const STORAGE_KEY = 'sgpvie_asignacion_comites'

const proyectosSemilla: ProyectoParaAsignar[] = []
const paresSemilla: ParEvaluador[] = []

// Mapeo de TipoComite a IDs de etapa (basado en seed.ts)
const etapaIdPorTipo: Record<TipoComite, number> = {
  investigacion: 2, // Comite_Investigacion
  etica: 3, // Etica
  pares: 4, // Pares
}

// Mapeo de TipoComite a rol que debe asignarse (evaluadores)
const rolEvaluadorPorTipo: Record<TipoComite, string> = {
  investigacion: 'Comité de Investigación',
  etica: 'Comité de Ética',
  pares: 'Par Evaluador',
}

type AsignacionesPorProyecto = Record<number, number[]>
type AsignacionesGuardadas = Record<TipoComite, AsignacionesPorProyecto>

function cargarAsignaciones(): AsignacionesGuardadas {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AsignacionesGuardadas
  } catch {

  }
  return { etica: {}, investigacion: {}, pares: {} }
}

function guardarEnStorage(asignaciones: AsignacionesGuardadas): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(asignaciones))
  } catch {

  }
}

let asignaciones: AsignacionesGuardadas = cargarAsignaciones()
let proyectosEnCache: ProyectoParaAsignar[] = []
let paresEnCache: ParEvaluador[] = []
let ultimaTipoComiteCacheado: TipoComite | null = null

/** Traer asignaciones de BD y actualizar cache */
export async function sincronizarAsignaciones(tipo: TipoComite): Promise<void> {
  try {
    const idEtapa = etapaIdPorTipo[tipo]
    const response = await fetch(`/api/evaluaciones/asignaciones?id_etapa=${idEtapa}`)
    if (!response.ok) throw new Error('Error al traer asignaciones')

    const asignacionesDelBackend = await response.json()

    // Convertir respuesta del backend a ProyectoParaAsignar
    proyectosEnCache = asignacionesDelBackend.map((asig: any) => ({
      id: asig.proyecto?.id_proyecto ?? 0,
      titulo: asig.proyecto?.titulo ?? 'Sin título',
      investigador: asig.proyecto?.creador
        ? `${asig.proyecto.creador.nombre} ${asig.proyecto.creador.apellido}`
        : 'Desconocido',
    }))

    ultimaTipoComiteCacheado = tipo
  } catch (error) {
    console.error('Error sincronizando asignaciones:', error)
  }
}

/** Traer evaluadores por rol de BD y actualizar cache */
export async function sincronizarEvaluadores(tipo: TipoComite): Promise<void> {
  try {
    // Traer todos los usuarios con el rol correspondiente
    const rolBuscado = rolEvaluadorPorTipo[tipo]
    const response = await fetch(`/api/usuarios/buscar?q=`)
    if (!response.ok) throw new Error('Error al traer usuarios')

    const usuariosDelBackend = await response.json()

    // Filtrar por rol (necesitaría un endpoint mejor, pero mientras tanto usamos lo que hay)
    // TODO: implementar un endpoint específico que traiga usuarios por rol
    paresEnCache = usuariosDelBackend
      .slice(0, 10) // Limitar a 10 evaluadores de prueba
      .map((usuario: any) => ({
        id: usuario.id_usuario,
        nombre: `${usuario.nombre} ${usuario.apellido}`,
        especialidad: 'Evaluador', // TODO: traer especialidad real de BD si existe
      }))
  } catch (error) {
    console.error('Error sincronizando evaluadores:', error)
  }
}

export function getProyectosParaAsignar(): ProyectoParaAsignar[] {
  return proyectosEnCache
}

export function getParesEvaluadores(): ParEvaluador[] {
  return paresEnCache
}

export function getAsignacion(tipo: TipoComite, proyectoId: number): number[] {
  return asignaciones[tipo]?.[proyectoId] ?? []
}

export function estaAsignado(tipo: TipoComite, proyectoId: number): boolean {
  return getAsignacion(tipo, proyectoId).length > 0
}

export function guardarAsignacion(tipo: TipoComite, proyectoId: number, paresIds: number[]): void {
  asignaciones = {
    ...asignaciones,
    [tipo]: { ...asignaciones[tipo], [proyectoId]: paresIds },
  }
  guardarEnStorage(asignaciones)
}