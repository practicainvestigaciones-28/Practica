// Checklist de verificación para Comité de Investigación y Comité de Ética.
// Genérico por ahora (no hay todavía un documento institucional con los
// criterios oficiales de cada comité, a diferencia de la rúbrica de Par
// Evaluador — ver parEvaluador.ts): sirve de punto de partida y se puede
// ajustar más adelante sin tocar el resto de la pantalla.
//
// El backend no tiene un campo para un checklist estructurado (solo guarda
// resultado + comentarios + puntaje, ver evaluaciones.service.ts), así que
// igual que la rúbrica del par evaluador, el detalle se combina en el mismo
// texto de comentarios al guardar (ver construirComentarioChecklist).

export interface ItemChecklist {
  id: number
  texto: string
}

export const checklistInvestigacion: ItemChecklist[] = [
  { id: 1, texto: 'El proyecto sigue el formato oficial de presentación.' },
  { id: 2, texto: 'Los objetivos son coherentes con el planteamiento del problema.' },
  { id: 3, texto: 'La metodología propuesta es coherente con los objetivos.' },
  { id: 4, texto: 'El cronograma de actividades es realista.' },
  { id: 5, texto: 'Tiene todos los anexos y documentos obligatorios.' },
]

// Basado en lo que ya pide el formato oficial en su sección de Componente
// Ético (consentimiento informado, asentimiento informado, riesgo a personas
// y al medio ambiente).
export const checklistEtica: ItemChecklist[] = [
  { id: 1, texto: 'Indica si va a utilizar consentimiento informado.' },
  { id: 2, texto: 'Indica si va a utilizar asentimiento informado (menores de edad).' },
  { id: 3, texto: 'No se identifican riesgos para las personas participantes.' },
  { id: 4, texto: 'No se identifican riesgos para el medio ambiente.' },
  { id: 5, texto: 'El componente ético está debidamente justificado.' },
]

/** Arma el checklist marcado como un bloque de texto, para anteponerlo al comentario libre del evaluador. */
export function construirComentarioChecklist(items: ItemChecklist[], marcados: Set<number>, comentario: string): string {
  const lineas = items.map((item) => `${marcados.has(item.id) ? '✓' : '✗'} ${item.texto}`)
  const bloqueChecklist = ['Checklist de verificación:', ...lineas].join('\n')
  return comentario.trim() ? `${bloqueChecklist}\n\n${comentario.trim()}` : bloqueChecklist
}
