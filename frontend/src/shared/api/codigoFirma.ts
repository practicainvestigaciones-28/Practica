import { apiFetch } from './client'

export interface CodigoEnviado {
  correo_enmascarado: string
  vence_en_minutos: number
}

/** POST /proyectos/:id/codigo-firma — envía al correo personal de la hoja de vida el código para firmar. `id_proyecto` 0 =
 * proyecto que todavía no existe (firma del registro). `documento` es el texto que sale en el correo. */
export function solicitarCodigoFirma(id_proyecto: number, documento: string): Promise<CodigoEnviado> {
  return apiFetch(`/proyectos/${id_proyecto}/codigo-firma`, { method: 'POST', body: JSON.stringify({ documento }) })
}

/** POST /proyectos/:id/codigo-firma/verificar — comprueba el código; la firma que sigue lo consume en el servidor. */
export function verificarCodigoFirma(id_proyecto: number, codigo: string): Promise<{ verificado: boolean }> {
  return apiFetch(`/proyectos/${id_proyecto}/codigo-firma/verificar`, { method: 'POST', body: JSON.stringify({ codigo }) })
}
