export type TipoPrograma = 'pregrado' | 'posgrado'

export interface Programa {
  id: number
  nombre: string
  tipo: TipoPrograma
  activo: boolean
}

const STORAGE_KEY = 'sgpvie_programas'


const programasSemilla: Programa[] = [
  { id: 1, nombre: 'Programa 1', tipo: 'pregrado', activo: true },
  { id: 2, nombre: 'Programa 2', tipo: 'pregrado', activo: true },
  { id: 3, nombre: 'Programa 3', tipo: 'pregrado', activo: false },
  { id: 4, nombre: 'Programa 1', tipo: 'posgrado', activo: true },
  { id: 5, nombre: 'Programa 2', tipo: 'posgrado', activo: true },
  { id: 6, nombre: 'Programa 3', tipo: 'posgrado', activo: false },
]


function cargarInicial(): Programa[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Programa[]
  } catch {

  }
  return programasSemilla
}

function guardar(lista: Programa[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {

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