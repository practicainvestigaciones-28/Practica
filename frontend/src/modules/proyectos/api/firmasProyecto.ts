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
}

export interface EstadoFirmasProyecto {
  firmas: FirmaProyectoItem[]
}

/** Crea las firmas del proyecto (incluida la propia del Principal, de una vez) y manda los correos a quienes firman en paralelo (externo, egresado). Idempotente. */
export function iniciarFirmas(id_proyecto: number): Promise<EstadoFirmasProyecto> {
  return apiFetch(`/proyectos/${id_proyecto}/firmas/iniciar`, { method: 'POST' })
}

export function obtenerFirmas(id_proyecto: number): Promise<EstadoFirmasProyecto> {
  return apiFetch(`/proyectos/${id_proyecto}/firmas`)
}

/** Envía (o reenvía) el enlace de firma al Co-investigador(a) UNICESMAG, con el correo ya registrado en el proyecto. */
export function enviarFirmaCoinvestigador(id_proyecto: number): Promise<EstadoFirmasProyecto> {
  return apiFetch(`/proyectos/${id_proyecto}/firmas/enviar-coinvestigador`, { method: 'POST' })
}

export interface ResultadoFirmaProyectoEnlace {
  nombre: string
  rol_firmante: string
  titulo: string
  ya_firmado: boolean
}

export interface InfoFirmaProyectoEnlace {
  titulo: string
  nombre: string
  rol_firmante: string
  ya_firmado: boolean
  correo_enmascarado: string | null
}

/** GET /firmar-proyecto/:token — público: a quién corresponde el enlace. */
export function infoFirmaEnlace(token: string): Promise<InfoFirmaProyectoEnlace> {
  return apiFetch(`/firmar-proyecto/${token}`, { conAuth: false })
}

/** POST /firmar-proyecto/:token/codigo — público: envía el código de verificación al correo personal. */
export function solicitarCodigoEnlace(token: string): Promise<{ correo_enmascarado: string; vence_en_minutos: number }> {
  return apiFetch(`/firmar-proyecto/${token}/codigo`, { method: 'POST', conAuth: false })
}

/** POST /firmar-proyecto/:token — público: firma con el enlace del correo y el código de verificación. */
export function firmarPorEnlace(token: string, codigo?: string): Promise<ResultadoFirmaProyectoEnlace> {
  return apiFetch(`/firmar-proyecto/${token}`, { method: 'POST', conAuth: false, body: JSON.stringify({ codigo }) })
}
