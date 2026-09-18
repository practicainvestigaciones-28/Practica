import { useState, useEffect } from 'react'
import {
  UserPlus, Search, User, FileText, SquarePen, Eye, Save, X as XIcon,
  Shield, Scale, Users as UsersIcon, UserCheck, BookOpen, Smile, Trash2,
} from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import {
  getRoles, addRol, editarRol, eliminarRol, toggleRolActivo, togglePermiso,
  type Rol, type RolPermisos,
} from '../lib/roles'
import * as usuariosApi from '../lib/usuarios'
import { useAuth } from '../../auth/context/AuthContext'
import './Usuarios.css'

interface Usuario {
  id: number
  nombre: string
  apellido: string
  cedula: string
  codigo: string
  correo: string
  roles: string[]
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
  roles: string[]
}

type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

const formVacio: DatosUsuarioForm = {
  nombre: '',
  apellido: '',
  cedula: '',
  codigo: '',
  correo: '',
  roles: [],
}

// El admin ya no captura contraseña al crear un usuario: se genera una
// temporal aquí mismo (el backend la exige como campo obligatorio) y el
// usuario nuevo la reemplaza con "¿Olvidó su contraseña?" en el login.
function generarContrasenaTemporal(): string {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint32Array(20)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => caracteres[b % caracteres.length]).join('')
}

