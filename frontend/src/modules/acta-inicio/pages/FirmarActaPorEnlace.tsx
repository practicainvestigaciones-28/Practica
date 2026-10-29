import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import * as actaApi from '../api/actaInicio'
import { ApiError } from '../../../shared/api/client'
import './ActaInicio.css'

type Estado =
  | { fase: 'cargando' }
  | { fase: 'codigo'; info: actaApi.InfoFirmaEnlace }
  | { fase: 'firmando' }
  | { fase: 'ok'; resultado: actaApi.ResultadoFirmaEnlace }
  | { fase: 'error'; mensaje: string }

const mensajeDe = (err: unknown, defecto: string) => (err instanceof ApiError ? err.message : defecto)

/** Página pública del enlace que llega al correo. El investigador firma con un código de verificación que se le envía a su
 * correo personal; también el Vicerrector; solo el Administrador firma sin código, con su sesión. */
function FirmarActaPorEnlace() {
  const { token } = useParams()
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [codigo, setCodigo] = useState('')
  const [enviadoA, setEnviadoA] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  // En desarrollo React ejecuta el efecto dos veces: la consulta (y la firma sin código) se piden una sola vez.
  const pedida = useRef(false)

  const firmar = (codigoVerificacion?: string) => {
    setEstado({ fase: 'firmando' })
    return actaApi
      .firmarPorEnlace(token ?? '', codigoVerificacion)
      .then((resultado) => setEstado({ fase: 'ok', resultado }))
      .catch((err) => setEstado({ fase: 'error', mensaje: mensajeDe(err, 'No se pudo registrar la firma. Intenta de nuevo más tarde.') }))
  }

  useEffect(() => {
    if (pedida.current) return
    pedida.current = true
    actaApi
      .infoFirmaEnlace(token ?? '')
      .then((info) => {
        if (info.ya_firmado) {
          setEstado({
            fase: 'ok',
            resultado: { mensaje: 'Esta firma ya estaba registrada', titulo: info.titulo, nombre: info.nombre, rol_firmante: info.rol_firmante, legalizada: false, ya_firmado: true },
          })
        } else if (info.requiere_codigo) setEstado({ fase: 'codigo', info })
        else firmar()
      })
      .catch((err) => setEstado({ fase: 'error', mensaje: mensajeDe(err, 'No se pudo abrir el enlace de firma. Intenta de nuevo más tarde.') }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const enviarCodigo = async () => {
    setOcupado(true)
    setAviso(null)
    try {
      const r = await actaApi.solicitarCodigoEnlace(token ?? '')
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
      const resultado = await actaApi.firmarPorEnlace(token ?? '', codigo)
      setEstado({ fase: 'ok', resultado })
    } catch (err) {
      // Un código incorrecto deja volver a intentarlo; el resto de errores (enlace vencido, acta fuera de firma) cierran la página.
      if (err instanceof ApiError && err.status === 400) setAviso({ tipo: 'error', texto: err.message })
      else setEstado({ fase: 'error', mensaje: mensajeDe(err, 'No se pudo registrar la firma. Intenta de nuevo más tarde.') })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="acta-firma-enlace">
      <div className="acta-card acta-firma-enlace-caja">
        <h2>Firma del acta de inicio</h2>

        {(estado.fase === 'cargando' || estado.fase === 'firmando') && (
          <p className="acta-firma-enlace-estado">
            <Loader2 size={20} className="acta-girar" /> {estado.fase === 'cargando' ? 'Abriendo el enlace de firma...' : 'Registrando tu firma...'}
          </p>
        )}

        {estado.fase === 'codigo' && (
          <>
            <dl className="acta-ficha">
              <dt>Proyecto</dt>
              <dd>{estado.info.titulo}</dd>
              <dt>Firmante</dt>
              <dd>
                {estado.info.nombre} — {estado.info.rol_firmante}
              </dd>
            </dl>
            {estado.info.correo_enmascarado ? (
              <>
                <p className="acta-nota">
                  Para firmar te enviamos un código de verificación de 6 dígitos a tu correo ({estado.info.correo_enmascarado}).
                </p>
                <div className="acta-acciones">
                  <button type="button" className="acta-btn acta-btn-sec" disabled={ocupado} onClick={enviarCodigo}>
                    {enviadoA ? 'Reenviar código' : 'Enviar código a mi correo'}
                  </button>
                </div>
                {enviadoA && (
                  <div className="acta-codigo">
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
                    <button type="button" className="acta-btn" disabled={ocupado || codigo.length !== 6} onClick={confirmar}>
                      Firmar el acta
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="acta-error">
                Para firmar necesitas tener tu correo personal registrado en tu hoja de vida. Inicia sesión, regístralo en tu Perfil y vuelve a
                abrir este enlace.
              </p>
            )}
            {aviso && (
              <p role="status" className={aviso.tipo === 'ok' ? 'acta-ok acta-aviso-ok' : 'acta-error'} style={{ marginTop: 10 }}>
                {aviso.texto}
              </p>
            )}
          </>
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
