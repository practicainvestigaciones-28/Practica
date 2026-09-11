import { useState } from 'react'
import { X, Eye, EyeOff, Save, Lock } from 'lucide-react'
import { cambiarContraseña } from '../api/auth'
import { ApiError } from '../api/client'
import './CambiarContrasenaModal.css'

interface CambiarContrasenaModalProps {
  onClose: () => void
}

function CambiarContrasenaModal({ onClose }: CambiarContrasenaModalProps) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')

  const [mostrarActual, setMostrarActual] = useState(false)
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [mostrarRepetir, setMostrarRepetir] = useState(false)

  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)

  const handleGuardar = async () => {
    setError('')

    if (!actual || !nueva || !repetir) {
      setError('Completa los tres campos.')
      return
    }
    if (nueva !== repetir) {
      setError('La nueva contraseña y su confirmación no coinciden.')
      return
    }

    setGuardando(true)
    try {
      await cambiarContraseña(actual, nueva)
      setExito(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo cambiar la contraseña. Intenta de nuevo.')
      }
    } finally {
      setGuardando(false)
    }
  }

  if (exito) {
    return (
      <div className="ccp-overlay" onClick={onClose}>
        <div className="ccp-box ccp-box-exito" onClick={(e) => e.stopPropagation()}>
          <div className="ccp-exito-icon">
            <Lock size={22} />
          </div>
          <p className="ccp-exito-texto">Tu contraseña se actualizó correctamente.</p>
          <button type="button" className="ccp-btn-guardar" onClick={onClose}>
            Ok
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ccp-overlay" onClick={onClose}>
      <div className="ccp-box" onClick={(e) => e.stopPropagation()}>
        <div className="ccp-header">
          <Lock size={16} />
          Cambiar contraseña
        </div>

        <button type="button" className="ccp-close" onClick={onClose} aria-label="Cerrar">
          <X size={16} />
        </button>

        <div className="ccp-body">
          <div className="ccp-field">
            <label>Contraseña actual</label>
            <div className="ccp-input-wrapper">
              <input
                type={mostrarActual ? 'text' : 'password'}
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                placeholder="Contraseña actual"
              />
              <button
                type="button"
                className="ccp-toggle-ver"
                onClick={() => setMostrarActual((v) => !v)}
                aria-label={mostrarActual ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarActual ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="ccp-divider" />

          <div className="ccp-field">
            <label>Contraseña nueva</label>
            <div className="ccp-input-wrapper">
              <input
                type={mostrarNueva ? 'text' : 'password'}
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                placeholder="Contraseña nueva"
              />
              <button
                type="button"
                className="ccp-toggle-ver"
                onClick={() => setMostrarNueva((v) => !v)}
                aria-label={mostrarNueva ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarNueva ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="ccp-field">
            <label>Repetir contraseña</label>
            <div className="ccp-input-wrapper">
              <input
                type={mostrarRepetir ? 'text' : 'password'}
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
                placeholder="Repetir contraseña"
              />
              <button
                type="button"
                className="ccp-toggle-ver"
                onClick={() => setMostrarRepetir((v) => !v)}
                aria-label={mostrarRepetir ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarRepetir ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="ccp-error">{error}</p>}
        </div>

        <div className="ccp-actions">
          <button type="button" className="ccp-btn-guardar" onClick={handleGuardar} disabled={guardando}>
            <Save size={16} />
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" className="ccp-btn-cancelar" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default CambiarContrasenaModal