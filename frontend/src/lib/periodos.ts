export interface Periodo {
  id: number
  nombre: string
  activo: boolean
}

const STORAGE_KEY = 'sgpvie_periodos'

// Datos de ejemplo — semilla inicial, solo se usa la primera vez que se
// abre la app en este navegador (o si localStorage está vacío/corrupto).
const periodosSemilla: Periodo[] = [
  { id: 1, nombre: 'I', activo: true },
  { id: 2, nombre: 'II', activo: true },
  { id: 3, nombre: 'III', activo: true },
  { id: 4, nombre: 'IV', activo: true },
]

// ⚠️ MODO PRUEBA — mientras el backend no esté listo.
// Mismo patrón que lib/convocatorias.ts y lib/roles.ts: persistimos en
// localStorage (compartido entre pestañas del mismo navegador) para que
// los cambios sean visibles sin necesitar backend todavía. Cuando tu
// compañero tenga los endpoints reales (GET/POST/PUT a /api/periodos),
// se reemplaza cargarInicial()/guardar() por los fetch correspondientes.

function cargarInicial(): Periodo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Periodo[]
  } catch {
    // localStorage no disponible o datos corruptos — se usa la semilla
  }
  return periodosSemilla
}

function guardar(lista: Periodo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
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