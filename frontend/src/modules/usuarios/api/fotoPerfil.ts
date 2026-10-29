import { useEffect, useState } from 'react'
import { ApiError, apiFetch, apiFetchBlob, apiFetchFormData } from '../../../shared/api/client'

/** Se dispara al subir o quitar la foto, para que la barra superior se actualice sin recargar. */
const EVENTO_FOTO_PERFIL = 'app:foto-perfil-actualizada'

export const TIPOS_FOTO_PERFIL = ['image/jpeg', 'image/png', 'image/webp']
export const TAMANO_MAXIMO_FOTO_BYTES = 2 * 1024 * 1024

/** La foto del usuario en sesión, o null si no tiene. */
export async function obtenerFotoPerfil(): Promise<Blob | null> {
  try {
    return await apiFetchBlob('/usuarios/me/foto')
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function subirFotoPerfil(archivo: File): Promise<void> {
  const formData = new FormData()
  formData.append('foto', archivo)
  await apiFetchFormData('/usuarios/me/foto', formData)
  window.dispatchEvent(new Event(EVENTO_FOTO_PERFIL))
}

export async function quitarFotoPerfil(): Promise<void> {
  await apiFetch('/usuarios/me/foto', { method: 'DELETE' })
  window.dispatchEvent(new Event(EVENTO_FOTO_PERFIL))
}

/** URL lista para un <img> con la foto del usuario en sesión (null = sin foto); se refresca sola al cambiarla. */
export function useFotoPerfil(): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    let urlActual: string | null = null

    const cargar = () => {
      obtenerFotoPerfil()
        .then((blob) => {
          if (!vigente) return
          if (urlActual) URL.revokeObjectURL(urlActual)
          urlActual = blob ? URL.createObjectURL(blob) : null
          setUrl(urlActual)
        })
        .catch(() => {
          // Sin foto o sin conexión: se deja el ícono por defecto.
        })
    }

    cargar()
    window.addEventListener(EVENTO_FOTO_PERFIL, cargar)
    return () => {
      vigente = false
      window.removeEventListener(EVENTO_FOTO_PERFIL, cargar)
      if (urlActual) URL.revokeObjectURL(urlActual)
    }
  }, [])

  return url
}
