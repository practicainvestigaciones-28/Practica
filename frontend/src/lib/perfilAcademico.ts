export interface PerfilAcademico {
  orcid: string
  googleAcademico: string
}

const PERFIL_VACIO: PerfilAcademico = { orcid: '', googleAcademico: '' }

const STORAGE_KEY = 'sgpvie_perfil_academico'

// ⚠️ MODO PRUEBA — ORCID y Google Académico no existen en ninguna tabla del
// backend todavía (ni siquiera hay columna para eso en Usuario). Se
// persisten en localStorage, por id_usuario, como el resto de módulos
// lib/*.ts en modo prueba. Cuando tu compañero agregue esas columnas
// reales, se reemplaza cargarTodo()/guardarTodo() por los fetch/PUT
// correspondientes, sin tocar cómo se usa esto desde las pantallas.

function cargarTodo(): Record<number, PerfilAcademico> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Record<number, PerfilAcademico>
  } catch {
    // localStorage no disponible o datos corruptos — se usa vacío
  }
  return {}
}

function guardarTodo(perfiles: Record<number, PerfilAcademico>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(perfiles))
  } catch {
    // localStorage lleno o no disponible — los cambios solo viven en memoria
  }
}

let perfiles: Record<number, PerfilAcademico> = cargarTodo()

export function getPerfilAcademico(idUsuario: number): PerfilAcademico {
  return perfiles[idUsuario] ?? PERFIL_VACIO
}

export function setPerfilAcademico(idUsuario: number, datos: PerfilAcademico): void {
  perfiles = { ...perfiles, [idUsuario]: datos }
  guardarTodo(perfiles)
}
