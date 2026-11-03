import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { solicitarRecuperacion } from '../api/auth'
import { ApiError } from '../../../shared/api/client'
import './RecoverPassword.css'

// Recuperación de contraseña propia del sistema (antes enviaba a Ruah): se pide el correo personal de la
// cuenta y ahí llega un enlace para restablecerla (ver RestablecerContrasena.tsx).
function RecoverPassword() {
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!correo.trim()) return
    setError('')
    setEnviando(true)
    try {
      await solicitarRecuperacion(correo.trim())
      setEnviado(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor. Intenta de nuevo.')
    } finally {
      setEnviando(false)
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

          <h1 className="recover-title">Recuperar Contraseña</h1>

          {enviado ? (
            <>
              <p className="recover-text">
                Si el correo ingresado está asociado a una cuenta, recibirás en breve un mensaje con el botón para
                restablecer tu contraseña. Revisa también la carpeta de correo no deseado.
              </p>
              <div className="recover-actions">
                <button type="button" className="btn-primary" onClick={() => navigate('/')}>
                  Iniciar sesión
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="recover-text">
                Por favor, ingrese su dirección de correo electrónico personal.
                Usted recibirá instrucciones sobre cómo restablecer su contraseña.
              </p>

              <form className="recover-form" onSubmit={handleRecover}>
                <input
                  type="email"
                  placeholder="Correo electrónico personal"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  autoComplete="email"
                  required
                />

                {error && <p className="recover-error">{error}</p>}

                <div className="recover-actions">
                  <button type="button" className="btn-outline" onClick={() => navigate('/')}>
                    Iniciar sesión
                  </button>

                  <button type="submit" className="btn-primary" disabled={enviando}>
                    {enviando ? 'Enviando...' : 'Recuperar contraseña'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

export default RecoverPassword
