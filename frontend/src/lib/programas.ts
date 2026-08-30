export type TipoPrograma = 'pregrado' | 'posgrado'

export interface Programa {
  id: number
  nombre: string
  tipo: TipoPrograma
  activo: boolean
}

const STORAGE_KEY = 'sgpvie_programas'

// Datos de ejemplo — semilla inicial, solo se usa la primera vez que se
// abre la app en este navegador (o si localStorage está vacío/corrupto).
const programasSemilla: Programa[] = [
  { id: 1, nombre: 'Programa 1', tipo: 'pregrado', activo: true },
  { id: 2, nombre: 'Programa 2', tipo: 'pregrado', activo: true },
  { id: 3, nombre: 'Programa 3', tipo: 'pregrado', activo: false },
  { id: 4, nombre: 'Programa 1', tipo: 'posgrado', activo: true },
  { id: 5, nombre: 'Programa 2', tipo: 'posgrado', activo: true },
  { id: 6, nombre: 'Programa 3', tipo: 'posgrado', activo: false },
]

// ⚠️ MODO PRUEBA — mientras el backend no esté listo.
// Mismo patrón que los demás lib/*.ts: persistimos en localStorage para
// que los cambios sean visibles entre pestañas sin necesitar backend
// todavía. Cuando tu compañero tenga los endpoints reales (GET/POST/PUT/
// DELETE a /api/programas), se reemplaza cargarInicial()/guardar() por
// los fetch correspondientes.

function cargarInicial(): Programa[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Programa[]
  } catch {
    // localStorage no disponible o datos corruptos — se usa la semilla
  }
  return programasSemilla
}

function guardar(lista: Programa[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
  }
}

let programas: Programa[] = cargarInicial()

export function getProgramas(): Programa[] {
  return programas
}

export function addPrograma(nombre: string, tipo: TipoPrograma): void {
  programas = [...programas, { id: Date.now(), nombre, tipo, activo: true }]
  guardar(programas)
}

export function editarPrograma(id: number, nombre: string): void {
  programas = programas.map((p) => (p.id === id ? { ...p, nombre } : p))
  guardar(programas)
}

export function eliminarPrograma(id: number): void {
  programas = programas.filter((p) => p.id !== id)
  guardar(programas)
}

export function toggleProgramaActivo(id: number): void {
  programas = programas.map((p) => (p.id === id ? { ...p, activo: !p.activo } : p))
  guardar(programas)
}