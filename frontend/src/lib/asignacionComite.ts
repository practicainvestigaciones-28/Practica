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

// Datos de ejemplo — mientras el backend no esté listo. El mismo grupo de
// proyectos y el mismo grupo de pares se usa como fuente para ambos
// comités; lo que cambia entre uno y otro es solo la asignación guardada.
const proyectosSemilla: ProyectoParaAsignar[] = [1, 2, 3, 4].map((n) => ({
  id: n,
  titulo: `Proyecto ${n}`,
  investigador: `Investigador ${n}`,
}))

const paresSemilla: ParEvaluador[] = [
  { id: 1, nombre: 'Laura Pérez', especialidad: 'Innovación educativa' },
  { id: 2, nombre: 'Carlos Romero', especialidad: 'Tecnología educativa' },
  { id: 3, nombre: 'Felipe Ortiz', especialidad: 'Tic/Software' },
  { id: 4, nombre: 'Anna Prieto', especialidad: 'Gestión educativa' },
]

// ⚠️ MODO PRUEBA — mientras el backend no esté listo.
// Las asignaciones se guardan separadas por comité:
// { etica: { [id_proyecto]: number[] }, investigacion: { [id_proyecto]: number[] } }

type AsignacionesPorProyecto = Record<number, number[]>
type AsignacionesGuardadas = Record<TipoComite, AsignacionesPorProyecto>

function cargarAsignaciones(): AsignacionesGuardadas {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AsignacionesGuardadas
  } catch {
    // localStorage no disponible o datos corruptos — se usa vacío
  }
  return { etica: {}, investigacion: {}, pares: {} }
}

function guardarEnStorage(asignaciones: AsignacionesGuardadas): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(asignaciones))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
  }
}

let asignaciones: AsignacionesGuardadas = cargarAsignaciones()

export function getProyectosParaAsignar(): ProyectoParaAsignar[] {
  return proyectosSemilla
}

export function getParesEvaluadores(): ParEvaluador[] {
  return paresSemilla
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