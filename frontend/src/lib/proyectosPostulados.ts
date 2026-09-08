import type { Estado } from './estado'

export type EstadoDocumento = 'pendiente' | 'aprobado' | 'rechazado'

export interface DocumentoRevision {
  id: number
  nombre: string
  estado: EstadoDocumento
}

export interface ProyectoPostulado {
  id: number
  titulo: string
  investigador: string
  estado: Estado
  fechaEnvio: string
  fechaLimiteRevision: string
  documentos: DocumentoRevision[]
}

const STORAGE_KEY = 'sgpvie_proyectos_postulados'

// Datos de ejemplo — semilla inicial, solo se usa la primera vez que se
// abre la app en este navegador (o si localStorage está vacío/corrupto).
const postuladosSemilla: ProyectoPostulado[] = [1, 2, 3, 4].map((n) => ({
  id: n,
  titulo: `Proyecto ${n}`,
  investigador: `Investigador ${n}`,
  estado: 'En revisión',
  fechaEnvio: '01/01/2026',
  fechaLimiteRevision: '15/01/2026',
  documentos: [
    { id: 1, nombre: `Propuesta_proyecto_${n}.pdf`, estado: 'pendiente' },
    { id: 2, nombre: `Asentimiento_Informado_${n}.pdf`, estado: 'pendiente' },
    { id: 3, nombre: `Aval_Grupo_Lider_Inv_${n}.pdf`, estado: 'pendiente' },
    { id: 4, nombre: 'Acta_compromiso_estudiantes.pdf', estado: 'pendiente' },
    { id: 5, nombre: 'Consentimiento_informado.pdf', estado: 'pendiente' },
  ],
}))

// ⚠️ MODO PRUEBA — mientras el backend no esté listo.
// No se encontró ningún endpoint de revisión/aprobación de documentos por
// proyecto durante la auditoría del backend (api/documentos.ts solo tiene
// cargarDocumentoProyecto, que sube un archivo, no lo revisa). Mismo
// patrón que los demás lib/*.ts: persistimos en localStorage para que los
// cambios sobrevivan entre pestañas y recargas.

function cargarInicial(): ProyectoPostulado[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ProyectoPostulado[]
  } catch {
    // localStorage no disponible o datos corruptos — se usa la semilla
  }
  return postuladosSemilla
}

function guardar(lista: ProyectoPostulado[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
  }
}

let postulados: ProyectoPostulado[] = cargarInicial()

export function getProyectosPostulados(): ProyectoPostulado[] {
  return postulados
}

export function getProyectoPostulado(id: number): ProyectoPostulado | undefined {
  return postulados.find((p) => p.id === id)
}

export function cambiarEstadoDocumento(
  proyectoId: number,
  documentoId: number,
  estado: EstadoDocumento
): void {
  postulados = postulados.map((p) =>
    p.id !== proyectoId
      ? p
      : {
          ...p,
          documentos: p.documentos.map((d) => (d.id === documentoId ? { ...d, estado } : d)),
        }
  )
  guardar(postulados)
}

export function aprobarTodosLosDocumentos(proyectoId: number): void {
  postulados = postulados.map((p) =>
    p.id !== proyectoId
      ? p
      : { ...p, documentos: p.documentos.map((d) => ({ ...d, estado: 'aprobado' as const })) }
  )
  guardar(postulados)
}