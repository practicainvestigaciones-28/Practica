import { apiFetch } from '../../../shared/api/client'

export interface FirmaProyectoItem {
  id_firma: number
  id_usuarioproyecto: number
  nombre: string
  correo: string | null
  rol_firmante: string
  obligatoria: boolean
  firmado: boolean
  fecha_firma: string | null
  fecha_envio: string | null
  /** Evidencia de la firma electrónica (null en firmas hechas antes de que existiera). */
  id_transaccion: string | null
  hash_firma: string | null
  correo_verificacion_enmascarado: string | null
}

export interface EstadoFirmasProyecto {
  firmas: FirmaProyectoItem[]
  estado_actual: string | null
}

export interface CodigoEnviado {
  correo_enmascarado: string
  vence_en_minutos: number
}

/** Crea/actualiza las filas de firma del proyecto (nadie queda firmado aquí). Idempotente. */
export function iniciarFirmas(id_proyecto: number): Promise<EstadoFirmasProyecto> {
  return apiFetch(`/proyectos/${id_proyecto}/firmas/iniciar`, { method: 'POST' })
}

export function obtenerFirmas(id_proyecto: number): Promise<EstadoFirmasProyecto> {
  return apiFetch(`/proyectos/${id_proyecto}/firmas`)
}

/** Manda el código de 6 dígitos al correo personal (Hoja de Vida) del Investigador(a) Principal. */
export function solicitarCodigoPrincipal(id_proyecto: number): Promise<CodigoEnviado> {
  return apiFetch(`/proyectos/${id_proyecto}/firmas/principal/codigo`, { method: 'POST' })
}

export function firmarPrincipal(id_proyecto: number, codigo: string): Promise<EstadoFirmasProyecto> {
  return apiFetch(`/proyectos/${id_proyecto}/firmas/principal/firmar`, { method: 'POST', body: JSON.stringify({ codigo }) })
}

/** Envía (o reenvía) el enlace de firma al Co-investigador(a) UNICESMAG, con el correo ya registrado en el proyecto. */
export function enviarFirmaCoinvestigador(id_proyecto: number): Promise<EstadoFirmasProyecto> {
  return apiFetch(`/proyectos/${id_proyecto}/firmas/enviar-coinvestigador`, { method: 'POST' })
}

/** "Guardar proyecto": con todas las firmas obligatorias, pasa al visto bueno del líder. */
export function finalizarFirmas(id_proyecto: number): Promise<EstadoFirmasProyecto> {
  return apiFetch(`/proyectos/${id_proyecto}/firmas/finalizar`, { method: 'POST' })
}

export interface FirmaProyectoEnlace {
  nombre: string
  rol_firmante: string
  titulo: string
  convocatoria: string
  correo_enmascarado: string | null
  ya_firmado: boolean
}

/** GET /firmar-proyecto/:token — público: datos para mostrar antes de firmar (abrir el enlace ya no firma). */
export function obtenerFirmaPorEnlace(token: string): Promise<FirmaProyectoEnlace> {
  return apiFetch(`/firmar-proyecto/${token}`, { conAuth: false })
}

export function solicitarCodigoPorEnlace(token: string): Promise<CodigoEnviado> {
  return apiFetch(`/firmar-proyecto/${token}/codigo`, { method: 'POST', conAuth: false })
}

export function firmarPorEnlace(token: string, codigo: string): Promise<FirmaProyectoEnlace> {
  return apiFetch(`/firmar-proyecto/${token}`, { method: 'POST', body: JSON.stringify({ codigo }), conAuth: false })
}
