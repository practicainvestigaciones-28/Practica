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
  { id: 4, nombre: 'Creación Artística y Cultural', categoria: 'modalidad', activo: true },
  { id: 5, nombre: 'Investigación Aplicada', categoria: 'tipo', activo: true },
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

export function getModalidadTipoItemsActivos(categoria: CategoriaModalidadTipo): ModalidadTipoItem[] {
  return items.filter((i) => i.categoria === categoria && i.activo)
}

export function addModalidadTipoItem(nombre: string, categoria: CategoriaModalidadTipo, idReal?: number): void {
  items = [...items, { id: idReal ?? Date.now(), nombre, categoria, activo: true }]
  guardar(items)
}

export function sincronizarConBackend(
  modalidadesReales: { id_modalidad?: number; nombre: string }[],
  tiposReales: { id_tipo_proyecto?: number; nombre: string }[]
): void {
  const reales = [
    ...modalidadesReales
      .filter((m) => m.id_modalidad != null)
      .map((m) => ({ id: m.id_modalidad!, nombre: m.nombre, categoria: 'modalidad' as const })),
    ...tiposReales
      .filter((t) => t.id_tipo_proyecto != null)
      .map((t) => ({ id: t.id_tipo_proyecto!, nombre: t.nombre, categoria: 'tipo' as const })),
  ]

  let cambio = false
  const actualizados = items.map((item) => {
    const real = reales.find((r) => r.categoria === item.categoria && r.nombre === item.nombre)
    if (real && real.id !== item.id) {
      cambio = true
      return { ...item, id: real.id }
    }
    return item
  })

  const yaConocidos = new Set(actualizados.map((i) => `${i.categoria}:${i.nombre}`))
  const nuevos: ModalidadTipoItem[] = reales
    .filter((r) => !yaConocidos.has(`${r.categoria}:${r.nombre}`))
    .map((r) => ({ id: r.id, nombre: r.nombre, categoria: r.categoria, activo: true }))
  if (nuevos.length > 0) cambio = true

  if (cambio) {
    items = [...actualizados, ...nuevos]
    guardar(items)
  }
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