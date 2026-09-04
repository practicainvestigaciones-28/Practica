import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './RecoverPassword.css'

function RecoverPassword() {
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('')
  const [enviado, setEnviado] = useState(false)

  const handleRecover = (e: React.FormEvent) => {
    e.preventDefault()
    if (!correo) return

    setEnviado(true)
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

                  <button type="submit" className="btn-primary">
                    Recuperar contraseña
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