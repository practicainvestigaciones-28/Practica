export type TipoPrograma = 'pregrado' | 'posgrado'

export interface Programa {
  id: number
  nombre: string
  tipo: TipoPrograma
  activo: boolean
  /** true = el id de arriba es un id_programa real del backend (se puede
   * usar para crear un proyecto). false = todavía no tiene contraparte
   * real — no se le debe mostrar al investigador. */
  sincronizado: boolean
}

const STORAGE_KEY = 'sgpvie_programas'

// Datos de ejemplo — semilla inicial, solo se usa la primera vez que se
// abre la app en este navegador (o si localStorage está vacío/corrupto).
const programasSemilla: Programa[] = [
  { id: 1, nombre: 'Programa 1', tipo: 'pregrado', activo: true, sincronizado: false },
  { id: 2, nombre: 'Programa 2', tipo: 'pregrado', activo: true, sincronizado: false },
  { id: 3, nombre: 'Programa 3', tipo: 'pregrado', activo: true, sincronizado: false },
  { id: 4, nombre: 'Programa 1', tipo: 'posgrado', activo: true, sincronizado: false },
  { id: 5, nombre: 'Programa 2', tipo: 'posgrado', activo: true, sincronizado: false },
  { id: 6, nombre: 'Programa 3', tipo: 'posgrado', activo: true, sincronizado: false },
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

/** Lo que debe ver el investigador al crear un proyecto: activos Y con id real. */
export function getProgramasActivos(): Programa[] {
  return programas.filter((p) => p.activo && p.sincronizado)
}

export function addPrograma(nombre: string, tipo: TipoPrograma, idReal?: number): void {
  programas = [...programas, { id: idReal ?? Date.now(), nombre, tipo, activo: true, sincronizado: idReal != null }]
  guardar(programas)
}

/**
 * Empareja por nombre+tipo el id local con el id_programa real del
 * backend — esta pantalla sigue editando/desactivando/eliminando en local
 * (sin endpoints reales para eso todavía), pero así lo que el investigador
 * termina enviando al crear un proyecto sí es un id real y válido. Lo que
 * el backend ya tenía y esta lista no conocía se agrega también (activo).
 */
export function sincronizarConBackend(
  programasReales: { id_programa?: number; nombre: string; tipoPrograma?: { nombre: string } }[]
): void {
  const reales = programasReales
    .filter((p) => p.id_programa != null && (p.tipoPrograma?.nombre === 'pregrado' || p.tipoPrograma?.nombre === 'posgrado'))
    .map((p) => ({ id: p.id_programa!, nombre: p.nombre, tipo: p.tipoPrograma!.nombre as TipoPrograma }))

  let cambio = false
  const actualizados = programas.map((prog) => {
    const real = reales.find((r) => r.nombre === prog.nombre && r.tipo === prog.tipo)
    if (real && (real.id !== prog.id || !prog.sincronizado)) {
      cambio = true
      return { ...prog, id: real.id, sincronizado: true }
    }
    return prog
  })

  const conocidos = new Set(actualizados.map((p) => `${p.tipo}:${p.nombre}`))
  const nuevos: Programa[] = reales
    .filter((r) => !conocidos.has(`${r.tipo}:${r.nombre}`))
    .map((r) => ({ id: r.id, nombre: r.nombre, tipo: r.tipo, activo: true, sincronizado: true }))
  if (nuevos.length > 0) cambio = true

  if (cambio) {
    programas = [...actualizados, ...nuevos]
    guardar(programas)
  }
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