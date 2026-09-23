export interface Periodo {
  id: number
  nombre: string
  activo: boolean

  sincronizado: boolean
}

const STORAGE_KEY = 'sgpvie_periodos'

const periodosSemilla: Periodo[] = [
  { id: 1, nombre: 'I', activo: true, sincronizado: false },
  { id: 2, nombre: 'II', activo: true, sincronizado: false },
  { id: 3, nombre: 'III', activo: true, sincronizado: false },
  { id: 4, nombre: 'IV', activo: true, sincronizado: false },
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

export function getPeriodosActivos(): Periodo[] {
  return periodos.filter((p) => p.activo && p.sincronizado)
}

export function addPeriodo(nombre: string, idReal?: number): void {
  periodos = [...periodos, { id: idReal ?? Date.now(), nombre, activo: true, sincronizado: idReal != null }]
  guardar(periodos)
}

export function sincronizarConBackend(periodosReales: { id_periodo?: number; nombre: string }[]): void {
  const reales = periodosReales.filter((p) => p.id_periodo != null)

  let cambio = false
  const actualizados = periodos.map((periodo) => {
    const real = reales.find((r) => r.nombre === periodo.nombre)
    if (real && (real.id_periodo !== periodo.id || !periodo.sincronizado)) {
      cambio = true
      return { ...periodo, id: real.id_periodo!, sincronizado: true }
    }
    return periodo
  })

  const nombresConocidos = new Set(actualizados.map((p) => p.nombre))
  const nuevos: Periodo[] = reales
    .filter((r) => !nombresConocidos.has(r.nombre))
    .map((r) => ({ id: r.id_periodo!, nombre: r.nombre, activo: true, sincronizado: true }))
  if (nuevos.length > 0) cambio = true

  if (cambio) {
    periodos = [...actualizados, ...nuevos]
    guardar(periodos)
  }
}

export function extraerNumeroDePeriodo(nombre: string): number | null {
  const texto = nombre.trim()
  if (!texto) return null

  const digitos = texto.match(/\d+/)
  if (digitos) return Number(digitos[0])

  const ultimaPalabra = texto.toUpperCase().split(/\s+/).pop() ?? ''
  const valores: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  if (ultimaPalabra.length === 0 || ![...ultimaPalabra].every((c) => c in valores)) return null

  let total = 0
  for (let i = 0; i < ultimaPalabra.length; i++) {
    const actual = valores[ultimaPalabra[i]]
    const siguiente = valores[ultimaPalabra[i + 1]]
    total += siguiente && actual < siguiente ? -actual : actual
  }
  return total > 0 ? total : null
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