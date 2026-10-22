import { useCallback, useState } from 'react'
import { ApiError } from '../../../shared/api/client'

export function mensajeDeError(err: unknown, porDefecto = 'No se pudo completar la acción.'): string {
  if (!(err instanceof ApiError)) return porDefecto
  return err.faltantes?.length ? `${err.message} ${err.faltantes.join(' ')}` : err.message
}

/** Último botón pulsado fuera de un diálogo: el mensaje de la acción se muestra debajo de él. */
let ultimoBoton: HTMLElement | null = null
if (typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    (e) => {
      const boton = (e.target as HTMLElement | null)?.closest?.('button')
      if (boton && !boton.closest('.cm-box, [role="dialog"]')) ultimoBoton = boton as HTMLElement
    },
    true
  )
}

/** Contenedores del último botón pulsado, del más cercano al más lejano: si uno desaparece al recargar, el mensaje se queda en el siguiente. */
function ancestrosDelBoton(): HTMLElement[] {
  const lista: HTMLElement[] = []
  for (let e = ultimoBoton?.parentElement ?? null; e && e !== document.body; e = e.parentElement) lista.push(e)
  return lista
}

export type Ejecutar = (accion: () => Promise<unknown>, mensajeOk: string) => Promise<boolean>

/** Ejecuta una acción mostrando un mensaje de éxito o el error del backend, y
 * llama a `alTerminar` (normalmente recargar datos) cuando sale bien. */
export function useAccion(alTerminar?: () => void) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [ancla, setAncla] = useState<HTMLElement[]>([])

  const ejecutar: Ejecutar = useCallback(
    async (accion, mensajeOk) => {
      setOcupado(true)
      setError('')
      setAviso('')
      setAncla(ancestrosDelBoton())
      try {
        await accion()
        setAviso(mensajeOk)
        alTerminar?.()
        return true
      } catch (err) {
        setError(mensajeDeError(err))
        return false
      } finally {
        setOcupado(false)
      }
    },
    [alTerminar]
  )

  return { ocupado, error, aviso, ancla, ejecutar }
}
