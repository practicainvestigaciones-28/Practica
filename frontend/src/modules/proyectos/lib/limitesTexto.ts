
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

function leerDesdeStorage(): Record<ClaveLimiteTexto, LimiteTextoInfo> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      // El límite siempre fue por PALABRAS (así está en el documento oficial);
      // datos guardados durante el error de contarlo por caracteres pueden
      // traer el campo viejo (maxCaracteres) en vez de maxPalabras.
      const guardado = JSON.parse(raw) as Record<
        string,
        { maxPalabras?: number; maxCaracteres?: number }
      >
      const resultado = {} as Record<ClaveLimiteTexto, LimiteTextoInfo>
      for (const clave of Object.keys(limitesSemilla) as ClaveLimiteTexto[]) {
        const valorGuardado = guardado[clave]?.maxPalabras ?? guardado[clave]?.maxCaracteres
        resultado[clave] = {
          ...limitesSemilla[clave],
          maxPalabras: valorGuardado ?? limitesSemilla[clave].maxPalabras,
        }
      }
      return resultado
    }
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

// Se lee directo de localStorage en cada llamada (nada de caché en una
// variable de módulo): así, si el admin cambia un límite en una pestaña,
// cualquier otra pestaña/página ya abierta lo ve en su siguiente render,
// sin depender de que ambas compartan la misma instancia del módulo.
export function getLimites(): LimiteTextoInfo[] {
  return Object.values(leerDesdeStorage())
}

export function getLimite(clave: ClaveLimiteTexto): number {
  const valores = leerDesdeStorage()
  return valores[clave]?.maxPalabras ?? limitesSemilla[clave].maxPalabras
}

export function setLimite(clave: ClaveLimiteTexto, maxPalabras: number): void {
  const valores = leerDesdeStorage()
  guardar({ ...valores, [clave]: { ...valores[clave], maxPalabras } })
}

export function getLimiteAntecedentes(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANTECEDENTES)
    if (raw) return Number(raw) || 5
  } catch {

  }
  return 5
}

export function setLimiteAntecedentes(max: number): void {
  try {
    localStorage.setItem(STORAGE_KEY_ANTECEDENTES, String(max))
  } catch {

  }
}

export function contarPalabras(texto: string): number {
  const recortado = texto.trim()
  return recortado ? recortado.split(/\s+/).length : 0
}
