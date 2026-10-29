import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import * as firmasProyectoApi from '../api/firmasProyecto'
import { ApiError } from '../../../shared/api/client'
import './FirmarProyecto.css'

type Estado =
  | { fase: 'cargando' }
  | { fase: 'firmar'; info: firmasProyectoApi.FirmaProyectoEnlace }
  | { fase: 'ok'; info: firmasProyectoApi.FirmaProyectoEnlace }
  | { fase: 'error'; mensaje: string }

const mensajeDe = (err: unknown, defecto: string) => (err instanceof ApiError ? err.message : defecto)

/**
 * Página pública del enlace que llega al correo de quien participa en el
 * proyecto (Co-investigador, externo, egresado). Abrirla NO firma: al dar
 * "Firmar" se envía un código de 6 dígitos a ese mismo correo, y la firma
 * queda registrada al validarlo.
 */
function FirmarProyectoPorEnlace() {
  const { token } = useParams()
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [enviadoA, setEnviadoA] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  // En desarrollo React ejecuta el efecto dos veces: la consulta se pide una sola vez.
  const pedida = useRef(false)

  useEffect(() => {
    if (pedida.current) return
    pedida.current = true
    firmasProyectoApi
      .obtenerFirmaPorEnlace(token ?? '')
      .then((info) => setEstado(info.ya_firmado ? { fase: 'ok', info } : { fase: 'firmar', info }))
      .catch((err) => setEstado({ fase: 'error', mensaje: mensajeDe(err, 'No se pudo abrir el enlace de firma. Intenta de nuevo más tarde.') }))
  }, [token])

  const enviarCodigo = async () => {
    setOcupado(true)
    setAviso(null)
    try {
      const r = await firmasProyectoApi.solicitarCodigoPorEnlace(token ?? '')
      setEnviadoA(r.correo_enmascarado)
      setCodigo('')
      setAviso({ tipo: 'ok', texto: `Te enviamos un código de 6 dígitos a ${r.correo_enmascarado}. Vence en ${r.vence_en_minutos} minutos.` })
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDe(err, 'No se pudo enviar el código. Intenta de nuevo.') })
    } finally {
      setOcupado(false)
    }
  }

  const confirmar = async () => {
    setOcupado(true)
    setAviso(null)
    try {
      const info = await firmasProyectoApi.firmarPorEnlace(token ?? '', codigo)
      setEstado({ fase: 'ok', info })
    } catch (err) {
      // Un código incorrecto o vencido deja volver a intentarlo; el resto (enlace inválido) cierra la página.
      if (err instanceof ApiError && err.status === 400 && enviadoA) setAviso({ tipo: 'error', texto: err.message })
      else setEstado({ fase: 'error', mensaje: mensajeDe(err, 'No se pudo registrar la firma. Intenta de nuevo más tarde.') })
    } finally {
      setOcupado(false)
    }
  }

  const ficha = (info: firmasProyectoApi.FirmaProyectoEnlace) => (
    <dl className="fp-ficha">
      <dt>Proyecto</dt>
      <dd>{info.titulo}</dd>
      <dt>Convocatoria</dt>
      <dd>{info.convocatoria}</dd>
      <dt>Tu participación</dt>
      <dd>
        {info.nombre} — {info.rol_firmante}
      </dd>
    </dl>
  )

  return (
    <div className="fp-firma-enlace">
      <div className="fp-firma-caja">
        <h2>Firma de registro de proyecto</h2>

        {estado.fase === 'cargando' && (
          <p className="fp-firma-estado">
            <Loader2 size={20} className="fp-girar" /> Abriendo el enlace de firma...
          </p>
        )}

        {estado.fase === 'firmar' && (
          <>
            {ficha(estado.info)}
            {!enviadoA ? (
              <>
                <p className="fp-nota">
                  Al dar "Firmar" te enviaremos un código de verificación de 6 dígitos
                  {estado.info.correo_enmascarado ? ` a ${estado.info.correo_enmascarado}` : ' a tu correo'}.
                </p>
                <div className="fp-acciones">
                  <button type="button" className="fp-btn" disabled={ocupado} onClick={enviarCodigo}>
                    {ocupado ? <Loader2 size={14} className="fp-girar" /> : null}
                    Firmar
                  </button>
                </div>
              </>
            ) : (
              <div className="fp-codigo">
                <label>
                  Código de verificación
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-label="Código de verificación"
                    placeholder="000000"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </label>
                <div className="fp-acciones">
                  <button type="button" className="fp-btn" disabled={ocupado || codigo.length !== 6} onClick={confirmar}>
                    Validar y firmar
                  </button>
                  <button type="button" className="fp-btn fp-btn-sec" disabled={ocupado} onClick={enviarCodigo}>
                    Reenviar código
                  </button>
                </div>
              </div>
            )}
            {aviso && (
              <p role="status" className={aviso.tipo === 'ok' ? 'fp-aviso fp-aviso-ok' : 'fp-aviso fp-aviso-error'}>
                {aviso.texto}
              </p>
            )}
          </>
        )}

        {estado.fase === 'ok' && (
          <>
            <p className="fp-firma-estado fp-ok">
              <CheckCircle2 size={20} />{' '}
              {estado.info.ya_firmado ? 'Tu firma ya estaba registrada.' : 'Tu participación en el proyecto quedó firmada.'}
            </p>
            {ficha(estado.info)}
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
