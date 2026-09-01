export type CategoriaLinea = 'investigacion' | 'medular'

export interface Linea {
  id: number
  nombre: string
  categoria: CategoriaLinea
  activa: boolean
}

const STORAGE_KEY = 'sgpvie_lineas_investigacion'


const lineasSemilla: Linea[] = [
  { id: 1, nombre: 'Línea 1', categoria: 'investigacion', activa: false },
  { id: 2, nombre: 'Línea 2', categoria: 'investigacion', activa: true },
  { id: 3, nombre: 'Línea 3', categoria: 'investigacion', activa: true },
  { id: 4, nombre: 'Línea 4', categoria: 'investigacion', activa: false },
  { id: 5, nombre: 'Línea 5', categoria: 'investigacion', activa: false },
  { id: 6, nombre: 'Línea 6', categoria: 'investigacion', activa: true },
  { id: 7, nombre: 'Línea medular 1', categoria: 'medular', activa: false },
  { id: 8, nombre: 'Línea medular 2', categoria: 'medular', activa: true },
  { id: 9, nombre: 'Línea medular 3', categoria: 'medular', activa: true },
  { id: 10, nombre: 'Línea medular 4', categoria: 'medular', activa: false },
  { id: 11, nombre: 'Línea medular 5', categoria: 'medular', activa: false },
  { id: 12, nombre: 'Línea medular 6', categoria: 'medular', activa: true },
]

function cargarInicial(): Linea[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Linea[]
  } catch {
    // localStorage no disponible o datos corruptos — se usa la semilla
  }
  return lineasSemilla
}

function guardar(lista: Linea[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
  }
}

let lineas: Linea[] = cargarInicial()

export function getLineas(): Linea[] {
  return lineas
}

export function addLinea(nombre: string, categoria: CategoriaLinea): void {
  lineas = [...lineas, { id: Date.now(), nombre, categoria, activa: true }]
  guardar(lineas)
}

export function editarLinea(id: number, nombre: string): void {
  lineas = lineas.map((l) => (l.id === id ? { ...l, nombre } : l))
  guardar(lineas)
}

export function eliminarLinea(id: number): void {
  lineas = lineas.filter((l) => l.id !== id)
  guardar(lineas)
}

export function toggleLineaActiva(id: number): void {
  lineas = lineas.map((l) => (l.id === id ? { ...l, activa: !l.activa } : l))
  guardar(lineas)
}