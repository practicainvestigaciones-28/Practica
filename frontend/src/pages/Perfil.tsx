import { useRef, useState } from 'react'
import { Save, User, Camera } from 'lucide-react'
import { estadoConfig, ordenEstados, type Estado } from '../lib/estado'
import { getRole } from '../lib/auth'
import './Perfil.css'

type Tab = 'personal' | 'proyectos'

interface Proyecto {
  titulo: string
  fase: string
  estado: Estado
}

// Datos de ejemplo — mientras el backend no esté listo.
// Cuando tu compañero conecte el fetch real, esta lista vendrá del backend
// con la misma forma: { titulo, fase, estado } por cada proyecto del usuario.
const proyectosUsuario: Proyecto[] = [
  { titulo: 'Sistema Integral de Gestión Académica', fase: 'Comité investigación', estado: 'Pendiente' },
  { titulo: 'Plataforma de Seguimiento a Proyectos de Investigación', fase: 'Pares', estado: 'Rechazado' },
  { titulo: 'Observatorio de Innovación Regional', fase: 'Comité ética', estado: 'En revisión' },
  { titulo: 'Red de Conocimiento Universitario', fase: 'Comité investigación', estado: 'Aprobado' },
  { titulo: 'Fortalecimiento de Semilleros de Investigación', fase: 'Comité ética', estado: 'Correcciones' },
]

function Perfil() {
  const role = getRole()
  const isAdmin = role === 'administrador'

  const [tab, setTab] = useState<Tab>('personal')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setAvatarUrl(url)
  }

  // El administrador solo tiene información personal — no "sus propios" proyectos
  const tabActual: Tab = isAdmin ? 'personal' : tab

  return (
    <div className="perfil-card">
      <div className="perfil-banner">
        <div className="perfil-banner-shape" />
        <img src="/SGP.png" alt="SGP-VIE" className="perfil-banner-logo" />
      </div>

      <div className="perfil-avatar-wrapper">
        <div className="perfil-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Foto de perfil" className="perfil-avatar-img" />
          ) : (
            <User className="perfil-avatar-icon" strokeWidth={1.5} />
          )}
        </div>

        <button
          type="button"
          className="perfil-avatar-edit"
          onClick={handleAvatarClick}
          aria-label="Cambiar foto de perfil"
        >
          <Camera size={14} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="perfil-avatar-input"
          onChange={handleAvatarChange}
        />
      </div>

      <p className="perfil-username">Usuario X</p>

      {isAdmin ? (
        <div className="perfil-tabs">
          <span className="perfil-tab perfil-tab-active perfil-tab-static">
            Información personal
          </span>
        </div>
      ) : (
        <div className="perfil-tabs">
          <button
            type="button"
            className={`perfil-tab ${tabActual === 'personal' ? 'perfil-tab-active' : ''}`}
            onClick={() => setTab('personal')}
          >
            Información personal
          </button>
          <button
            type="button"
            className={`perfil-tab ${tabActual === 'proyectos' ? 'perfil-tab-active' : ''}`}
            onClick={() => setTab('proyectos')}
          >
            Información proyectos
          </button>
        </div>
      )}

      <div className="perfil-content">
        {tabActual === 'personal' ? (
          <form className="perfil-form" onSubmit={(e) => e.preventDefault()}>
            <div className="perfil-form-col">
              <div className="perfil-field">
                <label>Nombre</label>
                <input type="text" placeholder="XXXXXXXXXXXXXXXX" />
              </div>
              <div className="perfil-field">
                <label>Apellido</label>
                <input type="text" placeholder="XXXXXXXXXXXXXXXX" />
              </div>
              <div className="perfil-field">
                <label>Cédula</label>
                <input type="text" placeholder="XXXXXXXXXXXXXXXX" />
              </div>

              {!isAdmin && (
                <div className="perfil-field">
                  <label>Rol</label>
                  <select defaultValue="">
                    <option value="" disabled>Seleccione un rol</option>
                    <option value="administrador">Administrador</option>
                    <option value="docente">Docente</option>
                    <option value="investigador">Investigador</option>
                  </select>
                </div>
              )}
            </div>

            <div className="perfil-form-col">
              <div className="perfil-field">
                <label>Código (si aplica)</label>
                <input type="text" placeholder="XXXXXXXXXXXXXXXX" />
              </div>
              <div className="perfil-field">
                <label>Correo</label>
                <input type="email" placeholder="XXXXXXXXXXXXXXXX" />
              </div>
              <div className="perfil-field">
                <label>Contraseña</label>
                <input type="password" placeholder="XXXXXXXXXXXXXXXX" />
              </div>

              <button type="submit" className="perfil-save-btn">
                <Save size={16} />
                Actualizar datos
              </button>
            </div>
          </form>
        ) : (
          <div className="perfil-proyectos">
            <div className="perfil-legend">
              <span className="perfil-legend-label">Estados:</span>
              {ordenEstados.map((estado) => (
                <span
                  key={estado}
                  className="perfil-legend-swatch"
                  style={{ background: estadoConfig[estado].color }}
                  title={estado}
                />
              ))}
            </div>

            <div className="perfil-proyectos-header-static">
              <span>Título</span>
              <span>Fase</span>
              <span>Estado</span>
            </div>

            {proyectosUsuario.map((p) => (
              <div className="perfil-proyecto-row" key={p.titulo}>
                <span className="perfil-proyecto-titulo">{p.titulo}</span>
                <span className="perfil-proyecto-fase">{p.fase}</span>
                <span
                  className="perfil-proyecto-color"
                  style={{ background: estadoConfig[p.estado].color }}
                  title={p.estado}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Perfil