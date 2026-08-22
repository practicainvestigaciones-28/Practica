import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import './RecoverPassword.css'
import { solicitarRecuperacion } from '../api/auth'
import { ApiError } from '../api/client'

function RecoverPassword() {
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!correo) return

    setLoading(true)
    setError('')
    try {
      await solicitarRecuperacion(correo)
      setEnviado(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="recover-page">
      <div className="recover-card">
        <div className="recover-illustration">
          <Settings className="gear gear-large" strokeWidth={1.5} />
          <Settings className="gear gear-small" strokeWidth={1.5} />
        </div>

        <div className="recover-content">
          <div className="recover-header">
            <img src="/logosup.png" alt="Universidad CESMAG" className="recover-logo" />
          </div>

          {enviado ? (
            <p className="recover-text">
              Si el correo ingresado está registrado, recibirás en breve
              instrucciones para restablecer tu contraseña.
            </p>
          ) : (
            <>
              <p className="recover-text">
                Por favor, ingrese su dirección de correo electrónico personal.
                Usted recibirá instrucciones sobre cómo restablecer su contraseña.
              </p>

              <form className="recover-form" onSubmit={handleRecover}>
                {error && <p className="form-error">{error}</p>}

                <input
                  type="email"
                  placeholder="Correo electrónico"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  required
                />

                <div className="recover-actions">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => navigate('/')}
                  >
                    Iniciar sesión
                  </button>

                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Enviando...' : 'Recuperar contraseña'}
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