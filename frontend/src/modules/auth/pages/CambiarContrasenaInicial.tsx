import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { cambiarContraseña } from '../api/auth'
import { ApiError } from '../../../shared/api/client'
import './Login.css'
import './CambiarContrasenaInicial.css'

/**
 * Pantalla obligatoria para una cuenta creada con contraseña temporal (ver
 * debe_cambiar_contrasena / ProtectedRoute.tsx) — no tiene botón de
 * "cancelar" ni forma de saltársela: solo se sale de aquí cambiando la
 * contraseña (o cerrando sesión, por si quiere volver más tarde).
 */
function CambiarContrasenaInicial() {
  const { actualizarUsuarioSesion, cerrarSesion } = useAuth()

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [mostrarActual, setMostrarActual] = useState(false)
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [mostrarRepetir, setMostrarRepetir] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!actual || !nueva || !repetir) {
      setError('Completa los tres campos.')
      return
    }
    if (nueva.length < 8) {
      setError('La contraseña nueva debe tener al menos 8 caracteres.')
      return
    }
    if (nueva !== repetir) {
      setError('La contraseña nueva y su confirmación no coinciden.')
      return
    }

    setGuardando(true)
    try {
      await cambiarContraseña(actual, nueva)
      // No se navega a mano a dónde seguir: ProtectedRoute.tsx es la única
      // fuente de verdad para eso (si la cuenta tiene más de un rol, manda
      // a elegir; si no, a /inicio) — apenas se actualiza la bandera acá,
      // se vuelve a renderizar y decide el destino correcto solo.
      actualizarUsuarioSesion({ debe_cambiar_contrasena: false })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="logo-container">
          <img src="/logosup.png" alt="Universidad CESMAG" className="logo" />
        </div>

        <div className="separator" />
        <h1>Debes cambiar tu contraseña</h1>
        <div className="separator" />

        <p className="cci-aviso">
          Tu cuenta se creó con una contraseña temporal. Antes de continuar, ingrésala junto con la contraseña nueva que vas a usar de ahora en adelante.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}

          <div className="form-group">
            <label htmlFor="actual">Contraseña temporal (la que te llegó por correo)</label>
            <div className="password-container">
              <input
                id="actual"
                type={mostrarActual ? 'text' : 'password'}
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="show-password"
                onClick={() => setMostrarActual((v) => !v)}
                aria-label={mostrarActual ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarActual ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="nueva">Contraseña nueva</label>
            <div className="password-container">
              <input
                id="nueva"
                type={mostrarNueva ? 'text' : 'password'}
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="show-password"
                onClick={() => setMostrarNueva((v) => !v)}
                aria-label={mostrarNueva ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarNueva ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="repetir">Repetir contraseña nueva</label>
            <div className="password-container">
              <input
                id="repetir"
                type={mostrarRepetir ? 'text' : 'password'}
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="show-password"
                onClick={() => setMostrarRepetir((v) => !v)}
                aria-label={mostrarRepetir ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarRepetir ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-button" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </form>

        <button type="button" className="cci-cerrar-sesion" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </main>
  )
}

export default CambiarContrasenaInicial
