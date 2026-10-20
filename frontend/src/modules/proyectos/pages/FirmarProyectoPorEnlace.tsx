import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import * as firmasProyectoApi from '../api/firmasProyecto'
import { ApiError } from '../../../shared/api/client'
import './FirmarProyecto.css'

type Estado =
  | { fase: 'firmando' }
  | { fase: 'ok'; resultado: firmasProyectoApi.ResultadoFirmaProyectoEnlace }
  | { fase: 'error'; mensaje: string }

/** Página pública del enlace que llega al correo: abrirla registra la firma de participación en el proyecto (un click). */
function FirmarProyectoPorEnlace() {
  const { token } = useParams()
  const [estado, setEstado] = useState<Estado>({ fase: 'firmando' })
  // En desarrollo React ejecuta el efecto dos veces: la firma se pide una sola.
  const pedida = useRef(false)

  useEffect(() => {
    if (pedida.current) return
    pedida.current = true
    firmasProyectoApi
      .firmarPorEnlace(token ?? '')
      .then((resultado) => setEstado({ fase: 'ok', resultado }))
      .catch((err) =>
        setEstado({ fase: 'error', mensaje: err instanceof ApiError ? err.message : 'No se pudo registrar la firma. Intenta de nuevo más tarde.' })
      )
  }, [token])

  return (
    <div className="fp-firma-enlace">
      <div className="fp-firma-caja">
        <h2>Firma de registro de proyecto</h2>

        {estado.fase === 'firmando' && (
          <p className="fp-firma-estado">
            <Loader2 size={20} className="fp-girar" /> Registrando tu firma...
          </p>
        )}

        {estado.fase === 'ok' && (
          <>
            <p className="fp-firma-estado fp-ok">
              <CheckCircle2 size={20} /> {estado.resultado.ya_firmado ? 'Tu firma ya estaba registrada.' : 'Tu firma quedó registrada.'}
            </p>
            <dl className="fp-ficha">
              <dt>Proyecto</dt>
              <dd>{estado.resultado.titulo}</dd>
              <dt>Tu participación</dt>
              <dd>
                {estado.resultado.nombre} — {estado.resultado.rol_firmante}
              </dd>
            </dl>
            <p className="fp-nota">Ya puedes cerrar esta página.</p>
          </>
        )}

        {estado.fase === 'error' && (
          <>
            <p className="fp-firma-estado fp-error">
              <XCircle size={20} /> No se pudo registrar la firma
            </p>
            <p className="fp-nota">{estado.mensaje}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default FirmarProyectoPorEnlace
