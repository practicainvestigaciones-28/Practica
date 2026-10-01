import { apiFetch, apiFetchFormData, apiFetchBlob } from '../../../shared/api/client'

export interface DatosBancarios {
  id_dato_bancario: number
  id_usuario: number
  banco: string | null
  tipo_cuenta: string | null
  numero_cuenta: string | null
  titular: string | null
  documento_titular: string | null
  rut_path: string | null
  certificacion_bancaria_path: string | null
  cedula_path: string | null
}

export type TipoDocumentoPago = 'rut' | 'certificacion_bancaria' | 'cedula'

export function obtenerMisDatosBancarios(): Promise<{ datos: DatosBancarios | null }> {
  return apiFetch('/pagos/datos-bancarios')
}

export function guardarMisDatosBancarios(datos: {
  banco?: string
  tipo_cuenta?: string
  numero_cuenta?: string
  titular?: string
  documento_titular?: string
}): Promise<{ mensaje: string; datos: DatosBancarios }> {
  return apiFetch('/pagos/datos-bancarios', {
    method: 'PUT',
    body: JSON.stringify(datos),
  })
}

export function subirMiDocumentoPago(tipo: TipoDocumentoPago, archivo: File): Promise<{ mensaje: string; datos: DatosBancarios }> {
  const formData = new FormData()
  formData.append('archivo', archivo)
  return apiFetchFormData(`/pagos/datos-bancarios/documentos/${tipo}`, formData)
}

export async function descargarMiDocumentoPago(tipo: TipoDocumentoPago, nombreSugerido: string): Promise<void> {
  const blob = await apiFetchBlob(`/pagos/datos-bancarios/documentos/${tipo}`)
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreSugerido
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

export interface HistorialPagoItem {
  id_evaluacion: number
  proyecto: { id_proyecto: number; titulo: string }
  valor_pago: number | null
  pagado: boolean
  tiene_comprobante: boolean
  id_pago: number | null
}

export function obtenerMiHistorialPagos(): Promise<{ historial: HistorialPagoItem[] }> {
  return apiFetch('/pagos/historial')
}

export async function descargarMiComprobante(id_pago: number, nombreSugerido: string): Promise<void> {
  const blob = await apiFetchBlob(`/pagos/historial/${id_pago}/comprobante`)
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreSugerido
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
