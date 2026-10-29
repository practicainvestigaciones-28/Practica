import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { aceptarTratamientoDatos } from '../api/auth'
import { ApiError } from '../../../shared/api/client'
import './Login.css'
import './AceptarTratamientoDatos.css'

const URL_TRATAMIENTO_DATOS = 'https://www.unicesmag.edu.co/documentos/DATOS-UNICESMAG.pdf'

/**
 * Pantalla obligatoria para Par Evaluador (ver acepto_tratamiento_datos /
 * ProtectedRoute.tsx) — al ser siempre externo a la universidad y tener
 * efectos legales su firma dentro del sistema, no puede ver ninguna otra
 * pantalla hasta aceptar el tratamiento de datos de la Universidad CESMAG.
 * No tiene botón de "cancelar": solo se sale de aquí aceptando (o cerrando
 * sesión, por si quiere volver más tarde).
 */
function AceptarTratamientoDatos() {
  const { actualizarUsuarioSesion, cerrarSesion } = useAuth()

  const [marcado, setMarcado] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!marcado) {
      setError('Debes marcar la casilla para continuar.')
      return
    }

    setGuardando(true)
    try {
      await aceptarTratamientoDatos()
      // No se navega a mano a dónde seguir: ProtectedRoute.tsx es la única
      // fuente de verdad para eso (ver CambiarContrasenaInicial.tsx, mismo patrón).
      actualizarUsuarioSesion({ acepto_tratamiento_datos: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar tu aceptación. Intenta de nuevo.')
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
        <h1>Tratamiento de datos personales</h1>
        <div className="separator" />

        <p className="atd-aviso">
          Como Par Evaluador externo a la Universidad CESMAG, tu participación y firma dentro del Sistema SGP-VIE
          tienen efectos legales. Antes de continuar, debes leer y aceptar la política de tratamiento de datos
          personales de la institución.
        </p>

        <a href={URL_TRATAMIENTO_DATOS} target="_blank" rel="noopener noreferrer" className="atd-enlace">
          Consultar política de tratamiento de datos (PDF)
        </a>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}

          <label className="atd-checkbox">
            <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
            <span>
              He leído y acepto el tratamiento de mis datos personales por parte de la Universidad CESMAG, conforme
              a la Ley 1581 de 2012 y el Decreto 1074 de 2015.
            </span>
          </label>

          <button type="submit" className="login-button" disabled={guardando || !marcado}>
            {guardando ? 'Guardando...' : 'Aceptar y continuar'}
          </button>
        </form>

        <button type="button" className="atd-cerrar-sesion" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </main>
  )
}

export default AceptarTratamientoDatos
