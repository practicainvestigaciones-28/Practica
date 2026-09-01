export interface Convocatoria {
  id: number
  nombre: string
  activa: boolean
  proyectos: number
  vigenciaInicio: Date | null
  vigenciaFin: Date | null
}

const STORAGE_KEY = 'sgpvie_convocatorias'

// Datos de ejemplo — semilla inicial, solo se usa la primera vez que se
// abre la app en este navegador (o si localStorage está vacío/corrupto).
const convocatoriasSemilla: Convocatoria[] = [
  { id: 1, nombre: 'Convocatoria 1', activa: false, proyectos: 14, vigenciaInicio: null, vigenciaFin: null },
  { id: 2, nombre: 'Convocatoria 2', activa: false, proyectos: 25, vigenciaInicio: null, vigenciaFin: null },
  { id: 3, nombre: 'Convocatoria 3', activa: false, proyectos: 22, vigenciaInicio: null, vigenciaFin: null },
  { id: 4, nombre: 'Convocatoria 4', activa: false, proyectos: 32, vigenciaInicio: null, vigenciaFin: null },
  { id: 5, nombre: 'Convocatoria 5', activa: true, proyectos: 17, vigenciaInicio: null, vigenciaFin: null },
]


interface ConvocatoriaSerializada extends Omit<Convocatoria, 'vigenciaInicio' | 'vigenciaFin'> {
  vigenciaInicio: string | null
  vigenciaFin: string | null
}

function serializar(lista: Convocatoria[]): string {
  const data: ConvocatoriaSerializada[] = lista.map((c) => ({
    ...c,
    vigenciaInicio: c.vigenciaInicio ? c.vigenciaInicio.toISOString() : null,
    vigenciaFin: c.vigenciaFin ? c.vigenciaFin.toISOString() : null,
  }))
  return JSON.stringify(data)
}

function deserializar(raw: string): Convocatoria[] {
  const data = JSON.parse(raw) as ConvocatoriaSerializada[]
  return data.map((c) => ({
    ...c,
    vigenciaInicio: c.vigenciaInicio ? new Date(c.vigenciaInicio) : null,
    vigenciaFin: c.vigenciaFin ? new Date(c.vigenciaFin) : null,
  }))
}

function cargarInicial(): Convocatoria[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return deserializar(raw)
  } catch {

  }
  return convocatoriasSemilla
}

function guardar(lista: Convocatoria[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializar(lista))
  } catch {

  }
}

let convocatorias: Convocatoria[] = cargarInicial()

export function getConvocatorias(): Convocatoria[] {
  return convocatorias
}

export function getConvocatoriaActiva(): Convocatoria | null {
  return convocatorias.find((c) => c.activa) ?? null
}

export function addConvocatoria(nombre: string, vigenciaInicio: Date | null, vigenciaFin: Date | null): void {
  convocatorias = [
    ...convocatorias,
    { id: Date.now(), nombre, activa: false, proyectos: 0, vigenciaInicio, vigenciaFin },
  ]
  guardar(convocatorias)
}

export function editarConvocatoria(
  id: number,
  nombre: string,
  vigenciaInicio: Date | null,
  vigenciaFin: Date | null
): void {
  convocatorias = convocatorias.map((c) =>
    c.id === id ? { ...c, nombre, vigenciaInicio, vigenciaFin } : c
  )
  guardar(convocatorias)
}

export function eliminarConvocatoria(id: number): void {
  convocatorias = convocatorias.filter((c) => c.id !== id)
  guardar(convocatorias)
}

export function toggleConvocatoria(id: number): void {
  convocatorias = convocatorias.map((c) =>
    c.id === id ? { ...c, activa: !c.activa } : { ...c, activa: false }
  )
  guardar(convocatorias)
}

export function incrementarProyectos(convocatoriaId: number): void {
  convocatorias = convocatorias.map((c) =>
    c.id === convocatoriaId ? { ...c, proyectos: c.proyectos + 1 } : c
  )
  guardar(convocatorias)
}