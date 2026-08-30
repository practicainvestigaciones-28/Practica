import type { Role } from './auth'

export type TipoNotificacion = 'observacion' | 'asignacion_comite' | 'cambio_estado' | 'sistema'

export interface NotificacionProyecto {
  titulo: string
  estado: string
  fechaEnvio: string
  observacion: string
}

export interface Notificacion {
  id: number
  destinatario: Role | 'todos'
  tipo: TipoNotificacion
  titulo: string
  descripcion: string
  fecha: string
  leida: boolean
  proyecto?: NotificacionProyecto
}

const STORAGE_KEY = 'sgpvie_notificaciones'

// Datos de ejemplo — semilla inicial, solo se usa la primera vez que se
// abre la app en este navegador (o si localStorage está vacío/corrupto).
const notificacionesSemilla: Notificacion[] = [
  // ---- Investigador ----
  {
    id: 1,
    destinatario: 'usuario',
    tipo: 'observacion',
    titulo: 'Proyecto investigación',
    descripcion: 'Se ha realizado una observación del proyecto Sistema Integral de Gestión Académica.',
    fecha: '12/03/2026',
    leida: false,
    proyecto: {
      titulo: 'Sistema Integral de Gestión Académica',
      estado: 'En espera para asignar a comité de investigación.',
      fechaEnvio: '01/01/2026',
      observacion:
        'El proyecto presentado no cuenta con las firmas requeridas en la documentación adjunta. Se solicita anexar las firmas correspondientes y realizar nuevamente el envío para continuar con el proceso.',
    },
  },
  {
    id: 2,
    destinatario: 'usuario',
    tipo: 'asignacion_comite',
    titulo: 'Comité de investigación',
    descripcion: 'Se le ha asignado un proyecto para revisión y evaluación para Comité de Investigación.',
    fecha: '12/03/2026',
    leida: true,
  },
  {
    id: 3,
    destinatario: 'usuario',
    tipo: 'cambio_estado',
    titulo: 'Proyecto investigación',
    descripcion: 'Su proyecto ha pasado a evaluación por parte del Comité de Ética.',
    fecha: '12/03/2026',
    leida: false,
    proyecto: {
      titulo: 'Observatorio de Innovación Regional',
      estado: 'En evaluación por el Comité de Ética.',
      fechaEnvio: '18/02/2026',
      observacion: 'El proyecto ha pasado a evaluación por parte del Comité de Ética para su respectiva revisión y análisis.',
    },
  },

  // ---- Administrador ----
  {
    id: 4,
    destinatario: 'administrador',
    tipo: 'sistema',
    titulo: 'Nuevo proyecto registrado',
    descripcion: 'Un investigador ha registrado un nuevo proyecto pendiente de asignación a comité.',
    fecha: '12/03/2026',
    leida: false,
  },
  {
    id: 5,
    destinatario: 'administrador',
    tipo: 'sistema',
    titulo: 'Convocatoria por vencer',
    descripcion: 'La convocatoria activa cierra en los próximos días.',
    fecha: '10/03/2026',
    leida: true,
  },
  {
    id: 6,
    destinatario: 'administrador',
    tipo: 'sistema',
    titulo: 'Nuevo usuario registrado',
    descripcion: 'Se ha registrado un nuevo usuario en el sistema.',
    fecha: '08/03/2026',
    leida: false,
  },
]

// ⚠️ MODO PRUEBA — mientras el backend no esté listo.
// Mismo patrón que los demás lib/*.ts: persistimos en localStorage para
// que los cambios (marcar como leída, nuevas notificaciones) sobrevivan
// entre pestañas y recargas. Cuando tu compañero tenga el endpoint real
// (por ejemplo GET /api/notificaciones filtrado por usuario, y algo como
// websockets o polling para tiempo real), se reemplaza cargarInicial()/
// guardar() por eso, y addNotificacion() deja de ser necesaria del lado
// del frontend porque las notificaciones llegarían ya creadas del backend.

function cargarInicial(): Notificacion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Notificacion[]
  } catch {
    // localStorage no disponible o datos corruptos — se usa la semilla
  }
  return notificacionesSemilla
}

function guardar(lista: Notificacion[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
  }
}

let notificaciones: Notificacion[] = cargarInicial()

/** Devuelve las notificaciones relevantes para un rol, más recientes primero. */
export function getNotificaciones(role: Role): Notificacion[] {
  return notificaciones
    .filter((n) => n.destinatario === role || n.destinatario === 'todos')
    .sort((a, b) => b.id - a.id)
}

export function contarNoLeidas(role: Role): number {
  return getNotificaciones(role).filter((n) => !n.leida).length
}

export function marcarLeida(id: number): void {
  notificaciones = notificaciones.map((n) => (n.id === id ? { ...n, leida: true } : n))
  guardar(notificaciones)
}

/**
 * Punto de enganche para cuando las acciones del sistema (crear proyecto,
 * cambiar de comité, agregar una observación, etc.) sean reales y no
 * datos de ejemplo. Ejemplo de uso futuro dentro de esa acción real:
 *   addNotificacion({ destinatario: 'usuario', tipo: 'cambio_estado', ... })
 */
export function addNotificacion(datos: Omit<Notificacion, 'id' | 'leida'>): void {
  notificaciones = [...notificaciones, { ...datos, id: Date.now(), leida: false }]
  guardar(notificaciones)
}