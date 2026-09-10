import { useState, useEffect } from 'react'
import { UserPlus, Search, User, FileText, SquarePen, Eye, Save, X as XIcon } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import { getRoles, type Rol } from '../lib/roles'
import * as usuariosApi from '../lib/usuarios'
import { useAuth } from '../context/AuthContext'
import './Usuarios.css'

interface Usuario {
  id: number
  nombre: string
  apellido: string
  cedula: string
  codigo: string
  correo: string
  rol: string
  totalProyectos: number
  activo: boolean
}

interface DatosUsuarioForm {
  nombre: string
  apellido: string
  cedula: string
  codigo: string
  correo: string
  rol: string
}

type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

const formVacio: DatosUsuarioForm = {
  nombre: '',
  apellido: '',
  cedula: '',
  codigo: '',
  correo: '',
  rol: '',
}

function mapearUsuario(u: usuariosApi.UsuarioListado): Usuario {
  return {
    id: u.id_usuario,
    nombre: u.nombre,
    apellido: u.apellido,
    cedula: u.cedula ?? '',
    codigo: u.codigo ?? '',
    correo: u.correo,
    rol: u.roles.join(', ') || 'Sin rol asignado',
    totalProyectos: u.totalProyectos,
    activo: u.activo,
  }
}

function Usuarios() {
  const { usuario } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const roles: Rol[] = getRoles().filter((r) => r.activo)

  const refrescar = () => {
    usuariosApi
      .listarUsuarios({ limit: 100 })
      .then((res) => setUsuarios(res.data.map(mapearUsuario)))
      .catch((err) => setErrorCarga(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios.'))
  }

  useEffect(() => {
    usuariosApi
      .listarUsuarios({ limit: 100 })
      .then((res) => setUsuarios(res.data.map(mapearUsuario)))
      .catch((err) => setErrorCarga(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios.'))
      .finally(() => setCargando(false))
  }, [])

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<DatosUsuarioForm>(formVacio)
  const [contrasenaForm, setContrasenaForm] = useState('')
  const [modal, setModal] = useState<ModalTipo>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')

  const [verUsuario, setVerUsuario] = useState<Usuario | null>(null)

  const actualizarCampo = (campo: keyof DatosUsuarioForm, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  const resetForm = () => {
    setForm({ ...formVacio, rol: roles[0]?.nombre ?? '' })
    setContrasenaForm('')
    setErrorGuardar('')
  }

  const abrirCrear = () => {
    resetForm()
    setEditandoId(null)
    setModoFormulario('crear')
  }

  const abrirEditar = (u: Usuario) => {
    setForm({
      nombre: u.nombre,
      apellido: u.apellido,
      cedula: u.cedula,
      codigo: u.codigo,
      correo: u.correo,
      rol: u.rol,
    })
    setContrasenaForm('')
    setErrorGuardar('')
    setEditandoId(u.id)
    setModoFormulario('editar')
  }

  const cerrarForm = () => {
    setModoFormulario(null)
    setEditandoId(null)
    setModal(null)
    resetForm()
  }

  const handleGuardar = async () => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.correo.trim()) return

    if (modoFormulario === 'crear' && !contrasenaForm.trim()) {
      setErrorGuardar('La contraseña es obligatoria para crear un usuario.')
      return
    }

    setGuardando(true)
    setErrorGuardar('')
    try {
      if (modoFormulario === 'editar' && editandoId !== null) {
        await usuariosApi.actualizarUsuario(editandoId, {
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          correo: form.correo.trim(),
          codigo: form.codigo.trim() || undefined,
          cedula: form.cedula.trim() || undefined,
          rol: form.rol || undefined,
          ...(contrasenaForm.trim() ? { contraseña: contrasenaForm.trim() } : {}),
        })
      } else {
        await usuariosApi.crearUsuario({
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          correo: form.correo.trim(),
          contraseña: contrasenaForm.trim(),
          rol: form.rol,
          codigo: form.codigo.trim() || undefined,
          cedula: form.cedula.trim() || undefined,
        })
      }

      refrescar()
      setModal('exito')
    } catch (err) {
      setErrorGuardar(err instanceof Error ? err.message : 'No se pudo guardar el usuario.')
    } finally {
      setGuardando(false)
    }
  }

  const handleSeguirRegistrando = () => {
    resetForm()
    setEditandoId(null)
    setModoFormulario('crear')
    setModal(null)
  }

  const handleOk = () => {
    cerrarForm()
  }

  const handleCancelarClick = () => {
    setModal('cancelar')
  }

  const handleCancelarNo = () => {
    setModal(null)
  }

  const handleCancelarSi = () => {
    cerrarForm()
  }

  const handleToggleActivo = async (u: Usuario) => {
    // RQF05 - un administrador no puede desactivar su propia cuenta (se
    // quedaría sin poder volver a entrar, ya que el login bloquea cuentas
    // inactivas). El backend también lo valida; esto es solo para no
    // dejar ni siquiera intentarlo desde la UI.
    if (u.id === usuario?.id_usuario) {
      setErrorCarga('No puedes desactivar tu propia cuenta.')
      return
    }

    try {
      await usuariosApi.cambiarEstadoUsuario(u.id, !u.activo)
      refrescar()
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : 'No se pudo cambiar el estado del usuario.')
    }
  }

  const usuariosFiltrados = usuarios.filter((u) =>
    `${u.nombre} ${u.apellido}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="usuarios-page">
      {!modoFormulario ? (
        <>
          <div className="usuarios-toolbar">
            <button type="button" className="usu-add-btn" onClick={abrirCrear}>
              <UserPlus size={16} />
              Añadir usuario
            </button>

            <div className="usu-search">
              <input
                type="text"
                placeholder="Buscar usuario"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <Search size={16} />
            </div>
          </div>

          <div className="usu-list-wrapper">
            <div className="usuarios-list">
              {cargando && <p className="usu-empty">Cargando usuarios...</p>}
              {errorCarga && <p className="usu-empty">{errorCarga}</p>}
              {!cargando && usuariosFiltrados.map((u) => (
                <div className="usu-card" key={u.id}>
                  <div className="usu-avatar">
                    <User size={22} strokeWidth={1.5} />
                  </div>

                  <span className="usu-nombre">{u.nombre} {u.apellido}</span>

                  <span className="usu-divider" />

                  <div className="usu-proyectos">
                    <FileText size={14} />
                    <span className="usu-proyectos-label">Total proyectos</span>
                    <span className="usu-proyectos-count">{u.totalProyectos}</span>
                  </div>

                  <button
                    type="button"
                    className="usu-icon-btn"
                    aria-label="Editar usuario"
                    onClick={() => abrirEditar(u)}
                  >
                    <SquarePen size={16} />
                  </button>

                  <button
                    type="button"
                    className="usu-icon-btn"
                    aria-label="Ver usuario"
                    onClick={() => setVerUsuario(u)}
                  >
                    <Eye size={16} />
                  </button>

                  <label
                    className="usu-switch"
                    title={u.id === usuario?.id_usuario ? 'No puedes desactivar tu propia cuenta' : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={u.activo}
                      disabled={u.id === usuario?.id_usuario}
                      onChange={() => handleToggleActivo(u)}
                    />
                    <span className="usu-switch-slider" />
                  </label>
                </div>
              ))}

              {!cargando && !errorCarga && usuariosFiltrados.length === 0 && (
                <p className="usuarios-empty">No se encontraron usuarios.</p>
              )}
            </div>
          </div>

          {verUsuario && (
            <div className="usu-detalle-overlay">
              <div className="usu-detalle-box">
                <button
                  type="button"
                  className="usu-detalle-close"
                  onClick={() => setVerUsuario(null)}
                  aria-label="Cerrar"
                >
                  <XIcon size={16} />
                </button>

                <h2 className="usu-detalle-title">{verUsuario.nombre} {verUsuario.apellido}</h2>

                <ul className="usu-detalle-lista">
                  <li>Cédula: <strong>{verUsuario.cedula || '—'}</strong></li>
                  <li>Código: <strong>{verUsuario.codigo || '—'}</strong></li>
                  <li>Correo: <strong>{verUsuario.correo}</strong></li>
                  <li>Rol: <strong>{verUsuario.rol}</strong></li>
                  <li>Total proyectos: <strong>{verUsuario.totalProyectos}</strong></li>
                  <li>Estado: <strong>{verUsuario.activo ? 'Activo' : 'Inactivo'}</strong></li>
                </ul>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="usu-registro-wrapper">
          <div className="usu-registro-card">
            <h2 className="usu-registro-title">
              {modoFormulario === 'editar' ? 'Editar usuario' : 'Formulario registro de usuarios'}
            </h2>

            <div className="usu-form">
              <div className="usu-form-col">
                <div className="usu-field">
                  <label>Nombre</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => actualizarCampo('nombre', e.target.value)}
                  />
                </div>

                <div className="usu-field">
                  <label>Apellido</label>
                  <input
                    type="text"
                    value={form.apellido}
                    onChange={(e) => actualizarCampo('apellido', e.target.value)}
                  />
                </div>

                <div className="usu-field">
                  <label>Cédula</label>
                  <input
                    type="text"
                    value={form.cedula}
                    onChange={(e) => actualizarCampo('cedula', e.target.value)}
                  />
                </div>

                <div className="usu-field">
                  <label>Rol</label>
                  <select
                    value={form.rol}
                    onChange={(e) => actualizarCampo('rol', e.target.value)}
                  >
                    <option value="" disabled>Seleccione un rol</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.nombre}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="usu-form-col">
                <div className="usu-field">
                  <label>Código (si aplica)</label>
                  <input
                    type="text"
                    value={form.codigo}
                    onChange={(e) => actualizarCampo('codigo', e.target.value)}
                  />
                </div>

                <div className="usu-field">
                  <label>Correo</label>
                  <input
                    type="email"
                    value={form.correo}
                    onChange={(e) => actualizarCampo('correo', e.target.value)}
                  />
                </div>

                {modoFormulario === 'crear' && (
                  <div className="usu-field">
                    <label>Contraseña</label>
                    <input
                      type="password"
                      value={contrasenaForm}
                      onChange={(e) => setContrasenaForm(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {errorGuardar && <p className="usu-form-error">{errorGuardar}</p>}

            <div className="usu-registro-actions">
              <button type="button" className="usu-registro-guardar" onClick={handleGuardar} disabled={guardando}>
                <Save size={16} />
                {guardando ? 'Guardando...' : modoFormulario === 'editar' ? 'Guardar cambios' : 'Añadir usuario'}
              </button>
              <button type="button" className="usu-registro-cancelar" onClick={handleCancelarClick} disabled={guardando}>
                <XIcon size={16} />
                Cancelar
              </button>
            </div>
          </div>

          {modal === 'exito' && (
            <ConfirmModal
              mensaje={
                modoFormulario === 'editar'
                  ? 'Se han guardado los cambios exitosamente.'
                  : 'Se ha registrado el usuario exitosamente.'
              }
              botonSecundario={
                modoFormulario === 'crear'
                  ? { label: 'Seguir registrando', onClick: handleSeguirRegistrando, variante: 'azul' }
                  : undefined
              }
              botonPrimario={{ label: 'Ok', onClick: handleOk, variante: 'rojo' }}
              onClose={handleOk}
            />
          )}

          {modal === 'cancelar' && (
            <ConfirmModal
              mensaje="Seguro quiere cancelar el registro?"
              botonSecundario={{ label: 'No', onClick: handleCancelarNo, variante: 'azul' }}
              botonPrimario={{ label: 'Sí', onClick: handleCancelarSi, variante: 'rojo' }}
              onClose={handleCancelarNo}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default Usuarios