// ⚠️ MODO PRUEBA — no hay endpoints de backend para esto todavía.
// Los límites de palabras de cada recuadro de texto del formulario
// "Crear proyecto" se guardan en localStorage, igual que los demás
// lib/*.ts, para que ya queden funcionando sin necesitar backend. Cuando
// exista la vista de administrador para editarlos (pendiente), solo hay
// que reemplazar cargarInicial()/guardar() por los fetch/PUT reales al
// backend — getLimite(), contarPalabras(), etc. no deberían cambiar.

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
  | 'funcionesEstudiante'

export interface LimiteTextoInfo {
  clave: ClaveLimiteTexto
  etiqueta: string
  maxPalabras: number
}

const STORAGE_KEY = 'sgpvie_limites_texto'
const STORAGE_KEY_ANTECEDENTES = 'sgpvie_limite_antecedentes'

// Los que llevan "(hoja)" vienen directo del formato físico
// "Presentación de Proyectos de Investigación" (INV-IC-FR, versión 7); el
// resto son valores iniciales razonables para recuadros que la hoja no
// acota, pensados para ajustarse luego desde la vista de administrador.
const limitesSemilla: Record<ClaveLimiteTexto, LimiteTextoInfo> = {
  resumen: { clave: 'resumen', etiqueta: 'Resumen', maxPalabras: 200 }, // hoja
  planteamientoProblema: {
    clave: 'planteamientoProblema',
    etiqueta: 'Planteamiento del problema',
    maxPalabras: 600,
  }, // hoja
  preguntaInvestigacion: {
    clave: 'preguntaInvestigacion',
    etiqueta: 'Pregunta de investigación',
    maxPalabras: 100,
  },
  justificacion: { clave: 'justificacion', etiqueta: 'Justificación', maxPalabras: 500 }, // hoja
  objetivoGeneral: { clave: 'objetivoGeneral', etiqueta: 'Objetivo general', maxPalabras: 150 },
  objetivoEspecifico: {
    clave: 'objetivoEspecifico',
    etiqueta: 'Objetivo específico (cada uno)',
    maxPalabras: 100,
  },
  antecedente: { clave: 'antecedente', etiqueta: 'Antecedente (cada uno)', maxPalabras: 150 },
  referencia: { clave: 'referencia', etiqueta: 'Referencia (cada una)', maxPalabras: 60 },
  marcoTeorico: { clave: 'marcoTeorico', etiqueta: 'Marco teórico preliminar', maxPalabras: 2000 }, // hoja
  metodologia: { clave: 'metodologia', etiqueta: 'Metodología preliminar propuesta', maxPalabras: 500 },
  funcionesEstudiante: {
    clave: 'funcionesEstudiante',
    etiqueta: 'Funciones del estudiante auxiliar/asistente',
    maxPalabras: 500,
  }, // hoja
}

function cargarInicial(): Record<ClaveLimiteTexto, LimiteTextoInfo> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...limitesSemilla, ...(JSON.parse(raw) as Record<ClaveLimiteTexto, LimiteTextoInfo>) }
  } catch {
    // localStorage no disponible o datos corruptos — se usa la semilla
  }
  return limitesSemilla
}

function guardar(valores: Record<ClaveLimiteTexto, LimiteTextoInfo>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valores))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
  }
}

let limites = cargarInicial()

/** Para la futura vista de administrador que liste y edite todos los límites. */
export function getLimites(): LimiteTextoInfo[] {
  return Object.values(limites)
}

export function getLimite(clave: ClaveLimiteTexto): number {
  return limites[clave]?.maxPalabras ?? limitesSemilla[clave].maxPalabras
}

/** Sin pantalla que la use todavía — queda lista para cuando exista la
 * vista de administrador de límites de texto. */
export function setLimite(clave: ClaveLimiteTexto, maxPalabras: number): void {
  limites = { ...limites, [clave]: { ...limites[clave], maxPalabras } }
  guardar(limites)
}

function cargarLimiteAntecedentes(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANTECEDENTES)
    if (raw) return Number(raw) || 5
  } catch {
    // localStorage no disponible
  }
  return 5
}

let limiteAntecedentes = cargarLimiteAntecedentes()

/** Cantidad máxima de antecedentes (ítems, no palabras) — la hoja pide
 * "5 antecedentes como máximo". */
export function getLimiteAntecedentes(): number {
  return limiteAntecedentes
}

/** Sin pantalla que la use todavía, igual que setLimite(). */
export function setLimiteAntecedentes(max: number): void {
  limiteAntecedentes = max
  try {
    localStorage.setItem(STORAGE_KEY_ANTECEDENTES, String(max))
  } catch {
    // localStorage lleno o no disponible
  }
}

/** Cuenta palabras separadas por espacios en blanco — la hoja pide
 * límites "en palabras", no en caracteres. */
export function contarPalabras(texto: string): number {
  const limpio = texto.trim()
  if (!limpio) return 0
  return limpio.split(/\s+/).length
}
