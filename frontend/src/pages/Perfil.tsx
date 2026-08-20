import { useRef, useState } from 'react'
import { Save, User, Camera } from 'lucide-react'
import './Perfil.css'

type Tab = 'personal' | 'proyectos'

// Datos de ejemplo — mientras el backend no esté listo
const proyectosUsuario = [
  { titulo: 'Sistema Integral de Gestión Académica', fase: 'Comité investigación', color: '#c9c9c9' },
  { titulo: 'Plataforma de Seguimiento a Proyectos de Investigación', fase: 'Pares', color: '#a02020' },
  { titulo: 'Observatorio de Innovación Regional', fase: 'Comité ética', color: '#f2c94c' },
  { titulo: 'Red de Conocimiento Universitario', fase: 'Comité investigación', color: '#27ae60' },
]

function Perfil() {
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

      <div className="perfil-tabs">
        <button
          type="button"
          className={`perfil-tab ${tab === 'personal' ? 'perfil-tab-active' : ''}`}
          onClick={() => setTab('personal')}
        >
          Información personal
        </button>
        <button
          type="button"
          className={`perfil-tab ${tab === 'proyectos' ? 'perfil-tab-active' : ''}`}
          onClick={() => setTab('proyectos')}
        >
          Información proyectos
        </button>
      </div>

      <div className="perfil-content">
        {tab === 'personal' ? (
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
              <div className="perfil-field">
                <label>Rol</label>
                <select defaultValue="">
                  <option value="" disabled>Seleccione un rol</option>
                  <option value="administrador">Administrador</option>
                  <option value="docente">Docente</option>
                  <option value="investigador">Investigador</option>
                </select>
              </div>
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
            <div className="perfil-proyectos-header">
              <span>Título</span>
              <span>Fase Actual</span>
            </div>

            {proyectosUsuario.map((p) => (
              <div className="perfil-proyecto-row" key={p.titulo}>
                <span className="perfil-proyecto-titulo">{p.titulo}</span>
                <span className="perfil-proyecto-fase">{p.fase}</span>
                <span className="perfil-proyecto-color" style={{ background: p.color }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Perfil