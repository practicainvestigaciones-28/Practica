export type CategoriaLinea = 'investigacion' | 'medular'

export interface Linea {
  id: number
  nombre: string
  categoria: CategoriaLinea
  activa: boolean

  sincronizada: boolean
}

const STORAGE_KEY = 'sgpvie_lineas_investigacion'

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

function cargarInicial(): Linea[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Linea[]
  } catch {

  }
  return lineasSemilla
}

function guardar(lista: Linea[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {

  }
}

let lineas: Linea[] = cargarInicial()

export function getLineas(): Linea[] {
  return lineas
}

export function getLineasActivas(categoria: CategoriaLinea): Linea[] {
  return lineas.filter((l) => l.categoria === categoria && l.activa && l.sincronizada)
}

export function addLinea(nombre: string, categoria: CategoriaLinea, idReal?: number): void {
  lineas = [...lineas, { id: idReal ?? Date.now(), nombre, categoria, activa: true, sincronizada: idReal != null }]
  guardar(lineas)
}

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