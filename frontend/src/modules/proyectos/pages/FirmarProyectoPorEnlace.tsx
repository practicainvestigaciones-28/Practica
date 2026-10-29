import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import * as firmasProyectoApi from '../api/firmasProyecto'
import { ApiError } from '../../../shared/api/client'
import './FirmarProyecto.css'

type Estado =
  | { fase: 'cargando' }
  | { fase: 'codigo'; info: firmasProyectoApi.InfoFirmaProyectoEnlace }
  | { fase: 'ok'; resultado: firmasProyectoApi.ResultadoFirmaProyectoEnlace }
  | { fase: 'error'; mensaje: string }

const mensajeDe = (err: unknown, defecto: string) => (err instanceof ApiError ? err.message : defecto)

/** Página pública del enlace que llega al correo personal: la firma de participación en el proyecto se confirma con un código
 * de verificación que se envía a ese mismo correo. */
function FirmarProyectoPorEnlace() {
  const { token } = useParams()
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [codigo, setCodigo] = useState('')
  const [enviadoA, setEnviadoA] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  // En desarrollo React ejecuta el efecto dos veces: la consulta se hace una sola.
  const pedida = useRef(false)

  useEffect(() => {
    if (pedida.current) return
    pedida.current = true
    firmasProyectoApi
      .infoFirmaEnlace(token ?? '')
      .then((info) => {
        if (info.ya_firmado) {
          setEstado({ fase: 'ok', resultado: { titulo: info.titulo, nombre: info.nombre, rol_firmante: info.rol_firmante, ya_firmado: true } })
        } else setEstado({ fase: 'codigo', info })
      })
      .catch((err) => setEstado({ fase: 'error', mensaje: mensajeDe(err, 'No se pudo abrir el enlace de firma. Intenta de nuevo más tarde.') }))
  }, [token])

  const enviarCodigo = async () => {
    setOcupado(true)
    setAviso(null)
    try {
      const r = await firmasProyectoApi.solicitarCodigoEnlace(token ?? '')
      setEnviadoA(r.correo_enmascarado)
      setCodigo('')
      setAviso({ tipo: 'ok', texto: `Te enviamos un código de 6 dígitos a ${r.correo_enmascarado}. Vence en ${r.vence_en_minutos} minutos.` })
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDe(err, 'No se pudo enviar el código. Intenta de nuevo.') })
    } finally {
      setOcupado(false)
    }
  }

  const firmar = async () => {
    setOcupado(true)
    setAviso(null)
    try {
      const resultado = await firmasProyectoApi.firmarPorEnlace(token ?? '', codigo)
      setEstado({ fase: 'ok', resultado })
    } catch (err) {
      // Un código incorrecto deja volver a intentarlo; el resto de errores (enlace vencido...) cierran la página.
      if (err instanceof ApiError && err.status === 400 && !/enlace/i.test(err.message)) setAviso({ tipo: 'error', texto: err.message })
      else setEstado({ fase: 'error', mensaje: mensajeDe(err, 'No se pudo registrar la firma. Intenta de nuevo más tarde.') })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="fp-firma-enlace">
      <div className="fp-firma-caja">
        <h2>Firma de registro de proyecto</h2>

        {estado.fase === 'cargando' && (
          <p className="fp-firma-estado">
            <Loader2 size={20} className="fp-girar" /> Abriendo el enlace de firma...
          </p>
        )}

        {estado.fase === 'codigo' && (
          <>
            <dl className="fp-ficha">
              <dt>Proyecto</dt>
              <dd>{estado.info.titulo}</dd>
              <dt>Tu participación</dt>
              <dd>
                {estado.info.nombre} — {estado.info.rol_firmante}
              </dd>
            </dl>
            {estado.info.correo_enmascarado ? (
              <>
                <p className="fp-nota">
                  Para firmar te enviamos un código de verificación de 6 dígitos a tu correo personal ({estado.info.correo_enmascarado}).
                </p>
                <div className="fp-acciones">
                  <button type="button" className="fp-btn fp-btn-sec" disabled={ocupado} onClick={enviarCodigo}>
                    {enviadoA ? 'Reenviar código' : 'Enviar código a mi correo personal'}
                  </button>
                </div>
                {enviadoA && (
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
                    <button type="button" className="fp-btn" disabled={ocupado || codigo.length !== 6} onClick={firmar}>
                      Firmar
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="fp-firma-estado fp-error">
                Para firmar necesitas tener tu correo personal registrado en tu hoja de vida. Inicia sesión, regístralo en tu Perfil y vuelve a abrir
                este enlace.
              </p>
            )}
            {aviso && <p className={`fp-nota ${aviso.tipo === 'ok' ? 'fp-ok' : 'fp-error'}`}>{aviso.texto}</p>}
          </>
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