function mapearUsuario(u: usuariosApi.UsuarioListado): Usuario {
  return {
    id: u.id_usuario,
    nombre: u.nombre,
    apellido: u.apellido,
    cedula: u.cedula ?? '',
    codigo: u.codigo ?? '',
    correo: u.correo,
    roles: u.roles,
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
  const [todosLosRoles, setTodosLosRoles] = useState<Rol[]>(getRoles())
  const [rolPermisosAbierto, setRolPermisosAbierto] = useState<Rol | null>(null)
  const [nombreRolEditado, setNombreRolEditado] = useState('')
  const [eliminarRolId, setEliminarRolId] = useState<number | null>(null)

  const [modoRolForm, setModoRolForm] = useState(false)
  const [nombreRolNuevo, setNombreRolNuevo] = useState('')
  const [verRolNuevo, setVerRolNuevo] = useState(true)
  const [editarRolNuevo, setEditarRolNuevo] = useState(true)
  const [errorRolForm, setErrorRolForm] = useState('')

  const roles: Rol[] = todosLosRoles.filter((r) => r.activo)

  const refrescarRoles = () => setTodosLosRoles([...getRoles()])

  const handleTogglePermisoRol = (tipo: keyof RolPermisos) => {
    if (!rolPermisosAbierto) return
    togglePermiso(rolPermisosAbierto.id, tipo)
    refrescarRoles()
    setRolPermisosAbierto((actual) =>
      actual ? { ...actual, permisos: { ...actual.permisos, [tipo]: !actual.permisos[tipo] } } : actual
    )
  }

  const abrirRolPermisos = (rol: Rol) => {
    setRolPermisosAbierto(rol)
    setNombreRolEditado(rol.nombre)
  }

  const cerrarRolPermisos = () => {
    setRolPermisosAbierto(null)
    setNombreRolEditado('')
  }

  const handleGuardarNombreRol = () => {
    if (!rolPermisosAbierto || !nombreRolEditado.trim()) return
    const nombre = nombreRolEditado.trim()
    editarRol(rolPermisosAbierto.id, nombre, rolPermisosAbierto.permisos)
    refrescarRoles()
    setRolPermisosAbierto((actual) => (actual ? { ...actual, nombre } : actual))
  }

  const handleToggleActivoRol = () => {
    if (!rolPermisosAbierto) return
    toggleRolActivo(rolPermisosAbierto.id)
    refrescarRoles()
    setRolPermisosAbierto((actual) => (actual ? { ...actual, activo: !actual.activo } : actual))
  }

  const pedirEliminarRol = () => {
    if (!rolPermisosAbierto) return
    setEliminarRolId(rolPermisosAbierto.id)
  }

  const cancelarEliminarRol = () => setEliminarRolId(null)

  const confirmarEliminarRol = () => {
    if (eliminarRolId !== null) {
      eliminarRol(eliminarRolId)
      refrescarRoles()
    }
    setEliminarRolId(null)
    cerrarRolPermisos()
  }

  const abrirCrearRol = () => {
    setNombreRolNuevo('')
    setVerRolNuevo(true)
    setEditarRolNuevo(true)
    setErrorRolForm('')
    setModoRolForm(true)
  }

  const cerrarCrearRol = () => setModoRolForm(false)

  const handleGuardarRolNuevo = () => {
    if (!nombreRolNuevo.trim()) {
      setErrorRolForm('El nombre del rol es obligatorio.')
      return
    }
    addRol(nombreRolNuevo.trim(), { ver: verRolNuevo, editar: editarRolNuevo })
    refrescarRoles()
    cerrarCrearRol()
  }

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
  const [modal, setModal] = useState<ModalTipo>(null)
  const [contrasenaCreada, setContrasenaCreada] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')

  const [verUsuario, setVerUsuario] = useState<Usuario | null>(null)

  const actualizarCampo = (campo: Exclude<keyof DatosUsuarioForm, 'roles'>, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  const toggleRolForm = (nombreRol: string) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(nombreRol)
        ? prev.roles.filter((r) => r !== nombreRol)
        : [...prev.roles, nombreRol],
    }))
  }

  const resetForm = () => {
    setForm({ ...formVacio, roles: roles[0] ? [roles[0].nombre] : [] })
    setErrorGuardar('')
    setContrasenaCreada('')
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
      roles: u.roles,
    })
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

    if (form.roles.length === 0) {
      setErrorGuardar('Selecciona al menos un rol para el usuario.')
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
        })
        await usuariosApi.actualizarRolesUsuario(editandoId, form.roles)
      } else {
        const contrasenaTemporal = generarContrasenaTemporal()
        const creado = await usuariosApi.crearUsuario({
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          correo: form.correo.trim(),
          contraseña: contrasenaTemporal,
          rol: form.roles[0],
          codigo: form.codigo.trim() || undefined,
          cedula: form.cedula.trim() || undefined,
        })
        if (form.roles.length > 1) {
          await usuariosApi.actualizarRolesUsuario(creado.id_usuario, form.roles)
        }
        setContrasenaCreada(contrasenaTemporal)
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

  const iconoPorRol: Record<string, typeof Shield> = {
    'Administrador': Shield,
    'Comité de Ética': Scale,
    'Comité de Investigación': UsersIcon,
    'Par Evaluador': UserCheck,
    'Investigador': BookOpen,
  }

  const conteoPorRol = todosLosRoles.map((r) => ({
    rol: r,
    cantidad: usuarios.filter((u) => u.roles.includes(r.nombre)).length,
    icon: iconoPorRol[r.nombre] ?? UsersIcon,
  }))

  const totalProyectos = usuarios.reduce((suma, u) => suma + u.totalProyectos, 0)

  return (
    <div className="usuarios-page">
      {!modoFormulario ? (
        <>
          <div className="usuarios-toolbar">
            <button type="button" className="usu-add-btn" onClick={abrirCrear}>
              <UserPlus size={16} />
              Añadir usuario
            </button>

            <button type="button" className="usu-add-btn" onClick={abrirCrearRol}>
              <Smile size={16} />
              Añadir rol
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

          {!cargando && (
            <div className="usu-stats-grid">
              {conteoPorRol.map(({ rol, cantidad, icon: Icon }) => (
                <button
                  type="button"
                  className={`usu-stat-card usu-stat-card-clicable ${!rol.activo ? 'usu-stat-card-inactivo' : ''}`}
                  key={rol.id}
                  onClick={() => abrirRolPermisos(rol)}
                >
                  <span className="usu-stat-icon"><Icon size={18} /></span>
                  <span className="usu-stat-valor">{cantidad}</span>
                  <span className="usu-stat-label">{rol.nombre}</span>
                </button>
              ))}
              <div className="usu-stat-card usu-stat-card-proyectos">
                <span className="usu-stat-icon"><FileText size={18} /></span>
                <span className="usu-stat-valor">{totalProyectos}</span>
                <span className="usu-stat-label">Proyectos totales</span>
              </div>
            </div>
          )}

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

          {rolPermisosAbierto && (
            <div className="usu-detalle-overlay">
              <div className="usu-detalle-box">
                <button
                  type="button"
                  className="usu-detalle-close"
                  onClick={cerrarRolPermisos}
                  aria-label="Cerrar"
                >
                  <XIcon size={16} />
                </button>

                <div className="usu-rol-nombre-edit">
                  <input
                    type="text"
                    value={nombreRolEditado}
                    onChange={(e) => setNombreRolEditado(e.target.value)}
                  />
                  <button
                    type="button"
                    className="usu-icon-btn"
                    aria-label="Guardar nombre del rol"
                    title="Guardar nombre"
                    onClick={handleGuardarNombreRol}
                    disabled={!nombreRolEditado.trim() || nombreRolEditado.trim() === rolPermisosAbierto.nombre}
                  >
                    <Save size={16} />
                  </button>
                </div>

                <ul className="usu-permisos-lista">
                  <li className="usu-permiso-item">
                    <span>Ver</span>
                    <label className="usu-switch">
                      <input
                        type="checkbox"
                        checked={rolPermisosAbierto.permisos.ver}
                        onChange={() => handleTogglePermisoRol('ver')}
                      />
                      <span className="usu-switch-slider" />
                    </label>
                  </li>
                  <li className="usu-permiso-item">
                    <span>Editar</span>
                    <label className="usu-switch">
                      <input
                        type="checkbox"
                        checked={rolPermisosAbierto.permisos.editar}
                        onChange={() => handleTogglePermisoRol('editar')}
                      />
                      <span className="usu-switch-slider" />
                    </label>
                  </li>
                  <li className="usu-permiso-item">
                    <span>Rol activo</span>
                    <label className="usu-switch">
                      <input
                        type="checkbox"
                        checked={rolPermisosAbierto.activo}
                        onChange={handleToggleActivoRol}
                      />
                      <span className="usu-switch-slider" />
                    </label>
                  </li>
                </ul>

                <p className="usu-permisos-nota">
                  Haz clic sobre un permiso para concederlo o quitarlo a este rol.
                </p>

                <button type="button" className="usu-rol-eliminar-btn" onClick={pedirEliminarRol}>
                  <Trash2 size={16} />
                  Eliminar rol
                </button>
              </div>
            </div>
          )}

          {eliminarRolId !== null && (
            <ConfirmModal
              mensaje={`¿Seguro que desea eliminar el rol "${rolPermisosAbierto?.nombre ?? ''}"?`}
              botonSecundario={{ label: 'No', onClick: cancelarEliminarRol, variante: 'azul' }}
              botonPrimario={{ label: 'Sí', onClick: confirmarEliminarRol, variante: 'rojo' }}
              onClose={cancelarEliminarRol}
            />
          )}

          {modoRolForm && (
            <div className="usu-detalle-overlay">
              <div className="usu-detalle-box">
                <button
                  type="button"
                  className="usu-detalle-close"
                  onClick={cerrarCrearRol}
                  aria-label="Cerrar"
                >
                  <XIcon size={16} />
                </button>

                <h2 className="usu-detalle-title">Añadir rol</h2>

                <div className="usu-field">
                  <label>Nombre del rol</label>
                  <input
                    type="text"
                    value={nombreRolNuevo}
                    onChange={(e) => setNombreRolNuevo(e.target.value)}
                    placeholder="Ej. Comité de ética"
                  />
                </div>

                <ul className="usu-permisos-lista">
                  <li className="usu-permiso-item">
                    <span>Ver</span>
                    <label className="usu-switch">
                      <input
                        type="checkbox"
                        checked={verRolNuevo}
                        onChange={(e) => setVerRolNuevo(e.target.checked)}
                      />
                      <span className="usu-switch-slider" />
                    </label>
                  </li>
                  <li className="usu-permiso-item">
                    <span>Editar</span>
                    <label className="usu-switch">
                      <input
                        type="checkbox"
                        checked={editarRolNuevo}
                        onChange={(e) => setEditarRolNuevo(e.target.checked)}
                      />
                      <span className="usu-switch-slider" />
                    </label>
                  </li>
                </ul>

                {errorRolForm && <p className="usu-form-error">{errorRolForm}</p>}

                <div className="usu-registro-actions">
                  <button type="button" className="usu-registro-guardar" onClick={handleGuardarRolNuevo}>
                    <Save size={16} />
                    Añadir rol
                  </button>
                  <button type="button" className="usu-registro-cancelar" onClick={cerrarCrearRol}>
                    <XIcon size={16} />
                    Cancelar
                  </button>
                </div>
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

                <div className="usu-field usu-field-roles">
                  <label>Roles</label>
                  <div className="usu-roles-checks">
                    {roles.map((r) => (
                      <label className="usu-rol-check" key={r.id}>
                        <input
                          type="checkbox"
                          checked={form.roles.includes(r.nombre)}
                          onChange={() => toggleRolForm(r.nombre)}
                        />
                        <span>{r.nombre}</span>
                      </label>
                    ))}
                  </div>
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
                  : `Se ha registrado el usuario exitosamente. Contraseña temporal: ${contrasenaCreada} — compártala con el usuario para que pueda iniciar sesión.`
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