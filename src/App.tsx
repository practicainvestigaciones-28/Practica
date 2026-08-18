import { useState } from 'react'
import './App.css'

function App() {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <main className="login-page">
      <div className="login-card">

        <div className="logo-container">
          <img
            src="/logosup.png"
            alt="Universidad CESMAG"
            className="logo"
          />
        </div>

        <div className="separator" />

        <h1>Sistema de gestión de proyectos de investigación</h1>

        <div className="separator" />

        <form className="login-form">

          <div className="form-group">
            <label htmlFor="usuario">Usuario</label>
            <input
              id="usuario"
              type="email"
              placeholder="administrador@unicesmag.edu.co"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>

            <div className="password-container">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="**************"
              />

              <button
                type="button"
                className="show-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <div className="login-options">
            <label className="remember">
              <input type="checkbox" />
              <span>Recordarme</span>
            </label>

            <button type="button" className="recover">
              Recuperar contraseña
            </button>
          </div>

          <button type="submit" className="login-button">
            Ingresar
          </button>

        </form>
      </div>
    </main>
  )
}

export default App