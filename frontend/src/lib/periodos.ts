export interface Periodo {
  id: number
  nombre: string
  activo: boolean
  /** true = el id de arriba es un id_periodo real del backend (se puede
   * usar para crear un proyecto/cronograma). false = todavía no tiene
   * contraparte real — no se le debe mostrar al investigador. */
  sincronizado: boolean
}

const STORAGE_KEY = 'sgpvie_periodos'

// Datos de ejemplo — semilla inicial, solo se usa la primera vez que se
// abre la app en este navegador (o si localStorage está vacío/corrupto).
const periodosSemilla: Periodo[] = [
  { id: 1, nombre: 'I', activo: true, sincronizado: false },
  { id: 2, nombre: 'II', activo: true, sincronizado: false },
  { id: 3, nombre: 'III', activo: true, sincronizado: false },
  { id: 4, nombre: 'IV', activo: true, sincronizado: false },
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

/** Lo que debe ver el investigador al crear un proyecto: activos Y con id real. */
export function getPeriodosActivos(): Periodo[] {
  return periodos.filter((p) => p.activo && p.sincronizado)
}

export function addPeriodo(nombre: string, idReal?: number): void {
  periodos = [...periodos, { id: idReal ?? Date.now(), nombre, activo: true, sincronizado: idReal != null }]
  guardar(periodos)
}

/**
 * Empareja por nombre el id local con el id_periodo real del backend —
 * esta pantalla sigue editando/desactivando/eliminando en local (sin
 * endpoints reales para eso todavía), pero así lo que el investigador
 * termina enviando sí es un id real y válido. Lo que el backend ya tenía
 * y esta lista no conocía se agrega también (activo).
 */
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

/**
 * Extrae el número de un nombre de período, sin importar si el admin lo
 * escribió en arábigo ("2", "Periodo 2") o en romano ("II", "Periodo II")
 * — para mostrárselo siempre en números al investigador.
 */
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