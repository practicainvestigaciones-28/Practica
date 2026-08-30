export type EstadoReclamacion = 'Pendiente' | 'En revisión' | 'Resuelta'

export interface Reclamacion {
  id: number
  evaluacion: string
  reclamante: string
  respuesta: string
  fecha: string
  estado: EstadoReclamacion
}

// Datos de ejemplo — mientras el backend no esté listo.
// Cuando tu compañero conecte el fetch real, esta lista vendrá del
// backend con la misma forma. Los conteos de las tarjetas de arriba se
// calculan a partir de esta misma lista (ver Reclamaciones.tsx), así que
// no hay números sueltos hardcodeados en ningún otro lado.
const reclamacionesEjemplo: Reclamacion[] = [
  {
    id: 1,
    evaluacion: 'Comité de ética',
    reclamante: 'Juan Pérez',
    respuesta: 'Se notifica para completar anexo',
    fecha: '02/04/2026',
    estado: 'Pendiente',
  },
  {
    id: 2,
    evaluacion: 'Par evaluador',
    reclamante: 'Luis Pérez',
    respuesta: 'Ninguna',
    fecha: '02/04/2026',
    estado: 'En revisión',
  },
  {
    id: 3,
    evaluacion: 'Comité de investigación',
    reclamante: 'Milton Moreno',
    respuesta: 'Ninguna',
    fecha: '02/04/2026',
    estado: 'Resuelta',
  },
]

export function getReclamaciones(): Reclamacion[] {
  return reclamacionesEjemplo
}