// "Componente ético" e "Implicaciones éticas" se fusionaron en un solo campo (componente_etico). Los proyectos
// registrados antes pueden tener texto en implicaciones_eticas: se muestra a continuación del componente ético
// para no perderlo.

/** Instrucción que antes correspondía a "Implicaciones éticas" y ahora va dentro del Componente ético. */
export const INSTRUCCION_IMPLICACIONES =
  '(Explicar la responsabilidad, el alcance y el impacto desde el punto de vista ético, en el desarrollo del proyecto)'

/** Componente ético completo: el campo actual más lo que haya quedado en implicaciones_eticas de antes. */
export function textoComponenteEtico(p: { componente_etico: string | null; implicaciones_eticas?: string | null }): string {
  const componente = p.componente_etico?.trim() ?? ''
  const implicaciones = p.implicaciones_eticas?.trim() ?? ''
  if (!implicaciones || componente.includes(implicaciones)) return componente
  return [componente, implicaciones].filter(Boolean).join('\n\n')
}
