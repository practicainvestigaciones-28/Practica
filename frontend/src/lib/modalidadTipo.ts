export type CategoriaModalidadTipo = 'modalidad' | 'tipo'

export interface ModalidadTipoItem {
  id: number
  nombre: string
  categoria: CategoriaModalidadTipo
  activo: boolean
}

const STORAGE_KEY = 'sgpvie_modalidad_tipo'

// Datos de ejemplo — semilla inicial, solo se usa la primera vez que se
// abre la app en este navegador (o si localStorage está vacío/corrupto).
// Todas activas por defecto: como esta lista ahora es la que de verdad ve
// el investigador al crear un proyecto, ninguna debe empezar oculta sin
// que un admin lo haya decidido — antes esto solo era decorativo.
const itemsSemilla: ModalidadTipoItem[] = [
  { id: 1, nombre: 'Investigación Científica', categoria: 'modalidad', activo: true },
  { id: 2, nombre: 'Desarrollo Tecnológico', categoria: 'modalidad', activo: true },
  { id: 3, nombre: 'Innovación', categoria: 'modalidad', activo: true },
  { id: 4, nombre: 'Creación Artística y Cultural', categoria: 'modalidad', activo: true },
  { id: 5, nombre: 'Investigación Aplicada', categoria: 'tipo', activo: true },
  { id: 6, nombre: 'Investigación Básica', categoria: 'tipo', activo: true },
]

// ⚠️ MODO PRUEBA — mientras el backend no esté listo.
// Mismo patrón que los demás lib/*.ts: persistimos en localStorage para
// que los cambios sean visibles entre pestañas sin necesitar backend
// todavía. Cuando tu compañero tenga los endpoints reales (GET/POST/PUT/
// DELETE a /api/modalidad-tipo), se reemplaza cargarInicial()/guardar()
// por los fetch correspondientes.

function cargarInicial(): ModalidadTipoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ModalidadTipoItem[]
  } catch {
    // localStorage no disponible o datos corruptos — se usa la semilla
  }
  return itemsSemilla
}

function guardar(lista: ModalidadTipoItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
  }
}

let items: ModalidadTipoItem[] = cargarInicial()

export function getModalidadTipoItems(): ModalidadTipoItem[] {
  return items
}

/** Solo las activas — es lo que debe ver el investigador al crear un proyecto. */
export function getModalidadTipoItemsActivos(categoria: CategoriaModalidadTipo): ModalidadTipoItem[] {
  return items.filter((i) => i.categoria === categoria && i.activo)
}

export function addModalidadTipoItem(nombre: string, categoria: CategoriaModalidadTipo, idReal?: number): void {
  items = [...items, { id: idReal ?? Date.now(), nombre, categoria, activo: true }]
  guardar(items)
}

/**
 * Hace que el "id" de cada item local sea el id real del backend (buscando
 * por nombre+categoría) — así, aunque esta pantalla siga editando/
 * desactivando/eliminando solo en local (todavía sin endpoints para eso),
 * lo que el investigador termina enviando al crear un proyecto SÍ es un
 * id_modalidad/id_tipo_proyecto real y válido. Los que el backend ya tenía
 * y esta lista todavía no conocía, se agregan (activos por defecto).
 */
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