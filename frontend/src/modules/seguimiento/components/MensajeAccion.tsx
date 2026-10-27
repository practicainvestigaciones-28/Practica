import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Aviso } from './UI'

/** Etiquetas dentro de las que el mensaje va al final (después de ellas no puede haber un bloque nuevo). */
const CONTENEDORES_INTERNOS = ['TD', 'TH', 'LI', 'BUTTON']

/** Resultado de la última acción, mostrado justo debajo de los botones donde se pulsó (y no arriba de la página). */
function MensajeAccion({ error, aviso, ancla }: { error: string; aviso: string; ancla: HTMLElement[] }) {
  const [host] = useState(() => document.createElement('div'))
  const [colocado, setColocado] = useState(false)
  const hay = !!(error || aviso)

  useLayoutEffect(() => {
    const destino = hay ? ancla.find((e) => e.isConnected) : undefined
    if (!destino) {
      host.remove()
      if (colocado) setColocado(false)
      return
    }
    if (CONTENEDORES_INTERNOS.includes(destino.tagName)) {
      if (host.parentElement !== destino) destino.appendChild(host)
    } else if (host.previousElementSibling !== destino) {
      destino.after(host)
    }
    if (!colocado) setColocado(true)
  })
  useLayoutEffect(() => () => host.remove(), [host])

  if (!hay) return null
  const contenido = (
    <>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}
    </>
  )
  return colocado ? createPortal(contenido, host) : contenido
}

export default MensajeAccion
