export interface AreaConocimiento {
  id: number
  nombre: string
  descripcion: string
  activa: boolean
  /** true = el id de arriba es un id_area_conocimiento real del backend
   * (se puede usar para crear un proyecto). false = todavía no tiene
   * contraparte real (nombre distinto o no creada allá) — no se le debe
   * mostrar al investigador, o el guardado del proyecto fallaría. */
  sincronizada: boolean
}

const STORAGE_KEY = 'sgpvie_areas_conocimiento'

// Datos de ejemplo — semilla inicial, solo se usa la primera vez que se
// abre la app en este navegador (o si localStorage está vacío/corrupto).
// Todas activas por defecto — ver nota en sincronizarConBackend() sobre
// por qué "activa" ya no es solo decorativo.
const areasSemilla: AreaConocimiento[] = [
  { id: 1, nombre: 'Ciencias naturales', descripcion: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', activa: true, sincronizada: false },
  { id: 2, nombre: 'Ciencias médicas y de la salud', descripcion: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', activa: true, sincronizada: false },
  { id: 3, nombre: 'Ciencias agrícolas', descripcion: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', activa: true, sincronizada: false },
  { id: 4, nombre: 'Ingeniería y Tecnología', descripcion: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', activa: true, sincronizada: false },
  { id: 5, nombre: 'Ciencias Sociales', descripcion: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', activa: true, sincronizada: false },
  { id: 6, nombre: 'Humanidades', descripcion: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', activa: true, sincronizada: false },
]

// ⚠️ MODO PRUEBA — mientras el backend no esté listo.
// Mismo patrón que los demás lib/*.ts: persistimos en localStorage para
// que los cambios sean visibles entre pestañas sin necesitar backend
// todavía. Cuando tu compañero tenga los endpoints reales (GET/POST/PUT
// a /api/areas-conocimiento), se reemplaza cargarInicial()/guardar()
// por los fetch correspondientes.

function cargarInicial(): AreaConocimiento[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AreaConocimiento[]
  } catch {
    // localStorage no disponible o datos corruptos — se usa la semilla
  }
  return areasSemilla
}

function guardar(lista: AreaConocimiento[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
  }
}

let areas: AreaConocimiento[] = cargarInicial()

export function getAreas(): AreaConocimiento[] {
  return areas
}

/** Lo que debe ver el investigador al crear un proyecto: activas Y con id real. */
export function getAreasActivas(): AreaConocimiento[] {
  return areas.filter((a) => a.activa && a.sincronizada)
}

export function addArea(nombre: string, descripcion: string, idReal?: number): void {
  areas = [...areas, { id: idReal ?? Date.now(), nombre, descripcion, activa: true, sincronizada: idReal != null }]
  guardar(areas)
}

/**
 * Empareja por nombre el id local con el id_area_conocimiento real del
 * backend — esta pantalla sigue editando/desactivando/eliminando en local
 * (sin endpoints reales para eso todavía), pero así lo que el investigador
 * termina enviando al crear un proyecto sí es un id real y válido. Lo que
 * el backend ya tenía y esta lista no conocía se agrega también (activa).
 */
export function sincronizarConBackend(areasReales: { id_area_conocimiento?: number; nombre: string }[]): void {
  const reales = areasReales.filter((a) => a.id_area_conocimiento != null)

  let cambio = false
  const actualizadas = areas.map((area) => {
    const real = reales.find((r) => r.nombre === area.nombre)
    if (real && (real.id_area_conocimiento !== area.id || !area.sincronizada)) {
      cambio = true
      return { ...area, id: real.id_area_conocimiento!, sincronizada: true }
    }
    return area
  })

  const nombresConocidos = new Set(actualizadas.map((a) => a.nombre))
  const nuevas: AreaConocimiento[] = reales
    .filter((r) => !nombresConocidos.has(r.nombre))
    .map((r) => ({ id: r.id_area_conocimiento!, nombre: r.nombre, descripcion: '', activa: true, sincronizada: true }))
  if (nuevas.length > 0) cambio = true

  if (cambio) {
    areas = [...actualizadas, ...nuevas]
    guardar(areas)
  }
}

export function editarArea(id: number, nombre: string, descripcion: string): void {
  areas = areas.map((a) => (a.id === id ? { ...a, nombre, descripcion } : a))
  guardar(areas)
}

export function eliminarArea(id: number): void {
  areas = areas.filter((a) => a.id !== id)
  guardar(areas)
}

export function toggleAreaActiva(id: number): void {
  areas = areas.map((a) => (a.id === id ? { ...a, activa: !a.activa } : a))
  guardar(areas)
}