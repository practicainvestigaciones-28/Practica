import type { Estado } from './estado'

export interface ProyectoComiteEtica {
  id: number
  titulo: string
  investigadorPrincipal: string
  convocatoria: string
  facultad: string
  estado: Estado
  fechaEnvio: string
  fechaLimiteEvaluacion: string
  resumen: string
  anexos: string[]
  /** Si ya está asignado a este comité para revisión (vs. solo referido/en cola) */
  asignado: boolean
  comentario: string
}

const STORAGE_KEY = 'sgpvie_comite_etica'

// Datos de ejemplo — mientras el backend no esté listo.
const proyectosSemilla: ProyectoComiteEtica[] = [
  {
    id: 1,
    titulo: 'Proyecto 1',
    investigadorPrincipal: 'Investigador 1',
    convocatoria: 'Convocatoria 2025 - 1',
    facultad: 'Facultad X',
    estado: 'En revisión',
    fechaEnvio: '01/01/2026',
    fechaLimiteEvaluacion: '15/01/2026',
    resumen:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, ut convallis vulputate est vestibulum rhoncus facilisi, hac elementum arcu. Leo dictum a interdum. Semper metus rhoncus scelerisque ad himenaeos integer senectus primis consequat cubilia, nisl tincidunt nec pretium, nisi ante pellentesque ornare imperdiet aenean, rutrum facilisi nibh dictumst augue proin aliquet mollis felis.',
    anexos: ['Propuesta_proyecto_1.pdf', 'Consentimiento_informado.pdf'],
    asignado: true,
    comentario: '',
  },
  {
    id: 2,
    titulo: 'Proyecto 2',
    investigadorPrincipal: 'Investigador 2',
    convocatoria: 'Convocatoria 2025 - 1',
    facultad: 'Facultad X',
    estado: 'En revisión',
    fechaEnvio: '02/01/2026',
    fechaLimiteEvaluacion: '16/01/2026',
    resumen: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, ut convallis vulputate est vestibulum.',
    anexos: ['Propuesta_proyecto_2.pdf', 'Consentimiento_informado.pdf'],
    asignado: true,
    comentario: '',
  },
  {
    id: 3,
    titulo: 'Proyecto 3',
    investigadorPrincipal: 'Investigador 3',
    convocatoria: 'Convocatoria 2025 - 1',
    facultad: 'Facultad X',
    estado: 'Aprobado',
    fechaEnvio: '20/12/2025',
    fechaLimiteEvaluacion: '05/01/2026',
    resumen: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, ut convallis vulputate est vestibulum.',
    anexos: ['Propuesta_proyecto_3.pdf'],
    asignado: true,
    comentario: 'Proyecto aprobado sin observaciones.',
  },
  {
    id: 4,
    titulo: 'Proyecto 4',
    investigadorPrincipal: 'Investigador 4',
    convocatoria: 'Convocatoria 2025 - 1',
    facultad: 'Facultad X',
    estado: 'Rechazado',
    fechaEnvio: '18/12/2025',
    fechaLimiteEvaluacion: '02/01/2026',
    resumen: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, ut convallis vulputate est vestibulum.',
    anexos: ['Propuesta_proyecto_4.pdf'],
    asignado: true,
    comentario: 'No cumple con los requisitos éticos mínimos exigidos.',
  },
  {
    id: 5,
    titulo: 'Proyecto 5',
    investigadorPrincipal: 'Investigador 5',
    convocatoria: 'Convocatoria 2025 - 1',
    facultad: 'Facultad Y',
    estado: 'Pendiente',
    fechaEnvio: '03/01/2026',
    fechaLimiteEvaluacion: '17/01/2026',
    resumen: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, ut convallis vulputate est vestibulum.',
    anexos: ['Propuesta_proyecto_5.pdf', 'Aval_Grupo_Lider_Inv_5.pdf'],
    asignado: true,
    comentario: '',
  },
]

function cargarInicial(): ProyectoComiteEtica[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ProyectoComiteEtica[]
  } catch {
    // localStorage no disponible o datos corruptos — se usa la semilla
  }
  return proyectosSemilla
}

function guardar(lista: ProyectoComiteEtica[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
  }
}

let proyectos: ProyectoComiteEtica[] = cargarInicial()

export function getProyectosComiteEtica(): ProyectoComiteEtica[] {
  return proyectos
}

export function getProyectoComiteEtica(id: number): ProyectoComiteEtica | undefined {
  return proyectos.find((p) => p.id === id)
}

export function evaluarProyecto(id: number, nuevoEstado: Estado, comentario: string): void {
  proyectos = proyectos.map((p) => (p.id === id ? { ...p, estado: nuevoEstado, comentario } : p))
  guardar(proyectos)
}