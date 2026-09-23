const BASE_URL = '/api'

export const EVENTO_SESION_EXPIRADA = 'app:sesion-expirada'

export interface DetalleSesionExpirada {
  codigo?: string
  mensaje: string
}

export interface RespuestaPaginada<T> {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export class ApiError extends Error {
  status: number
  // Algunos endpoints (ej. completitud de proyecto) devuelven, además del
  // mensaje humano, la lista puntual de campos que faltan — útil para
  // resaltarlos en el formulario en vez de solo mostrar el texto plano.
  faltantes?: string[]

  constructor(status: number, mensaje: string, faltantes?: string[]) {
    super(mensaje)
    this.name = 'ApiError'
    this.status = status
    this.faltantes = faltantes
  }
}

function obtenerTokenGuardado(): string | null {
  return localStorage.getItem('token') ?? sessionStorage.getItem('token')
}

function extraerMensaje(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'mensaje' in data) {
    const valor = (data as { mensaje?: unknown }).mensaje
    if (typeof valor === 'string') return valor
  }
  return undefined
}

function extraerCodigo(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'codigo' in data) {
    const valor = (data as { codigo?: unknown }).codigo
    if (typeof valor === 'string') return valor
  }
  return undefined
}

function extraerFaltantes(data: unknown): string[] | undefined {
  if (data && typeof data === 'object' && 'faltantes' in data) {
    const valor = (data as { faltantes?: unknown }).faltantes
    if (Array.isArray(valor) && valor.every((v) => typeof v === 'string')) return valor
  }
  return undefined
}

function dispatchSesionExpirada(data: unknown): void {
  // El mensaje siempre es el texto amigable para la persona usuaria — el
  // backend puede responder 401 por varias razones técnicas distintas
  // ("falta el token", "token inválido", "token vencido", etc.) y ninguna
  // de esas debe llegar tal cual a la pantalla de login.
  const detail: DetalleSesionExpirada = {
    codigo: extraerCodigo(data),
    mensaje: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  }
  window.dispatchEvent(new CustomEvent<DetalleSesionExpirada>(EVENTO_SESION_EXPIRADA, { detail }))
}

type OpcionesPeticion = RequestInit & {

  conAuth?: boolean
}

export async function apiFetch<T = unknown>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  const { conAuth = true, headers, ...resto } = opciones

  const headersFinales = new Headers(headers)
  headersFinales.set('Content-Type', 'application/json')

  if (conAuth) {
    const token = obtenerTokenGuardado()
    if (token) headersFinales.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${BASE_URL}${ruta}`, { ...resto, headers: headersFinales })

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    if (res.status === 401 && conAuth) {
      dispatchSesionExpirada(data)
    }
    throw new ApiError(res.status, extraerMensaje(data) ?? 'Ocurrió un error inesperado', extraerFaltantes(data))
  }

  return data as T
}

export async function apiFetchFormData<T = unknown>(ruta: string, formData: FormData): Promise<T> {
  const headersFinales = new Headers()
  const token = obtenerTokenGuardado()
  if (token) headersFinales.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${BASE_URL}${ruta}`, {
    method: 'POST',
    headers: headersFinales,
    body: formData,
  })

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    if (res.status === 401) {
      dispatchSesionExpirada(data)
    }
    throw new ApiError(res.status, extraerMensaje(data) ?? 'Ocurrió un error inesperado')
  }

  return data as T
}

export async function apiFetchBlob(ruta: string): Promise<Blob> {
  const headersFinales = new Headers()
  const token = obtenerTokenGuardado()
  if (token) headersFinales.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${BASE_URL}${ruta}`, { headers: headersFinales })

  if (!res.ok) {
    if (res.status === 401) {

      let data: unknown = null
      try {
        data = await res.json()
      } catch {
        data = null
      }
      dispatchSesionExpirada(data)
    }
    throw new ApiError(res.status, 'No se pudo descargar el archivo')
  }

  return res.blob()
}
