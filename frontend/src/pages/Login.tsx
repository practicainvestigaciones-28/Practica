import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'
import { setRole } from '../lib/auth'

function Login() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [recordarme, setRecordarme] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!usuario || !password) {
      setError('Ingresa tu usuario y contraseña.')
      return
    }

    setLoading(true)

    // ⚠️ MODO PRUEBA — mientras el backend no esté listo.
    // Simula un login exitoso con cualquier usuario/contraseña.
    // Cuando tu compañero tenga /api/auth/login funcionando,
    // borra este bloque y descomenta el fetch real de abajo.
    setTimeout(() => {
  setLoading(false)
  const rol = usuario.toLowerCase().includes('administrador') ? 'administrador' : 'usuario'
  setRole(rol)
  navigate('/dashboard')
}, 500)
return

    /* --- CÓDIGO REAL, para cuando el backend esté listo ---
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: usuario, contraseña: password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message ?? 'Credenciales inválidas.')
      }

      const data = await res.json()
      const storage = recordarme ? localStorage : sessionStorage
      storage.setItem('token', data.token)

      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión.')
    } finally {
      setLoading(false)
    }
    */
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
              placeholder="administrador@unicesmag.edu.co"
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
            <label className="remember">
              <input
                type="checkbox"
                checked={recordarme}
                onChange={(e) => setRecordarme(e.target.checked)}
              />
              <span>Recordarme</span>
            </label>

            <button type="button" className="recover" onClick={() => navigate('/recuperar-contrasena')}>
  Recuperar contraseña
</button>
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default Login