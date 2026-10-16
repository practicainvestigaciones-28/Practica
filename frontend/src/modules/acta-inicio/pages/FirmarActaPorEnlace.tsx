import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import * as actaApi from '../api/actaInicio'
import { ApiError } from '../../../shared/api/client'
import './ActaInicio.css'

type Estado =
  | { fase: 'firmando' }
  | { fase: 'ok'; resultado: actaApi.ResultadoFirmaEnlace }
  | { fase: 'error'; mensaje: string }

/** Página pública del enlace que llega al correo: abrirla registra la firma del acta de inicio (un click). */
function FirmarActaPorEnlace() {
  const { token } = useParams()
  const [estado, setEstado] = useState<Estado>({ fase: 'firmando' })
  // En desarrollo React ejecuta el efecto dos veces: la firma se pide una sola.
  const pedida = useRef(false)

  useEffect(() => {
    if (pedida.current) return
    pedida.current = true
    actaApi
      .firmarPorEnlace(token ?? '')
      .then((resultado) => setEstado({ fase: 'ok', resultado }))
      .catch((err) =>
        setEstado({ fase: 'error', mensaje: err instanceof ApiError ? err.message : 'No se pudo registrar la firma. Intenta de nuevo más tarde.' })
      )
  }, [token])

  return (
    <div className="acta-firma-enlace">
      <div className="acta-card acta-firma-enlace-caja">
        <h2>Firma del acta de inicio</h2>

        {estado.fase === 'firmando' && (
          <p className="acta-firma-enlace-estado">
            <Loader2 size={20} className="acta-girar" /> Registrando tu firma...
          </p>
        )}

        {estado.fase === 'ok' && (
          <>
            <p className="acta-ok acta-firma-enlace-estado">
              <CheckCircle2 size={20} /> {estado.resultado.ya_firmado ? 'Tu firma ya estaba registrada.' : 'Tu firma quedó registrada.'}
            </p>
            <dl className="acta-ficha">
              <dt>Proyecto</dt>
              <dd>{estado.resultado.titulo}</dd>
              <dt>Firmante</dt>
              <dd>
                {estado.resultado.nombre} — {estado.resultado.rol_firmante}
              </dd>
            </dl>
            <p className="acta-nota">
              {estado.resultado.legalizada
                ? 'Con esta firma el acta de inicio quedó legalizada y el proyecto pasa a ejecución.'
                : 'Cuando firmen los demás participantes el acta quedará legalizada. Ya puedes cerrar esta página.'}
            </p>
          </>
        )}

        {estado.fase === 'error' && (
          <>
            <p className="acta-error acta-firma-enlace-estado">
              <XCircle size={20} /> No se pudo registrar la firma
            </p>
            <p className="acta-nota">{estado.mensaje}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default FirmarActaPorEnlace
