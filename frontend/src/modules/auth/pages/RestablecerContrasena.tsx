import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Lock, Save } from 'lucide-react'
import { restablecerContraseña } from '../api/auth'
import { ApiError } from '../../../shared/api/client'
import './RecoverPassword.css'
import '../../usuarios/components/CambiarContrasenaModal.css'

// Página del enlace que llega por correo (/restablecer-contrasena?token=...): el mismo cambio de contraseña que
// se hace con sesión iniciada, pero sin la contraseña actual (el token de un solo uso prueba la identidad).
function RestablecerContrasena() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [mostrarRepetir, setMostrarRepetir] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!nueva || !repetir) {
      setError('Completa los dos campos.')
      return
    }
    if (nueva !== repetir) {
      setError('La nueva contraseña y su confirmación no coinciden.')
      return
    }
    setGuardando(true)
    try {
      await restablecerContraseña(token, nueva)
      setExito(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo restablecer la contraseña. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <main className="recover-page">
      <div className="recover-card">
        <div className="recover-illustration">
          <img src="/gear.png" alt="" className="gear" />
        </div>

        <div className="recover-content">
          <div className="recover-header">
            <img src="/logosup.png" alt="Universidad CESMAG" className="recover-logo" />
          </div>

          <h1 className="recover-title">Restablecer Contraseña</h1>

          {!token ? (
            <>
              <p className="recover-text">
                El enlace no es válido. Solicita uno nuevo desde "Recuperar contraseña" en la página de inicio de sesión.
              </p>
              <div className="recover-actions">
                <button type="button" className="btn-primary" onClick={() => navigate('/recuperar-contrasena')}>
                  Recuperar contraseña
                </button>
              </div>
            </>
          ) : exito ? (
            <>
              <p className="recover-text recover-exito">
                <Lock size={18} /> Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión con la nueva contraseña.
              </p>
              <div className="recover-actions">
                <button type="button" className="btn-primary" onClick={() => navigate('/')}>
                  Iniciar sesión
                </button>
              </div>
            </>
          ) : (
            <form className="recover-form" onSubmit={handleGuardar}>
              <p className="recover-text">Escribe tu nueva contraseña y repítela para confirmarla.</p>

              <div className="ccp-field">
                <label>Contraseña nueva</label>
                <div className="ccp-input-wrapper">
                  <input
                    type={mostrarNueva ? 'text' : 'password'}
                    value={nueva}
                    onChange={(e) => setNueva(e.target.value)}
                    placeholder="Contraseña nueva"
                    autoComplete="new-password"
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
                    autoComplete="new-password"
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

              {error && <p className="recover-error">{error}</p>}

              <div className="recover-actions">
                <button type="button" className="btn-outline" onClick={() => navigate('/')}>
                  Iniciar sesión
                </button>
                <button type="submit" className="btn-primary" disabled={guardando}>
                  <Save size={15} /> {guardando ? 'Guardando...' : 'Guardar contraseña'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

export default RestablecerContrasena
