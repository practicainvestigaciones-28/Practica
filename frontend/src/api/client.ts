const BASE_URL = '/api'

/**
 * Se dispara cuando el backend responde 401 a una petición que sí llevaba
 * (o debía llevar) token — es decir, la sesión ya no es válida (expiró o el
 * token quedó inválido). AuthContext escucha este evento para cerrar la
 * sesión y redirigir al login automáticamente, sin que cada pantalla tenga
 * que manejarlo por su cuenta.
 */
export const EVENTO_SESION_EXPIRADA = 'app:sesion-expirada'

/** Forma de respuesta de los listados paginados del backend (ver utils/paginacion.ts). */
export interface RespuestaPaginada<T> {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/** Error normalizado a partir de las respuestas { error, mensaje } del backend */
export class ApiError extends Error {
  status: number

  constructor(status: number, mensaje: string) {
    super(mensaje)
    this.name = 'ApiError'
    this.status = status
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

type OpcionesPeticion = RequestInit & {
  /** false para endpoints públicos (login, recuperar contraseña) */
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
      window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA))
    }
    throw new ApiError(res.status, extraerMensaje(data) ?? 'Ocurrió un error inesperado')
  }

  return data as T
}

/**
 * Igual que apiFetch, pero para subir archivos (multipart/form-data).
 * NO se fija el Content-Type a mano — el navegador debe ponerlo solo,
 * porque necesita incluir el "boundary" exacto del FormData.
 */
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
      window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA))
    }
    throw new ApiError(res.status, extraerMensaje(data) ?? 'Ocurrió un error inesperado')
  }

  return data as T
}
