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

/** POST /firmar-proyecto/:token — público: abrir el enlace del correo registra la firma. */
export function firmarPorEnlace(token: string): Promise<ResultadoFirmaProyectoEnlace> {
  return apiFetch(`/firmar-proyecto/${token}`, { method: 'POST', conAuth: false })
}
