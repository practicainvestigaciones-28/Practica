const BASE_URL = '/api'

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
    throw new ApiError(res.status, extraerMensaje(data) ?? 'Ocurrió un error inesperado')
  }

  return data as T
}
