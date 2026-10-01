import * as evaluacionesApi from '../api/evaluaciones'
import { mapearEstado, type Estado } from '../../../shared/lib/estado'

/**
 * Un proyecto en la bandeja de trabajo del usuario logueado para una etapa en
 * particular (Comité de Investigación, Comité de Ética o Par Evaluador). El
 * backend es genérico por etapa: /evaluaciones/asignaciones?mias=true filtra
 * por el usuario del token, pero si el mismo usuario tiene asignaciones en
 * más de una etapa (p. ej. integra dos comités), hay que indicar id_etapa
 * para no mezclar en una pantalla proyectos de otra etapa.
 */
export interface ProyectoEnRevision {
  id_asignacion: number
  id_proyecto: number
  id_etapa: number
  titulo: string
  investigadorPrincipal: string
  convocatoria: string
  estado: Estado
  fechaEnvio: string
  fechaLimiteEvaluacion: string | null
  /** true = todavía no se registró un resultado para esta etapa (bandeja de pendientes). */
  abierta: boolean
  /** Solo tiene valor cuando la asignación ya se cerró (aprobado / aprobado_con_correcciones / rechazado / no_cumple). */
  resultadoFinal: string | null
  /** Resumen (checklist + observaciones) que dejó quien evaluó esta etapa, si ya se cerró. */
  comentariosEvaluacion: string | null
  /** Plazo para que el investigador reenvíe correcciones, si el resultado fue "aprobado_con_correcciones". */
  fechaLimiteCorreccion: string | null
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Carga la bandeja del integrante de comité logueado. Para las asignaciones
 * ya cerradas se consulta el estado consolidado del proyecto para saber si
 * el resultado real fue aprobado, con correcciones o rechazado —
 * AsignacionRevision.estado no se actualiza al cerrar, solo queda el
 * histórico en EvaluacionEtapa (ver evaluaciones.service.ts).
 */
export async function cargarProyectosAsignados(id_etapa?: number): Promise<ProyectoEnRevision[]> {
  const asignaciones = await evaluacionesApi.listarAsignaciones({ mias: true, id_etapa })

  return Promise.all(
    asignaciones.map(async (a) => {
      let resultadoFinal: string | null = null
      let comentariosEvaluacion: string | null = null
      let fechaLimiteCorreccion: string | null = null

      if (a.fecha_finalizacion) {
        try {
          const consolidado = await evaluacionesApi.obtenerEstadoConsolidado(a.id_proyecto)
          const evaluada = consolidado.etapas_evaluadas.find((e) => e.etapa.id_etapa === a.id_etapa)
          resultadoFinal = evaluada?.resultado.nombre ?? null
          comentariosEvaluacion = evaluada?.comentarios ?? null
          fechaLimiteCorreccion = evaluada?.fecha_limite_correccion ?? null
        } catch {
          resultadoFinal = null
        }
      }

      return {
        id_asignacion: a.id_asignacion,
        id_proyecto: a.id_proyecto,
        id_etapa: a.id_etapa,
        titulo: a.proyecto.titulo,
        investigadorPrincipal: `${a.proyecto.creador.nombre} ${a.proyecto.creador.apellido}`,
        convocatoria: a.proyecto.convocatoria?.nombre ?? '—',
        estado: mapearEstado(resultadoFinal ?? a.estado.nombre),
        fechaEnvio: formatearFecha(a.fecha_asignacion),
        fechaLimiteEvaluacion: a.fecha_limite ? formatearFecha(a.fecha_limite) : null,
        abierta: a.fecha_finalizacion === null,
        resultadoFinal,
        comentariosEvaluacion,
        fechaLimiteCorreccion: fechaLimiteCorreccion ? formatearFecha(fechaLimiteCorreccion) : null,
      }
    })
  )
}
