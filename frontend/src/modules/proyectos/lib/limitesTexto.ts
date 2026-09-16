
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
  maxCaracteres: number
}

const STORAGE_KEY = 'sgpvie_limites_texto'
const STORAGE_KEY_ANTECEDENTES = 'sgpvie_limite_antecedentes'

const limitesSemilla: Record<ClaveLimiteTexto, LimiteTextoInfo> = {
  resumen: { clave: 'resumen', etiqueta: 'Resumen', maxCaracteres: 200 },
  planteamientoProblema: {
    clave: 'planteamientoProblema',
    etiqueta: 'Planteamiento del problema',
    maxCaracteres: 600,
  },
  preguntaInvestigacion: {
    clave: 'preguntaInvestigacion',
    etiqueta: 'Pregunta de investigación',
    maxCaracteres: 100,
  },
  justificacion: { clave: 'justificacion', etiqueta: 'Justificación', maxCaracteres: 500 },
  objetivoGeneral: { clave: 'objetivoGeneral', etiqueta: 'Objetivo general', maxCaracteres: 150 },
  objetivoEspecifico: {
    clave: 'objetivoEspecifico',
    etiqueta: 'Objetivo específico (cada uno)',
    maxCaracteres: 100,
  },
  antecedente: { clave: 'antecedente', etiqueta: 'Antecedente (cada uno)', maxCaracteres: 150 },
  referencia: { clave: 'referencia', etiqueta: 'Referencia (cada una)', maxCaracteres: 60 },
  marcoTeorico: { clave: 'marcoTeorico', etiqueta: 'Marco teórico preliminar', maxCaracteres: 2000 },
  metodologia: { clave: 'metodologia', etiqueta: 'Metodología preliminar propuesta', maxCaracteres: 500 },
  componenteEtico: { clave: 'componenteEtico', etiqueta: 'Componente ético', maxCaracteres: 500 },
  funcionesEstudiante: {
    clave: 'funcionesEstudiante',
    etiqueta: 'Funciones del estudiante auxiliar/asistente',
    maxCaracteres: 500,
  },
}

function leerDesdeStorage(): Record<ClaveLimiteTexto, LimiteTextoInfo> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      // Datos guardados desde antes del cambio a "caracteres" todavía pueden
      // traer el campo viejo (maxPalabras) en vez de maxCaracteres.
      const guardado = JSON.parse(raw) as Record<
        string,
        { maxCaracteres?: number; maxPalabras?: number }
      >
      const resultado = {} as Record<ClaveLimiteTexto, LimiteTextoInfo>
      for (const clave of Object.keys(limitesSemilla) as ClaveLimiteTexto[]) {
        const valorGuardado = guardado[clave]?.maxCaracteres ?? guardado[clave]?.maxPalabras
        resultado[clave] = {
          ...limitesSemilla[clave],
          maxCaracteres: valorGuardado ?? limitesSemilla[clave].maxCaracteres,
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
  return valores[clave]?.maxCaracteres ?? limitesSemilla[clave].maxCaracteres
}

export function setLimite(clave: ClaveLimiteTexto, maxCaracteres: number): void {
  const valores = leerDesdeStorage()
  guardar({ ...valores, [clave]: { ...valores[clave], maxCaracteres } })
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

export function contarCaracteres(texto: string): number {
  return texto.length
}
