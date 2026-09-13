export interface PerfilAcademico {
  orcid: string
  googleAcademico: string
}

const PERFIL_VACIO: PerfilAcademico = { orcid: '', googleAcademico: '' }

const STORAGE_KEY = 'sgpvie_perfil_academico'

function cargarTodo(): Record<number, PerfilAcademico> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Record<number, PerfilAcademico>
  } catch {

  }
  return {}
}

function guardarTodo(perfiles: Record<number, PerfilAcademico>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(perfiles))
  } catch {

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
