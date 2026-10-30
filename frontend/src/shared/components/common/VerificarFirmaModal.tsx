import { useState } from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import * as codigoFirmaApi from '../../api/codigoFirma'
import './ConfirmModal.css'
import './VerificarFirmaModal.css'

interface VerificarFirmaModalProps {
  /** Proyecto de la firma; 0 mientras el proyecto todavía no existe (registro). */
  idProyecto: number
  /** Qué se firma: "evaluación del proyecto", "registro del proyecto"... Sale en el texto y en el correo. */
  documento: string
  /** Se llama cuando el código es correcto; el servidor lo consume al registrar la firma. */
  onVerificado: () => void
  onCancelar: () => void
}

/** Toda firma del sistema se confirma con un código de 6 dígitos que llega al correo personal de la hoja de vida. */
function VerificarFirmaModal({ idProyecto, documento, onVerificado, onCancelar }: VerificarFirmaModalProps) {
  const navigate = useNavigate()
  const [enviadoA, setEnviadoA] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string; sinCorreo?: boolean } | null>(null)

  const enviar = async () => {
    setOcupado(true)
    setAviso(null)
    try {
      const r = await codigoFirmaApi.solicitarCodigoFirma(idProyecto, documento)
      setEnviadoA(r.correo_enmascarado)
      setCodigo('')
      setAviso({ tipo: 'ok', texto: `Te enviamos un código de 6 dígitos a ${r.correo_enmascarado}. Vence en ${r.vence_en_minutos} minutos.` })
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto: err instanceof ApiError ? err.message : 'No se pudo enviar el código. Intenta de nuevo.',
        sinCorreo: err instanceof ApiError && err.status === 409,
      })
    } finally {
      setOcupado(false)
    }
  }

  const firmar = async () => {
    setOcupado(true)
    setAviso(null)
    try {
      await codigoFirmaApi.verificarCodigoFirma(idProyecto, codigo)
      onVerificado()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo verificar el código. Intenta de nuevo.' })
      setOcupado(false)
    }
  }

  return (
    <div className="cm-overlay">
      <div className="cm-box vf-box">
        <button type="button" className="cm-close" onClick={onCancelar} aria-label="Cerrar">
          <X size={16} />
        </button>

        <p className="cm-mensaje">Para firmar {documento} te enviamos un código de verificación de 6 dígitos a tu correo personal.</p>

        <div className="cm-actions">
          <button type="button" className="cm-btn cm-btn-azul" onClick={enviar} disabled={ocupado}>
            {enviadoA ? 'Reenviar código' : 'Enviar código a mi correo personal'}
          </button>
        </div>

        {enviadoA && (
          <div className="vf-codigo">
            <label>
              Código de verificación
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                aria-label="Código de verificación"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <button type="button" className="cm-btn cm-btn-rojo" onClick={firmar} disabled={ocupado || codigo.length !== 6}>
              Firmar
            </button>
          </div>
        )}

        {aviso && (
          <p role="status" className={aviso.tipo === 'ok' ? 'vf-aviso vf-aviso-ok' : 'vf-aviso vf-aviso-error'}>
            {aviso.texto}
          </p>
        )}
        {aviso?.sinCorreo && (
          <div className="cm-actions">
            <button type="button" className="cm-btn cm-btn-azul" onClick={() => navigate('/perfil')}>
              Ir a mi Perfil
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default VerificarFirmaModal
