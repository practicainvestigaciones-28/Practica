import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import './Login.css'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../../../shared/api/client'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import { hayRolElegido } from '../lib/auth'

const URL_RECUPERAR_CONTRASENA = 'https://ruah.unicesmag.edu.co/recuperarclave'

function Login() {
  const navigate = useNavigate()
  const { iniciarSesion, mensajeSesionExpirada, limpiarMensajeSesionExpirada, token, usuario: usuarioSesion, cargando } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Ya hay una sesión activa en este navegador (otra pestaña, o quedó
  // guardada de antes): no tiene sentido mostrar el formulario de login,
  // se manda directo a donde corresponda.
  if (!cargando && token && usuarioSesion) {
    const puedeElegirRol = usuarioSesion.roles.length > 1 || usuarioSesion.roles.includes('Administrador')
    return <Navigate to={puedeElegirRol && !hayRolElegido() ? '/elegir-rol' : '/inicio'} replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!usuario || !password) {
      setError('Ingresa tu usuario y contraseña.')
      return
    }

    setLoading(true)
    try {
      const usuarioSesion = await iniciarSesion(usuario, password)
      // El administrador puede elegir entre los 4 roles aunque su cuenta
      // solo tenga "Administrador" asignado — es la cuenta con acceso total.
      const puedeElegirRol = usuarioSesion.roles.length > 1 || usuarioSesion.roles.includes('Administrador')
      navigate(puedeElegirRol ? '/elegir-rol' : '/inicio')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="logo-container">
          <img src="/logosup.png" alt="Universidad CESMAG" className="logo" />
        </div>

        <div className="separator" />
        <h1>Sistema de gestión de proyectos de investigación</h1>
        <div className="separator" />

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}

          <div className="form-group">
            <label htmlFor="usuario">Usuario</label>
            <input
              id="usuario"
              type="email"
              placeholder="Ingresa tu correo electrónico"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <div className="password-container">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="show-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <div className="login-options">
            <button
              type="button"
              className="recover"
              onClick={() => {
                window.location.href = URL_RECUPERAR_CONTRASENA
              }}
            >
              Recuperar contraseña
            </button>
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>

      {mensajeSesionExpirada && (
        <ConfirmModal
          mensaje={mensajeSesionExpirada}
          botonPrimario={{ label: 'Ok', onClick: limpiarMensajeSesionExpirada, variante: 'azul' }}
          onClose={limpiarMensajeSesionExpirada}
        />
      )}
    </main>
  )
}

export default Login