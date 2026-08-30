import { useState } from 'react'
import { UserPlus, Search, User, FileText, SquarePen, Trash2, Eye, Save, X as XIcon } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import {
  getUsuarios,
  addUsuario,
  editarUsuario,
  eliminarUsuario,
  toggleUsuarioActivo,
  type Usuario,
  type DatosUsuarioForm,
} from '../lib/usuarios'
import { getRoles } from '../lib/roles'
import './Usuarios.css'

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

function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(getUsuarios())
  const [busqueda, setBusqueda] = useState('')

  const roles = getRoles()

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<DatosUsuarioForm>(formVacio)
  const [contrasenaForm, setContrasenaForm] = useState('')
  const [modal, setModal] = useState<ModalTipo>(null)

  const [verUsuario, setVerUsuario] = useState<Usuario | null>(null)
  const [eliminarId, setEliminarId] = useState<number | null>(null)

  const refrescar = () => setUsuarios([...getUsuarios()])

  const actualizarCampo = (campo: keyof DatosUsuarioForm, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  const resetForm = () => {
    setForm({ ...formVacio, rol: roles[0]?.nombre ?? '' })
    setContrasenaForm('')
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
    setEditandoId(u.id)
    setModoFormulario('editar')
  }

  const handleGuardar = () => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.correo.trim()) return

    // ⚠️ MODO PRUEBA — mientras el backend no esté listo.
    // La contraseña NO se guarda en localStorage a propósito. Aquí iría
    // el POST real (con la contraseña ya hasheada del lado del backend)
    // a algo como /api/usuarios.
    if (contrasenaForm) {
      console.log('Contraseña capturada (modo prueba, no se persiste en el navegador)')
    }

    if (modoFormulario === 'editar' && editandoId !== null) {
      editarUsuario(editandoId, form)
    } else {
      addUsuario(form)
    }

    refrescar()
    setModal('exito')
  }

  const handleSeguirRegistrando = () => {
    resetForm()
    setEditandoId(null)
    setModoFormulario('crear')
    setModal(null)
  }

  const handleOk = () => {
    setModal(null)
    setModoFormulario(null)
    setEditandoId(null)
  }

  const handleCancelarClick = () => {
    setModal('cancelar')
  }

  const handleCancelarNo = () => {
    setModal(null)
  }

  const handleCancelarSi = () => {
    setModal(null)
    setModoFormulario(null)
    setEditandoId(null)
    resetForm()
  }

  const handleToggleActivo = (id: number) => {
    toggleUsuarioActivo(id)
    refrescar()
  }

  const pedirEliminar = (id: number) => {
    setEliminarId(id)
  }

  const cancelarEliminar = () => {
    setEliminarId(null)
  }

  const confirmarEliminar = () => {
    if (eliminarId !== null) {
      eliminarUsuario(eliminarId)
      refrescar()
    }
    setEliminarId(null)
  }

  const usuariosFiltrados = usuarios.filter((u) =>
    `${u.nombre} ${u.apellido}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  const usuarioAEliminar = usuarios.find((u) => u.id === eliminarId) ?? null

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
              {usuariosFiltrados.map((u) => (
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

                  <button
                    type="button"
                    className="usu-delete-btn"
                    aria-label="Eliminar usuario"
                    onClick={() => pedirEliminar(u.id)}
                  >
                    <Trash2 size={16} />
                  </button>

                  <label className="usu-switch">
                    <input
                      type="checkbox"
                      checked={u.activo}
                      onChange={() => handleToggleActivo(u.id)}
                    />
                    <span className="usu-switch-slider" />
                  </label>
                </div>
              ))}

              {usuariosFiltrados.length === 0 && (
                <p className="usuarios-empty">No se encontraron usuarios.</p>
              )}
            </div>

            {eliminarId !== null && (
              <ConfirmModal
                mensaje={`¿Seguro que desea eliminar a "${usuarioAEliminar ? `${usuarioAEliminar.nombre} ${usuarioAEliminar.apellido}` : 'este usuario'}"?`}
                botonSecundario={{ label: 'No', onClick: cancelarEliminar, variante: 'azul' }}
                botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminar, variante: 'rojo' }}
                onClose={cancelarEliminar}
              />
            )}
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

                <div className="usu-field">
                  <label>Contraseña</label>
                  <input
                    type="password"
                    value={contrasenaForm}
                    onChange={(e) => setContrasenaForm(e.target.value)}
                    placeholder={modoFormulario === 'editar' ? 'Dejar en blanco para no cambiarla' : ''}
                  />
                </div>
              </div>
            </div>

            <div className="usu-registro-actions">
              <button type="button" className="usu-registro-guardar" onClick={handleGuardar}>
                <Save size={16} />
                {modoFormulario === 'editar' ? 'Guardar cambios' : 'Añadir usuario'}
              </button>
              <button type="button" className="usu-registro-cancelar" onClick={handleCancelarClick}>
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