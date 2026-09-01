export interface Etapa {
  id: number
  nombre: string
  activa: boolean
}

const STORAGE_KEY = 'sgpvie_etapas'


const etapasSemilla: Etapa[] = [
  { id: 1, nombre: 'Etapa documental', activa: true },
  { id: 2, nombre: 'Etapa comité de investigación', activa: true },
  { id: 3, nombre: 'Etapa comité de ética', activa: true },
  { id: 4, nombre: 'Etapa par evaluador', activa: true },
]

function cargarInicial(): Etapa[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Etapa[]
  } catch {

  }
  return etapasSemilla
}

function guardar(lista: Etapa[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {

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