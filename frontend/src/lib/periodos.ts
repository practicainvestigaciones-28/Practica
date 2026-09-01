export interface Periodo {
  id: number
  nombre: string
  activo: boolean
}

const STORAGE_KEY = 'sgpvie_periodos'

const periodosSemilla: Periodo[] = [
  { id: 1, nombre: 'I', activo: true },
  { id: 2, nombre: 'II', activo: true },
  { id: 3, nombre: 'III', activo: true },
  { id: 4, nombre: 'IV', activo: true },
]


function cargarInicial(): Periodo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Periodo[]
  } catch {

  }
  return periodosSemilla
}

function guardar(lista: Periodo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {

  }
}

let periodos: Periodo[] = cargarInicial()

export function getPeriodos(): Periodo[] {
  return periodos
}

export function addPeriodo(nombre: string): void {
  periodos = [...periodos, { id: Date.now(), nombre, activo: true }]
  guardar(periodos)
}

export function editarPeriodo(id: number, nombre: string): void {
  periodos = periodos.map((p) => (p.id === id ? { ...p, nombre } : p))
  guardar(periodos)
}

export function eliminarPeriodo(id: number): void {
  periodos = periodos.filter((p) => p.id !== id)
  guardar(periodos)
}

export function togglePeriodoActivo(id: number): void {
  periodos = periodos.map((p) => (p.id === id ? { ...p, activo: !p.activo } : p))
  guardar(periodos)
}