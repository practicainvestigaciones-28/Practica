import { apiFetch } from './client'

export interface TipoDocumentoItem {
  id_tipo_documento: number
  nombre: string
  descripcion: string | null
  activo: boolean
}

export function listarTiposDocumento(): Promise<TipoDocumentoItem[]> {
  return apiFetch('/tipos-documento')
}
