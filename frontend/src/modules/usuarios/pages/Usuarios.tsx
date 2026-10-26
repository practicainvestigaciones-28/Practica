import { useState, useEffect } from 'react'
import {
  UserPlus, Search, User, FileText, SquarePen, Eye, Save, X as XIcon,
  Scale, Users as UsersIcon, UserCheck, Smile, Trash2, GraduationCap, UserCog,
} from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
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

// Esta pantalla se enfoca en los roles de comités/evaluación más
// Investigador y Líder de investigación: el Administrador se gestiona desde
// otra pantalla. Este orden es el que se usa tanto para las columnas como
// para la lista de checkboxes al crear/editar un usuario.
const ROLES_VISIBLES = ['Investigador', 'Líder de investigación', 'Comité de Investigación', 'Comité de Ética', 'Par Evaluador']

const formVacio: DatosUsuarioForm = {
  nombre: '',
  apellido: '',
  cedula: '',
  codigo: '',
  correo: '',
  roles: [],
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
  // Catálogo real de roles del backend (con id_rol numérico) — necesario
  // para PUT /usuarios/:id/roles, que exige ids y no nombres. Ya no se
  // guarda nada de esto en localStorage: antes había un catálogo local
  // aparte que se desincronizaba del real y terminaba duplicando roles.
  const [rolesSistema, setRolesSistema] = useState<usuariosApi.RolSistema[]>([])
  const [permisosCatalogo, setPermisosCatalogo] = useState<usuariosApi.PermisoSistema[]>([])
  const [rolPermisosAbierto, setRolPermisosAbierto] = useState<usuariosApi.RolSistema | null>(null)
  const [permisosDelRolAbierto, setPermisosDelRolAbierto] = useState<Set<number>>(new Set())
  const [nombreRolEditado, setNombreRolEditado] = useState('')
  const [errorRolPermisos, setErrorRolPermisos] = useState('')
  const [eliminarRolId, setEliminarRolId] = useState<number | null>(null)

  const [modoRolForm, setModoRolForm] = useState(false)
  const [nombreRolNuevo, setNombreRolNuevo] = useState('')
  const [verRolNuevo, setVerRolNuevo] = useState(true)
  const [editarRolNuevo, setEditarRolNuevo] = useState(true)
  const [errorRolForm, setErrorRolForm] = useState('')

  const [modoAsignarRol, setModoAsignarRol] = useState(false)
  const [busquedaSinRol, setBusquedaSinRol] = useState('')
  const [resultadosSinRol, setResultadosSinRol] = useState<usuariosApi.UsuarioBuscado[]>([])
  const [buscandoSinRol, setBuscandoSinRol] = useState(false)
  const [rolParaAsignar, setRolParaAsignar] = useState<Record<number, number>>({})
  const [asignandoId, setAsignandoId] = useState<number | null>(null)
  const [errorAsignar, setErrorAsignar] = useState('')

  // El rol Administrador no se asigna desde este formulario de registro: no
  // cualquiera que registre usuarios debería poder crear otro Administrador.
  // Se ordena según ROLES_VISIBLES (los que no estén en esa lista quedan al
  // final, en el orden en que vengan del backend).
  const roles = rolesSistema
    .filter((r) => r.estado && r.nombre !== 'Administrador')
    .sort((a, b) => {
      const ia = ROLES_VISIBLES.indexOf(a.nombre)
      const ib = ROLES_VISIBLES.indexOf(b.nombre)
      if (ia === -1 && ib === -1) return 0
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })

  const refrescarRolesSistema = () => {
    usuariosApi.listarRolesSistema().then(setRolesSistema).catch(() => {})
  }

  const idPermisoPorNombre = (nombre: 'ver' | 'editar'): number | undefined =>
    permisosCatalogo.find((p) => p.nombre === nombre)?.id_permiso

  const cargarPermisosDelRol = (id_rol: number) => {
    usuariosApi
      .listarPermisosDeRol(id_rol)
      .then((permisos) => setPermisosDelRolAbierto(new Set(permisos.map((p) => p.id_permiso))))
      .catch(() => setPermisosDelRolAbierto(new Set()))
  }

  const handleTogglePermisoRol = (tipo: 'ver' | 'editar') => {
    if (!rolPermisosAbierto) return
    const idPermiso = idPermisoPorNombre(tipo)
    if (!idPermiso) return
    const siguiente = new Set(permisosDelRolAbierto)
    if (siguiente.has(idPermiso)) siguiente.delete(idPermiso)
    else siguiente.add(idPermiso)
    setPermisosDelRolAbierto(siguiente)
    usuariosApi
      .asignarPermisosRol(rolPermisosAbierto.id_rol, [...siguiente])
      .catch(() => cargarPermisosDelRol(rolPermisosAbierto.id_rol))
  }

  const abrirRolPermisos = (rol: usuariosApi.RolSistema) => {
    setRolPermisosAbierto(rol)
    setNombreRolEditado(rol.nombre)
    setErrorRolPermisos('')
    cargarPermisosDelRol(rol.id_rol)
  }

  const cerrarRolPermisos = () => {
    setRolPermisosAbierto(null)
    setNombreRolEditado('')
    setPermisosDelRolAbierto(new Set())
  }

  const handleGuardarNombreRol = () => {
    if (!rolPermisosAbierto || !nombreRolEditado.trim()) return
    const nombre = nombreRolEditado.trim()
    usuariosApi
      .actualizarRolSistema(rolPermisosAbierto.id_rol, { nombre })
      .then(() => {
        refrescarRolesSistema()
        setRolPermisosAbierto((actual) => (actual ? { ...actual, nombre } : actual))
      })
      .catch((err) => setErrorRolPermisos(err instanceof Error ? err.message : 'No se pudo renombrar el rol.'))
  }

  const pedirEliminarRol = () => {
    if (!rolPermisosAbierto) return
    setEliminarRolId(rolPermisosAbierto.id_rol)
  }

  const cancelarEliminarRol = () => setEliminarRolId(null)

  const confirmarEliminarRol = () => {
    if (eliminarRolId !== null) {
      usuariosApi
        .cambiarEstadoRolSistema(eliminarRolId, false)
        .then(refrescarRolesSistema)
        .catch(() => {})
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

  const handleGuardarRolNuevo = async () => {
    if (!nombreRolNuevo.trim()) {
      setErrorRolForm('El nombre del rol es obligatorio.')
      return
    }
    try {
      const { rol } = await usuariosApi.crearRolSistema(nombreRolNuevo.trim())
      const idsPermisos = [
        verRolNuevo ? idPermisoPorNombre('ver') : undefined,
        editarRolNuevo ? idPermisoPorNombre('editar') : undefined,
      ].filter((id): id is number => id !== undefined)
      if (idsPermisos.length > 0) await usuariosApi.asignarPermisosRol(rol.id_rol, idsPermisos)
      refrescarRolesSistema()
      cerrarCrearRol()
    } catch (err) {
      setErrorRolForm(err instanceof Error ? err.message : 'No se pudo crear el rol.')
    }
  }

  const abrirAsignarRol = () => {
    setBusquedaSinRol('')
    setResultadosSinRol([])
    setErrorAsignar('')
    setModoAsignarRol(true)
  }

  const cerrarAsignarRol = () => setModoAsignarRol(false)

  // Busca entre TODOS los usuarios activos y se queda solo con quienes no
  // tienen ningún rol todavía — el listado principal de esta página los
  // excluye por diseño (ver nota en usuarios.service.ts), así que sin esto
  // no habría forma de encontrarlos para asignarles uno.
  useEffect(() => {
    if (!modoAsignarRol) return
    const termino = busquedaSinRol.trim()
    if (termino.length < 2) {
      setResultadosSinRol([])
      return
    }
    setBuscandoSinRol(true)
    const timeoutId = setTimeout(() => {
      usuariosApi
        .buscarUsuarios(termino)
        .then((res) => setResultadosSinRol(res.filter((u) => u.roles.length === 0)))
        .catch(() => setResultadosSinRol([]))
        .finally(() => setBuscandoSinRol(false))
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [busquedaSinRol, modoAsignarRol])

  const handleAsignarRol = (u: usuariosApi.UsuarioBuscado) => {
    const rolElegido = rolParaAsignar[u.id_usuario]
    if (!rolElegido) return
    setAsignandoId(u.id_usuario)
    setErrorAsignar('')
    usuariosApi
      .actualizarRolesUsuario(u.id_usuario, [rolElegido])
      .then(() => {
        setResultadosSinRol((prev) => prev.filter((r) => r.id_usuario !== u.id_usuario))
        refrescar()
      })
      .catch((err) => setErrorAsignar(err instanceof Error ? err.message : 'No se pudo asignar el rol.'))
      .finally(() => setAsignandoId(null))
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

    usuariosApi.listarRolesSistema().then(setRolesSistema).catch(() => setRolesSistema([]))
    usuariosApi.listarPermisosSistema().then(setPermisosCatalogo).catch(() => setPermisosCatalogo([]))
  }, [])

  /** Traduce nombres de rol (los que maneja este formulario) a los ids reales que exige el backend. */
  const resolverIdsRoles = (nombres: string[]): number[] =>
    nombres
      .map((nombre) => rolesSistema.find((r) => r.nombre === nombre)?.id_rol)
      .filter((id): id is number => id !== undefined)

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<DatosUsuarioForm>(formVacio)
  const [modal, setModal] = useState<ModalTipo>(null)
  const [correoEnviado, setCorreoEnviado] = useState(true)
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
    setForm({ ...formVacio })
    setErrorGuardar('')
    setCorreoEnviado(true)
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
    const faltantes: string[] = []
    if (!form.nombre.trim()) faltantes.push('Nombre')
    if (!form.apellido.trim()) faltantes.push('Apellido')
    if (!form.correo.trim()) faltantes.push('Correo')
    if (form.roles.length === 0) faltantes.push('Rol')

    if (faltantes.length > 0) {
      setErrorGuardar(`Completa los campos obligatorios: ${faltantes.join(', ')}.`)
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
        await usuariosApi.actualizarRolesUsuario(editandoId, resolverIdsRoles(form.roles))
      } else {
        const creado = await usuariosApi.crearUsuario({
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          correo: form.correo.trim(),
          roles: form.roles,
          codigo: form.codigo.trim() || undefined,
          cedula: form.cedula.trim() || undefined,
        })
        setCorreoEnviado(creado.correo_enviado)
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

  // Borrado definitivo: a diferencia de activar/desactivar, el backend lo
  // rechaza si el usuario tiene cualquier dato asociado (proyectos,
  // evaluaciones, participaciones, pagos...) — en ese caso solo queda
  // desactivarlo, así que el error del backend se muestra tal cual.
  const [eliminarUsuarioObjetivo, setEliminarUsuarioObjetivo] = useState<Usuario | null>(null)
  const [errorEliminar, setErrorEliminar] = useState('')

  const abrirEliminar = (u: Usuario) => {
    if (u.id === usuario?.id_usuario) {
      setErrorCarga('No puedes eliminar tu propia cuenta.')
      return
    }
    setErrorEliminar('')
    setEliminarUsuarioObjetivo(u)
  }

  const cancelarEliminarUsuario = () => {
    setEliminarUsuarioObjetivo(null)
    setErrorEliminar('')
  }

  const confirmarEliminarUsuario = async () => {
    if (!eliminarUsuarioObjetivo) return
    try {
      await usuariosApi.eliminarUsuario(eliminarUsuarioObjetivo.id)
      setEliminarUsuarioObjetivo(null)
      refrescar()
    } catch (err) {
      setErrorEliminar(err instanceof Error ? err.message : 'No se pudo eliminar el usuario.')
    }
  }

  const usuariosFiltrados = usuarios
    .filter((u) => u.roles.some((r) => ROLES_VISIBLES.includes(r)))
    .filter((u) => `${u.nombre} ${u.apellido}`.toLowerCase().includes(busqueda.toLowerCase()))

  const iconoPorRol: Record<string, typeof Scale> = {
    'Comité de Ética': Scale,
    'Comité de Investigación': UsersIcon,
    'Par Evaluador': UserCheck,
    'Investigador': GraduationCap,
    'Líder de investigación': UserCog,
  }

  const conteoPorRol = rolesSistema
    .filter((r) => ROLES_VISIBLES.includes(r.nombre))
    .sort((a, b) => ROLES_VISIBLES.indexOf(a.nombre) - ROLES_VISIBLES.indexOf(b.nombre))
    .map((r) => ({
      rol: r,
      cantidad: usuarios.filter((u) => u.roles.includes(r.nombre)).length,
      icon: iconoPorRol[r.nombre] ?? UsersIcon,
    }))

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

            <button type="button" className="usu-add-btn" onClick={abrirAsignarRol}>
              <UserCheck size={16} />
              Asignar rol
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

          {cargando && <p className="usu-empty">Cargando usuarios...</p>}
          {errorCarga && <p className="usu-empty">{errorCarga}</p>}

          {!cargando && (
            <div className="usu-columnas-grid">
              {conteoPorRol.map(({ rol, cantidad, icon: Icon }) => {
                const usuariosDelRol = usuariosFiltrados.filter((u) => u.roles.includes(rol.nombre))
                return (
                  <div className="usu-columna" key={rol.id_rol}>
                    <button
                      type="button"
                      className={`usu-stat-card usu-stat-card-clicable ${!rol.estado ? 'usu-stat-card-inactivo' : ''}`}
                      onClick={() => abrirRolPermisos(rol)}
                    >
                      <span className="usu-stat-icon"><Icon size={18} /></span>
                      <span className="usu-stat-valor">{cantidad}</span>
                      <span className="usu-stat-label">{rol.nombre}</span>
                    </button>

                    <div className="usu-columna-usuarios">
                      {usuariosDelRol.map((u) => (
                        <div className="usu-card-mini" key={u.id}>
                          <div className="usu-card-mini-top">
                            <div className="usu-avatar usu-avatar-mini">
                              <User size={18} strokeWidth={1.5} />
                            </div>
                            <span className="usu-card-mini-nombre">{u.nombre} {u.apellido}</span>
                          </div>

                          <div className="usu-card-mini-proyectos">
                            <FileText size={12} />
                            Total proyectos: <strong>{u.totalProyectos}</strong>
                          </div>

                          <div className="usu-card-mini-acciones">
                            <div className="usu-card-mini-botones">
                              <button
                                type="button"
                                className="usu-icon-btn"
                                aria-label="Editar usuario"
                                onClick={() => abrirEditar(u)}
                              >
                                <SquarePen size={14} />
                              </button>

                              <button
                                type="button"
                                className="usu-icon-btn"
                                aria-label="Ver usuario"
                                onClick={() => setVerUsuario(u)}
                              >
                                <Eye size={14} />
                              </button>

                              <button
                                type="button"
                                className="usu-icon-btn"
                                aria-label="Eliminar usuario"
                                title="Eliminar usuario (solo si no tiene nada asociado)"
                                disabled={u.id === usuario?.id_usuario}
                                onClick={() => abrirEliminar(u)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

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
                        </div>
                      ))}

                      {usuariosDelRol.length === 0 && <p className="usu-columna-vacio">Sin usuarios</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!cargando && !errorCarga && usuariosFiltrados.length === 0 && (
            <p className="usuarios-empty">No se encontraron usuarios.</p>
          )}

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
                        checked={permisosDelRolAbierto.has(idPermisoPorNombre('ver') ?? -1)}
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
                        checked={permisosDelRolAbierto.has(idPermisoPorNombre('editar') ?? -1)}
                        onChange={() => handleTogglePermisoRol('editar')}
                      />
                      <span className="usu-switch-slider" />
                    </label>
                  </li>
                </ul>

                <p className="usu-permisos-nota">
                  Haz clic sobre un permiso para concederlo o quitarlo a este rol.
                </p>

                {errorRolPermisos && <p className="usu-form-error">{errorRolPermisos}</p>}

                <button type="button" className="usu-rol-eliminar-btn" onClick={pedirEliminarRol}>
                  <Trash2 size={16} />
                  Desactivar rol
                </button>
              </div>
            </div>
          )}

          {eliminarRolId !== null && (
            <ConfirmModal
              mensaje={`¿Seguro que desea desactivar el rol "${rolPermisosAbierto?.nombre ?? ''}"? No se elimina: deja de poder asignarse a usuarios nuevos, pero quienes ya lo tienen lo conservan.`}
              botonSecundario={{ label: 'No', onClick: cancelarEliminarRol, variante: 'azul' }}
              botonPrimario={{ label: 'Sí, desactivar', onClick: confirmarEliminarRol, variante: 'rojo' }}
              onClose={cancelarEliminarRol}
            />
          )}

          {eliminarUsuarioObjetivo && errorEliminar && (
            <ConfirmModal
              mensaje={errorEliminar}
              botonPrimario={{ label: 'Cerrar', onClick: cancelarEliminarUsuario, variante: 'azul' }}
              onClose={cancelarEliminarUsuario}
            />
          )}

          {eliminarUsuarioObjetivo && !errorEliminar && (
            <ConfirmModal
              mensaje={`¿Eliminar definitivamente a ${eliminarUsuarioObjetivo.nombre} ${eliminarUsuarioObjetivo.apellido}? Esto solo funciona si no tiene ningún proyecto, evaluación, participación ni pago asociado en el sistema — si tiene algo, se rechazará y lo correcto es desactivarlo en vez de eliminarlo.`}
              botonSecundario={{ label: 'No', onClick: cancelarEliminarUsuario, variante: 'azul' }}
              botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminarUsuario, variante: 'rojo' }}
              onClose={cancelarEliminarUsuario}
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

          {modoAsignarRol && (
            <div className="usu-detalle-overlay">
              <div className="usu-detalle-box usu-asignar-box">
                <button
                  type="button"
                  className="usu-detalle-close"
                  onClick={cerrarAsignarRol}
                  aria-label="Cerrar"
                >
                  <XIcon size={16} />
                </button>

                <h2 className="usu-detalle-title">Asignar rol a un registrado</h2>

                <div className="usu-search usu-asignar-search">
                  <input
                    type="text"
                    placeholder="Buscar por nombre o correo..."
                    value={busquedaSinRol}
                    onChange={(e) => setBusquedaSinRol(e.target.value)}
                  />
                  <Search size={16} />
                </div>

                {errorAsignar && <p className="usu-form-error">{errorAsignar}</p>}

                <div className="usu-asignar-resultados">
                  {buscandoSinRol && <p className="usu-empty">Buscando...</p>}

                  {!buscandoSinRol && busquedaSinRol.trim().length >= 2 && resultadosSinRol.length === 0 && (
                    <p className="usu-empty">No hay registrados sin rol que coincidan.</p>
                  )}

                  {busquedaSinRol.trim().length < 2 && (
                    <p className="usu-empty">Escribe al menos 2 letras para buscar.</p>
                  )}

                  {!buscandoSinRol && resultadosSinRol.map((u) => (
                    <div className="usu-asignar-fila" key={u.id_usuario}>
                      <div className="usu-asignar-info">
                        <strong>{u.nombre} {u.apellido}</strong>
                        <span>{u.correo}</span>
                      </div>

                      <select
                        value={rolParaAsignar[u.id_usuario] ?? ''}
                        onChange={(e) =>
                          setRolParaAsignar((prev) => ({
                            ...prev,
                            [u.id_usuario]: Number(e.target.value),
                          }))
                        }
                      >
                        <option value="">Selecciona un rol</option>
                        {rolesSistema
                          .filter((r) => r.estado)
                          .map((r) => (
                            <option key={r.id_rol} value={r.id_rol}>
                              {r.nombre}
                            </option>
                          ))}
                      </select>

                      <button
                        type="button"
                        className="usu-asignar-btn"
                        disabled={!rolParaAsignar[u.id_usuario] || asignandoId === u.id_usuario}
                        onClick={() => handleAsignarRol(u)}
                      >
                        {asignandoId === u.id_usuario ? 'Asignando...' : 'Asignar'}
                      </button>
                    </div>
                  ))}
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
                      <label className="usu-rol-check" key={r.id_rol}>
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
                  : correoEnviado
                    ? 'Se ha registrado el usuario exitosamente. Se le envió un correo con su contraseña temporal y el enlace de acceso; deberá cambiarla al iniciar sesión por primera vez.'
                    : 'Se ha registrado el usuario, pero no se pudo enviar el correo con su contraseña temporal (revisa la configuración de correo del sistema). Avísale por otro medio o inténtalo de nuevo más tarde.'
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