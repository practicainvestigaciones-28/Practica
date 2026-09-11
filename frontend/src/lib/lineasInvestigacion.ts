export type CategoriaLinea = 'investigacion' | 'medular'

export interface Linea {
  id: number
  nombre: string
  categoria: CategoriaLinea
  activa: boolean
  /** true = el id de arriba es un id_linea real del backend (se puede usar
   * para crear un proyecto). Solo aplica a categoria "investigacion" — no
   * existe catálogo real para "medular" (linea_medular es texto libre). */
  sincronizada: boolean
}

const STORAGE_KEY = 'sgpvie_lineas_investigacion'

// Datos de ejemplo — semilla inicial, solo se usa la primera vez que se
// abre la app en este navegador (o si localStorage está vacío/corrupto).
const lineasSemilla: Linea[] = [
  { id: 1, nombre: 'Línea 1', categoria: 'investigacion', activa: true, sincronizada: false },
  { id: 2, nombre: 'Línea 2', categoria: 'investigacion', activa: true, sincronizada: false },
  { id: 3, nombre: 'Línea 3', categoria: 'investigacion', activa: true, sincronizada: false },
  { id: 4, nombre: 'Línea 4', categoria: 'investigacion', activa: true, sincronizada: false },
  { id: 5, nombre: 'Línea 5', categoria: 'investigacion', activa: true, sincronizada: false },
  { id: 6, nombre: 'Línea 6', categoria: 'investigacion', activa: true, sincronizada: false },
  { id: 7, nombre: 'Línea medular 1', categoria: 'medular', activa: true, sincronizada: false },
  { id: 8, nombre: 'Línea medular 2', categoria: 'medular', activa: true, sincronizada: false },
  { id: 9, nombre: 'Línea medular 3', categoria: 'medular', activa: true, sincronizada: false },
  { id: 10, nombre: 'Línea medular 4', categoria: 'medular', activa: true, sincronizada: false },
  { id: 11, nombre: 'Línea medular 5', categoria: 'medular', activa: true, sincronizada: false },
  { id: 12, nombre: 'Línea medular 6', categoria: 'medular', activa: true, sincronizada: false },
]

// ⚠️ MODO PRUEBA — mientras el backend no esté listo.
// Mismo patrón que los demás lib/*.ts: persistimos en localStorage para
// que los cambios sean visibles entre pestañas sin necesitar backend
// todavía. Cuando tu compañero tenga los endpoints reales (GET/POST/PUT/
// DELETE a /api/lineas-investigacion), se reemplaza cargarInicial()/
// guardar() por los fetch correspondientes.

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

/** Lo que debe ver el investigador al crear un proyecto: activas Y con id real. */
export function getLineasActivas(categoria: CategoriaLinea): Linea[] {
  return lineas.filter((l) => l.categoria === categoria && l.activa && l.sincronizada)
}

export function addLinea(nombre: string, categoria: CategoriaLinea, idReal?: number): void {
  lineas = [...lineas, { id: idReal ?? Date.now(), nombre, categoria, activa: true, sincronizada: idReal != null }]
  guardar(lineas)
}

/**
 * Empareja por nombre el id local con el id_linea real del backend —
 * "Líneas de investigación" sigue editando/desactivando/eliminando solo
 * en local, pero así lo que el investigador termina enviando al crear un
 * proyecto sí es un id real y válido. Solo aplica a categoria
 * "investigacion" (no hay catálogo real de líneas medulares todavía).
 */
export function sincronizarConBackend(lineasReales: { id_linea?: number; nombre: string }[]): void {
  const reales = lineasReales.filter((l) => l.id_linea != null)

  let cambio = false
  const actualizadas = lineas.map((linea) => {
    if (linea.categoria !== 'investigacion') return linea
    const real = reales.find((r) => r.nombre === linea.nombre)
    if (real && (real.id_linea !== linea.id || !linea.sincronizada)) {
      cambio = true
      return { ...linea, id: real.id_linea!, sincronizada: true }
    }
    return linea
  })

  const nombresConocidos = new Set(
    actualizadas.filter((l) => l.categoria === 'investigacion').map((l) => l.nombre)
  )
  const nuevas: Linea[] = reales
    .filter((r) => !nombresConocidos.has(r.nombre))
    .map((r) => ({ id: r.id_linea!, nombre: r.nombre, categoria: 'investigacion' as const, activa: true, sincronizada: true }))
  if (nuevas.length > 0) cambio = true

  if (cambio) {
    lineas = [...actualizadas, ...nuevas]
    guardar(lineas)
  }
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