import { apiFetch } from '../../../shared/api/client'

export interface TipoDocumentoItem {
  id_tipo_documento: number
  nombre: string
  descripcion: string | null
  activo: boolean
}

export function listarTiposDocumento(): Promise<TipoDocumentoItem[]> {
  return apiFetch('/tipos-documento')
}

export interface EtapaItem {
  id_etapa: number
  nombre: string
  descripcion: string | null
}

export function listarEtapas(): Promise<EtapaItem[]> {
  return apiFetch('/tipos-documento/etapas')
}
