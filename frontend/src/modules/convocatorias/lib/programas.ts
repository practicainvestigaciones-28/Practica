export type TipoPrograma = 'pregrado' | 'posgrado'

export interface Programa {
  id: number
  nombre: string
  tipo: TipoPrograma
  activo: boolean

  sincronizado: boolean
}

const STORAGE_KEY = 'sgpvie_programas'

const programasSemilla: Programa[] = [
  { id: 1, nombre: 'Programa 1', tipo: 'pregrado', activo: true, sincronizado: false },
  { id: 2, nombre: 'Programa 2', tipo: 'pregrado', activo: true, sincronizado: false },
  { id: 3, nombre: 'Programa 3', tipo: 'pregrado', activo: true, sincronizado: false },
  { id: 4, nombre: 'Programa 1', tipo: 'posgrado', activo: true, sincronizado: false },
  { id: 5, nombre: 'Programa 2', tipo: 'posgrado', activo: true, sincronizado: false },
  { id: 6, nombre: 'Programa 3', tipo: 'posgrado', activo: true, sincronizado: false },
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

export function getProgramasActivos(): Programa[] {
  return programas.filter((p) => p.activo && p.sincronizado)
}

export function addPrograma(nombre: string, tipo: TipoPrograma, idReal?: number): void {
  programas = [...programas, { id: idReal ?? Date.now(), nombre, tipo, activo: true, sincronizado: idReal != null }]
  guardar(programas)
}

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