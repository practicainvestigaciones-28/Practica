import { useEffect, useRef, useState } from 'react'
import { Save, User, Camera, Pencil, X as XIcon } from 'lucide-react'
import { estadoConfig, ordenEstados, type Estado } from '../../../shared/lib/estado'
import { getRole } from '../../auth/lib/auth'
import { useAuth } from '../../auth/context/AuthContext'
import * as authApi from '../../auth/api/auth'
import { ApiError } from '../../../shared/api/client'
import './Perfil.css'

type Tab = 'personal' | 'proyectos'

interface Proyecto {
  titulo: string
  fase: string
  estado: Estado
}

const proyectosUsuario: Proyecto[] = [
  { titulo: 'Sistema Integral de Gestión Académica', fase: 'Comité investigación', estado: 'Pendiente' },
  { titulo: 'Plataforma de Seguimiento a Proyectos de Investigación', fase: 'Pares', estado: 'Rechazado' },
  { titulo: 'Observatorio de Innovación Regional', fase: 'Comité ética', estado: 'En revisión' },
  { titulo: 'Red de Conocimiento Universitario', fase: 'Comité investigación', estado: 'Aprobado' },
  { titulo: 'Fortalecimiento de Semilleros de Investigación', fase: 'Comité ética', estado: 'Correcciones' },
]

interface DatosPerfilForm {
  nombre: string
  apellido: string
  cedula: string
  codigo: string
  correo: string
}

function Perfil() {
  const { usuario, actualizarUsuarioSesion } = useAuth()

  const role = getRole()
  const isAdmin = role === 'administrador'

  const [tab, setTab] = useState<Tab>('personal')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<DatosPerfilForm>({
    nombre: usuario?.nombre ?? '',
    apellido: usuario?.apellido ?? '',
    cedula: usuario?.cedula ?? '',
    codigo: usuario?.codigo ?? '',
    correo: usuario?.correo ?? '',
  })
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')
  const [exitoGuardar, setExitoGuardar] = useState(false)

  // Si el perfil del contexto cambia (ej. recién cargó tras el login), que el
  // formulario refleje esos valores en vez de quedarse con los campos vacíos
  // con los que se montó el componente la primera vez.
  useEffect(() => {
    if (!usuario) return
    setForm({
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      cedula: usuario.cedula ?? '',
      codigo: usuario.codigo ?? '',
      correo: usuario.correo,
    })
  }, [usuario])

  const actualizarCampo = (campo: keyof DatosPerfilForm, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    setExitoGuardar(false)
  }

  const handleActivarEdicion = () => {
    setErrorGuardar('')
    setExitoGuardar(false)
    setEditando(true)
  }

  const handleCancelarEdicion = () => {
    if (usuario) {
      setForm({
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        cedula: usuario.cedula ?? '',
        codigo: usuario.codigo ?? '',
        correo: usuario.correo,
      })
    }
    setErrorGuardar('')
    setEditando(false)
  }

  const handleGuardarPerfil = async () => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.correo.trim()) {
      setErrorGuardar('Nombre, apellido y correo son obligatorios.')
      return
    }
    setGuardando(true)
    setErrorGuardar('')
    try {
      const { usuario: actualizado } = await authApi.actualizarPerfil({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        correo: form.correo.trim(),
        codigo: form.codigo.trim() || undefined,
        cedula: form.cedula.trim() || undefined,
      })
      actualizarUsuarioSesion(actualizado)
      setExitoGuardar(true)
      setEditando(false)
    } catch (err) {
      setErrorGuardar(err instanceof ApiError ? err.message : 'No se pudo actualizar el perfil.')
    } finally {
      setGuardando(false)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setAvatarUrl(url)
  }

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

      <p className="perfil-username">
      {usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Usuario'}
      </p>

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
          <form
            className="perfil-form"
            onSubmit={(e) => {
              e.preventDefault()
              handleGuardarPerfil()
            }}
          >
            <div className="perfil-form-col">
              <div className="perfil-field">
                <label>Nombre</label>
                <input type="text" value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} readOnly={!editando} />
              </div>
              <div className="perfil-field">
                <label>Apellido</label>
                <input type="text" value={form.apellido} onChange={(e) => actualizarCampo('apellido', e.target.value)} readOnly={!editando} />
              </div>
              <div className="perfil-field">
                <label>Cédula</label>
                <input
                      type="text"
                      value={form.cedula}
                      onChange={(e) => actualizarCampo('cedula', e.target.value)}
                      readOnly={!editando}
                />
              </div>

              {!isAdmin && (
                <div className="perfil-field">
                  <label>Rol</label>
                  <input  type="text"
                          value={usuario?.roles?.join(', ') ?? ''}
                          readOnly
                          title="Para cambiar tu rol, contacta al Administrador."
                  />
                </div>
              )}
            </div>

            <div className="perfil-form-col">
              <div className="perfil-field">
                <label>Código (si aplica)</label>
                <input
                      type="text"
                      value={form.codigo}
                      onChange={(e) => actualizarCampo('codigo', e.target.value)}
                      readOnly={!editando}
                />
              </div>
              <div className="perfil-field">
                <label>Correo</label>
                <input  type="email"
                        value={form.correo}
                        onChange={(e) => actualizarCampo('correo', e.target.value)}
                        readOnly={!editando}
                />
              </div>

              {errorGuardar && <p className="perfil-form-error">{errorGuardar}</p>}
              {exitoGuardar && <p className="perfil-form-exito">Datos actualizados correctamente.</p>}

              {editando ? (
                <div className="perfil-form-acciones">
                  <button type="button" className="perfil-cancelar-btn" onClick={handleCancelarEdicion} disabled={guardando}>
                    <XIcon size={16} />
                    Cancelar
                  </button>
                  <button type="submit" className="perfil-save-btn" disabled={guardando}>
                    <Save size={16} />
                    {guardando ? 'Guardando...' : 'Actualizar datos'}
                  </button>
                </div>
              ) : (
                <button type="button" className="perfil-save-btn" onClick={handleActivarEdicion}>
                  <Pencil size={16} />
                  Editar datos
                </button>
              )}
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