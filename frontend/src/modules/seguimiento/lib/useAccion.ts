import { useCallback, useState } from 'react'
import { ApiError } from '../../../shared/api/client'

export function mensajeDeError(err: unknown, porDefecto = 'No se pudo completar la acción.'): string {
  if (!(err instanceof ApiError)) return porDefecto
  return err.faltantes?.length ? `${err.message} ${err.faltantes.join(' ')}` : err.message
}

export type Ejecutar = (accion: () => Promise<unknown>, mensajeOk: string) => Promise<boolean>

/** Ejecuta una acción mostrando un mensaje de éxito o el error del backend, y
 * llama a `alTerminar` (normalmente recargar datos) cuando sale bien. */
export function useAccion(alTerminar?: () => void) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const ejecutar: Ejecutar = useCallback(
    async (accion, mensajeOk) => {
      setOcupado(true)
      setError('')
      setAviso('')
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

  return { ocupado, error, aviso, ejecutar }
}
