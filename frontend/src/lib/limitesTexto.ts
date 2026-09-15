
export type ClaveLimiteTexto =
  | 'resumen'
  | 'planteamientoProblema'
  | 'preguntaInvestigacion'
  | 'justificacion'
  | 'objetivoGeneral'
  | 'objetivoEspecifico'
  | 'antecedente'
  | 'referencia'
  | 'marcoTeorico'
  | 'metodologia'
  | 'componenteEtico'
  | 'funcionesEstudiante'

export interface LimiteTextoInfo {
  clave: ClaveLimiteTexto
  etiqueta: string
  maxPalabras: number
}

const STORAGE_KEY = 'sgpvie_limites_texto'
const STORAGE_KEY_ANTECEDENTES = 'sgpvie_limite_antecedentes'

const limitesSemilla: Record<ClaveLimiteTexto, LimiteTextoInfo> = {
  resumen: { clave: 'resumen', etiqueta: 'Resumen', maxPalabras: 200 },
  planteamientoProblema: {
    clave: 'planteamientoProblema',
    etiqueta: 'Planteamiento del problema',
    maxPalabras: 600,
  },
  preguntaInvestigacion: {
    clave: 'preguntaInvestigacion',
    etiqueta: 'Pregunta de investigación',
    maxPalabras: 100,
  },
  justificacion: { clave: 'justificacion', etiqueta: 'Justificación', maxPalabras: 500 },
  objetivoGeneral: { clave: 'objetivoGeneral', etiqueta: 'Objetivo general', maxPalabras: 150 },
  objetivoEspecifico: {
    clave: 'objetivoEspecifico',
    etiqueta: 'Objetivo específico (cada uno)',
    maxPalabras: 100,
  },
  antecedente: { clave: 'antecedente', etiqueta: 'Antecedente (cada uno)', maxPalabras: 150 },
  referencia: { clave: 'referencia', etiqueta: 'Referencia (cada una)', maxPalabras: 60 },
  marcoTeorico: { clave: 'marcoTeorico', etiqueta: 'Marco teórico preliminar', maxPalabras: 2000 },
  metodologia: { clave: 'metodologia', etiqueta: 'Metodología preliminar propuesta', maxPalabras: 500 },
  componenteEtico: { clave: 'componenteEtico', etiqueta: 'Componente ético', maxPalabras: 500 },
  funcionesEstudiante: {
    clave: 'funcionesEstudiante',
    etiqueta: 'Funciones del estudiante auxiliar/asistente',
    maxPalabras: 500,
  },
}

function cargarInicial(): Record<ClaveLimiteTexto, LimiteTextoInfo> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...limitesSemilla, ...(JSON.parse(raw) as Record<ClaveLimiteTexto, LimiteTextoInfo>) }
  } catch {

  }
  return limitesSemilla
}

function guardar(valores: Record<ClaveLimiteTexto, LimiteTextoInfo>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valores))
  } catch {

  }
}

let limites = cargarInicial()

export function getLimites(): LimiteTextoInfo[] {
  return Object.values(limites)
}

export function getLimite(clave: ClaveLimiteTexto): number {
  return limites[clave]?.maxPalabras ?? limitesSemilla[clave].maxPalabras
}

export function setLimite(clave: ClaveLimiteTexto, maxPalabras: number): void {
  limites = { ...limites, [clave]: { ...limites[clave], maxPalabras } }
  guardar(limites)
}

function cargarLimiteAntecedentes(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANTECEDENTES)
    if (raw) return Number(raw) || 5
  } catch {

  }
  return 5
}

let limiteAntecedentes = cargarLimiteAntecedentes()

export function getLimiteAntecedentes(): number {
  return limiteAntecedentes
}

export function setLimiteAntecedentes(max: number): void {
  limiteAntecedentes = max
  try {
    localStorage.setItem(STORAGE_KEY_ANTECEDENTES, String(max))
  } catch {

  }
}

export function contarPalabras(texto: string): number {
  const limpio = texto.trim()
  if (!limpio) return 0
  return limpio.split(/\s+/).length
}
