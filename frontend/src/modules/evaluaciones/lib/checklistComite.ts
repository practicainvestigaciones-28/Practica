// Checklist de verificación para Comité de Investigación y Comité de Ética,
// digitalizado a partir de los formatos institucionales oficiales:
// - Comité de Investigación: INV-IC-FR-009 (Lista de chequeo convocatoria de investigación)
// - Comité de Ética:         INV-IC-FR-020 (Lista de chequeo Comité de Ética en investigación)
//
// El backend no tiene un campo para un checklist estructurado (solo guarda
// resultado + comentarios + puntaje, ver evaluaciones.service.ts), así que el
// detalle diligenciado (SI/NO + observación por ítem, y lo adicional de cada
// formato) se combina en el mismo texto de comentarios al guardar — ver
// construirBloqueChecklist más abajo.

export interface ItemChecklist {
  id: number
  texto: string
}

/** INV-IC-FR-009 — orden y numeración tal como aparecen en el formato oficial. */
export const checklistInvestigacion: ItemChecklist[] = [
  { id: 1, texto: '1. Datos Generales' },
  { id: 2, texto: '2. Información general del grupo de investigación al cual está adscrito el proyecto (interno y/o externo)' },
  { id: 3, texto: '3. Resumen' },
  { id: 4, texto: '4.1. Planteamiento del problema' },
  { id: 5, texto: '4.2. Justificación' },
  { id: 6, texto: '4.3. Objetivos' },
  { id: 7, texto: '4.4. Antecedentes' },
  { id: 8, texto: '4.5. Marco teórico (preliminar)' },
  { id: 9, texto: '4.6. Metodología propuesta' },
  { id: 10, texto: '4.7. Impacto' },
  { id: 11, texto: '4.8. Indicadores' },
  { id: 12, texto: '4.9. Cronograma de actividades' },
  { id: 13, texto: '4.10. Resultados esperados' },
  { id: 14, texto: '5. Presupuesto' },
  { id: 15, texto: '6. Referencias' },
  { id: 16, texto: 'Carta Aval grupo de investigación' },
  { id: 17, texto: 'Acta de compromiso de estudiante(s) firmada ya sea como auxiliares / asistentes' },
  { id: 18, texto: 'Carta(s) de intención firmada por el representante legal o su delegado en la Universidad o entidad' },
  { id: 19, texto: 'Solicitud de evaluación a comité de ética en investigación' },
  { id: 20, texto: 'Consentimiento informado' },
  { id: 21, texto: 'Asentimiento informado' },
]

/** INV-IC-FR-020 — orden y numeración tal como aparecen en el formato oficial. */
export const checklistEtica: ItemChecklist[] = [
  { id: 1, texto: '1. Información General del Proyecto' },
  { id: 2, texto: '2. Objetivos (General y Específicos)' },
  { id: 3, texto: '3. Resumen' },
  { id: 4, texto: '4. Implicaciones Éticas' },
  { id: 5, texto: '5. Consentimiento Informado' },
  { id: 6, texto: '6. Asentimiento Informado' },
  { id: 7, texto: '7. Fuentes de Financiación (quien aporta los recursos)' },
  { id: 8, texto: '8. Permisos o Licencias Pertinentes (si son necesarias cuáles serían)' },
]

export type Cumple = 'si' | 'no' | null

export interface RespuestaChecklist {
  cumple: Cumple
  observaciones: string
}

export type RespuestasChecklist = Record<number, RespuestaChecklist>

export const respuestaVacia = (): RespuestaChecklist => ({ cumple: null, observaciones: '' })

/** true si CADA ítem del checklist quedó marcado SI (ninguno en NO ni sin marcar). */
export function todosCumplenSi(items: ItemChecklist[], respuestas: RespuestasChecklist): boolean {
  return items.every((item) => respuestas[item.id]?.cumple === 'si')
}

/** Arma el checklist diligenciado (SI/NO + observación de cada ítem) como bloque de texto legible. */
export function construirBloqueChecklist(titulo: string, items: ItemChecklist[], respuestas: RespuestasChecklist): string {
  const lineas = items.map((item) => {
    const r = respuestas[item.id]
    const marca = r?.cumple === 'si' ? 'SI' : r?.cumple === 'no' ? 'NO' : 'Sin marcar'
    const obs = r?.observaciones.trim()
    return `- ${item.texto}: ${marca}${obs ? ` — ${obs}` : ''}`
  })
  return [titulo, ...lineas].join('\n')
}
