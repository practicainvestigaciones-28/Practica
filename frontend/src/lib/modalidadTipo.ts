export type CategoriaModalidadTipo = 'modalidad' | 'tipo'

export interface ModalidadTipoItem {
  id: number
  nombre: string
  categoria: CategoriaModalidadTipo
  activo: boolean
}

const STORAGE_KEY = 'sgpvie_modalidad_tipo'


const itemsSemilla: ModalidadTipoItem[] = [
  { id: 1, nombre: 'Investigación Científica', categoria: 'modalidad', activo: true },
  { id: 2, nombre: 'Desarrollo Tecnológico', categoria: 'modalidad', activo: true },
  { id: 3, nombre: 'Innovación', categoria: 'modalidad', activo: true },
  { id: 4, nombre: 'Creación Artística y Cultural', categoria: 'modalidad', activo: false },
  { id: 5, nombre: 'Investigación Aplicada', categoria: 'tipo', activo: false },
  { id: 6, nombre: 'Investigación Básica', categoria: 'tipo', activo: true },
]

function cargarInicial(): ModalidadTipoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ModalidadTipoItem[]
  } catch {

  }
  return itemsSemilla
}

function guardar(lista: ModalidadTipoItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {

  }
}

let items: ModalidadTipoItem[] = cargarInicial()

export function getModalidadTipoItems(): ModalidadTipoItem[] {
  return items
}

export function addModalidadTipoItem(nombre: string, categoria: CategoriaModalidadTipo): void {
  items = [...items, { id: Date.now(), nombre, categoria, activo: true }]
  guardar(items)
}

export function editarModalidadTipoItem(id: number, nombre: string): void {
  items = items.map((i) => (i.id === id ? { ...i, nombre } : i))
  guardar(items)
}

export function eliminarModalidadTipoItem(id: number): void {
  items = items.filter((i) => i.id !== id)
  guardar(items)
}

export function toggleModalidadTipoActivo(id: number): void {
  items = items.map((i) => (i.id === id ? { ...i, activo: !i.activo } : i))
  guardar(items)
}