export interface Etapa {
  id: number
  nombre: string
  activa: boolean
}

const STORAGE_KEY = 'sgpvie_etapas'

// Datos de ejemplo — semilla inicial, solo se usa la primera vez que se
// abre la app en este navegador (o si localStorage está vacío/corrupto).
const etapasSemilla: Etapa[] = [
  { id: 1, nombre: 'Etapa documental', activa: true },
  { id: 2, nombre: 'Etapa comité de investigación', activa: true },
  { id: 3, nombre: 'Etapa comité de ética', activa: true },
  { id: 4, nombre: 'Etapa par evaluador', activa: true },
]

// ⚠️ MODO PRUEBA — mientras el backend no esté listo.
// Mismo patrón que los demás lib/*.ts: persistimos en localStorage para
// que los cambios sean visibles entre pestañas sin necesitar backend
// todavía. Cuando tu compañero tenga los endpoints reales (GET/POST/PUT/
// DELETE a /api/etapas), se reemplaza cargarInicial()/guardar() por los
// fetch correspondientes.

function cargarInicial(): Etapa[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Etapa[]
  } catch {
    // localStorage no disponible o datos corruptos — se usa la semilla
  }
  return etapasSemilla
}

function guardar(lista: Etapa[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
  }
}

let etapas: Etapa[] = cargarInicial()

export function getEtapas(): Etapa[] {
  return etapas
}

export function addEtapa(nombre: string): void {
  etapas = [...etapas, { id: Date.now(), nombre, activa: true }]
  guardar(etapas)
}

export function editarEtapa(id: number, nombre: string): void {
  etapas = etapas.map((e) => (e.id === id ? { ...e, nombre } : e))
  guardar(etapas)
}

export function eliminarEtapa(id: number): void {
  etapas = etapas.filter((e) => e.id !== id)
  guardar(etapas)
}

export function toggleEtapaActiva(id: number): void {
  etapas = etapas.map((e) => (e.id === id ? { ...e, activa: !e.activa } : e))
  guardar(etapas)
}