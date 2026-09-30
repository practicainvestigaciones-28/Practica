import { apiFetch } from '../../../shared/api/client'

export interface DatosBancarios {
  id_dato_bancario: number
  id_usuario: number
  banco: string
  tipo_cuenta: string
  numero_cuenta: string
  titular: string
  documento_titular: string
}

export function obtenerMisDatosBancarios(): Promise<{ datos: DatosBancarios | null }> {
  return apiFetch('/pagos/datos-bancarios')
}

export function guardarMisDatosBancarios(datos: {
  banco: string
  tipo_cuenta: string
  numero_cuenta: string
  titular: string
  documento_titular: string
}): Promise<{ mensaje: string; datos: DatosBancarios }> {
  return apiFetch('/pagos/datos-bancarios', {
    method: 'PUT',
    body: JSON.stringify(datos),
  })
}
