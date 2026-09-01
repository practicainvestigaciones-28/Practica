export interface AreaConocimiento {
  id: number
  nombre: string
  descripcion: string
  activa: boolean
}

const STORAGE_KEY = 'sgpvie_areas_conocimiento'


const areasSemilla: AreaConocimiento[] = [
  { id: 1, nombre: 'Ciencias naturales', descripcion: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', activa: false },
  { id: 2, nombre: 'Ciencias médicas y de la salud', descripcion: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', activa: true },
  { id: 3, nombre: 'Ciencias agrícolas', descripcion: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', activa: false },
  { id: 4, nombre: 'Ingeniería y Tecnología', descripcion: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', activa: true },
  { id: 5, nombre: 'Ciencias Sociales', descripcion: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', activa: false },
  { id: 6, nombre: 'Humanidades', descripcion: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', activa: true },
]


function cargarInicial(): AreaConocimiento[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AreaConocimiento[]
  } catch {

  }
  return areasSemilla
}

function guardar(lista: AreaConocimiento[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {

  }
}

let areas: AreaConocimiento[] = cargarInicial()

export function getAreas(): AreaConocimiento[] {
  return areas
}

export function addArea(nombre: string, descripcion: string): void {
  areas = [...areas, { id: Date.now(), nombre, descripcion, activa: true }]
  guardar(areas)
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