export interface Convocatoria {
  id: number
  nombre: string
  activa: boolean
  proyectos: number
}

// Datos de ejemplo — mientras el backend no esté listo.
// Cuando tu compañero conecte el fetch real, este arreglo se reemplaza
// por datos que vengan del backend, manteniendo esta misma forma.
let convocatorias: Convocatoria[] = [
  { id: 1, nombre: 'Convocatoria 1', activa: false, proyectos: 14 },
  { id: 2, nombre: 'Convocatoria 2', activa: false, proyectos: 25 },
  { id: 3, nombre: 'Convocatoria 3', activa: false, proyectos: 22 },
  { id: 4, nombre: 'Convocatoria 4', activa: false, proyectos: 32 },
  { id: 5, nombre: 'Convocatoria 5', activa: true, proyectos: 17 },
]

export function getConvocatorias(): Convocatoria[] {
  return convocatorias
}

export function getConvocatoriaActiva(): Convocatoria | null {
  return convocatorias.find((c) => c.activa) ?? null
}

export function addConvocatoria(nombre: string): void {
  convocatorias = [
    ...convocatorias,
    { id: Date.now(), nombre, activa: false, proyectos: 0 },
  ]
}

// Solo una convocatoria puede estar activa a la vez —
// activarla desactiva automáticamente cualquier otra que lo estuviera.
export function toggleConvocatoria(id: number): void {
  convocatorias = convocatorias.map((c) =>
    c.id === id ? { ...c, activa: !c.activa } : { ...c, activa: false }
  )
}

export function incrementarProyectos(convocatoriaId: number): void {
  convocatorias = convocatorias.map((c) =>
    c.id === convocatoriaId ? { ...c, proyectos: c.proyectos + 1 } : c
  )
}