import { useState } from 'react'
import { Smile, Search, Lock, Pencil, Eye, SquarePen, Trash2, Save, X } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import {
  getRoles,
  addRol,
  editarRol,
  eliminarRol,
  toggleRolActivo,
  togglePermiso,
  type Rol,
  type RolPermisos,
} from '../lib/roles'
import './Roles.css'

type ModoFormulario = 'crear' | 'editar' | null

function Roles() {
  const [roles, setRoles] = useState<Rol[]>(getRoles())
  const [busqueda, setBusqueda] = useState('')

  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombreForm, setNombreForm] = useState('')
  const [editarForm, setEditarForm] = useState(true)
  const [verForm, setVerForm] = useState(true)

  const [verRol, setVerRol] = useState<Rol | null>(null)
  const [eliminarId, setEliminarId] = useState<number | null>(null)

  const refrescar = () => setRoles([...getRoles()])

  const resetForm = () => {
    setNombreForm('')
    setEditarForm(true)
    setVerForm(true)
  }

  const abrirCrear = () => {
    resetForm()
    setEditandoId(null)
    setModoFormulario('crear')
  }

  const abrirEditar = (r: Rol) => {
    setNombreForm(r.nombre)
    setEditarForm(r.permisos.editar)
    setVerForm(r.permisos.ver)
    setEditandoId(r.id)
    setModoFormulario('editar')
  }

  const cerrarForm = () => {
    setModoFormulario(null)
    setEditandoId(null)
    resetForm()
  }

  const handleGuardarForm = () => {
    if (!nombreForm.trim()) return
    const permisos: RolPermisos = { editar: editarForm, ver: verForm }

    if (modoFormulario === 'editar' && editandoId !== null) {
      editarRol(editandoId, nombreForm.trim(), permisos)
    } else {
      addRol(nombreForm.trim(), permisos)
    }

    refrescar()
    cerrarForm()
  }

  const handleTogglePermiso = (id: number, tipo: keyof RolPermisos) => {
    togglePermiso(id, tipo)
    refrescar()
  }

  const handleToggleActivo = (id: number) => {
    toggleRolActivo(id)
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
      eliminarRol(eliminarId)
      refrescar()
    }
    setEliminarId(null)
  }

  const rolesFiltrados = roles.filter((r) =>
    r.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const rolAEliminar = roles.find((r) => r.id === eliminarId) ?? null

  return (
    <div className="roles-page">
      <div className="roles-toolbar">
        <button type="button" className="rol-add-btn" onClick={abrirCrear}>
          <Smile size={16} />
          Añadir rol
        </button>

        <div className="rol-search">
          <input
            type="text"
            placeholder="Buscar rol"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <Search size={16} />
        </div>
      </div>

      <div className="roles-list-wrapper">
        <div className="roles-list">
          {rolesFiltrados.map((r) => (
            <div className="rol-card" key={r.id}>
              <span className="rol-nombre">{r.nombre}</span>

              <span className="rol-divider" />

              <div className="rol-permisos">
                <span className="rol-permisos-label">
                  <Lock size={12} />
                  Permisos
                </span>
                <div className="rol-permisos-toggles">
                  <button
                    type="button"
                    className={`rol-permiso-btn ${r.permisos.editar ? 'rol-permiso-activo' : ''}`}
                    onClick={() => handleTogglePermiso(r.id, 'editar')}
                    aria-label="Permiso de edición"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className={`rol-permiso-btn ${r.permisos.ver ? 'rol-permiso-activo' : ''}`}
                    onClick={() => handleTogglePermiso(r.id, 'ver')}
                    aria-label="Permiso de visualización"
                    title="Ver"
                  >
                    <Eye size={14} />
                  </button>
                </div>
              </div>

              <span className="rol-divider" />

              <button
                type="button"
                className="rol-icon-btn"
                aria-label="Editar rol"
                onClick={() => abrirEditar(r)}
              >
                <SquarePen size={16} />
              </button>

              <button
                type="button"
                className="rol-icon-btn"
                aria-label="Ver rol"
                onClick={() => setVerRol(r)}
              >
                <Eye size={16} />
              </button>

              <button
                type="button"
                className="rol-delete-btn"
                aria-label="Eliminar rol"
                onClick={() => pedirEliminar(r.id)}
              >
                <Trash2 size={16} />
              </button>

              <label className="rol-switch">
                <input
                  type="checkbox"
                  checked={r.activo}
                  onChange={() => handleToggleActivo(r.id)}
                />
                <span className="rol-switch-slider" />
              </label>
            </div>
          ))}

          {rolesFiltrados.length === 0 && (
            <p className="roles-empty">No se encontraron roles.</p>
          )}
        </div>

        {eliminarId !== null && (
          <ConfirmModal
            mensaje={`¿Seguro que desea eliminar el rol "${rolAEliminar?.nombre ?? ''}"?`}
            botonSecundario={{ label: 'No', onClick: cancelarEliminar, variante: 'azul' }}
            botonPrimario={{ label: 'Sí', onClick: confirmarEliminar, variante: 'rojo' }}
            onClose={cancelarEliminar}
          />
        )}
      </div>

      {modoFormulario && (
        <div className="rol-modal-overlay">
          <div className="rol-modal-box">
            <button type="button" className="rol-modal-close" onClick={cerrarForm} aria-label="Cerrar">
              <X size={16} />
            </button>

            <h2 className="rol-modal-title">
              {modoFormulario === 'editar' ? 'Editar rol' : 'Registro de rol'}
            </h2>

            <div className="rol-modal-field">
              <label>Nombre del rol</label>
              <input
                type="text"
                value={nombreForm}
                onChange={(e) => setNombreForm(e.target.value)}
                placeholder="Ej. Comité de ética"
              />
            </div>

            <div className="rol-modal-permisos">
              <span className="rol-modal-permisos-label">Permisos</span>

              <label className="rol-modal-checkbox">
                <input
                  type="checkbox"
                  checked={editarForm}
                  onChange={(e) => setEditarForm(e.target.checked)}
                />
                <Pencil size={14} />
                Editar
              </label>

              <label className="rol-modal-checkbox">
                <input
                  type="checkbox"
                  checked={verForm}
                  onChange={(e) => setVerForm(e.target.checked)}
                />
                <Eye size={14} />
                Ver
              </label>
            </div>

            <div className="rol-modal-actions">
              <button type="button" className="rol-modal-guardar" onClick={handleGuardarForm}>
                <Save size={16} />
                {modoFormulario === 'editar' ? 'Guardar cambios' : 'Añadir rol'}
              </button>
              <button type="button" className="rol-modal-cancelar" onClick={cerrarForm}>
                <X size={16} />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {verRol && (
        <div className="rol-modal-overlay">
          <div className="rol-modal-box">
            <button
              type="button"
              className="rol-modal-close"
              onClick={() => setVerRol(null)}
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>

            <h2 className="rol-modal-title">{verRol.nombre}</h2>

            <ul className="rol-modal-detalle">
              <li>
                <Pencil size={14} />
                Editar: <strong>{verRol.permisos.editar ? 'Sí' : 'No'}</strong>
              </li>
              <li>
                <Eye size={14} />
                Ver: <strong>{verRol.permisos.ver ? 'Sí' : 'No'}</strong>
              </li>
              <li>
                Estado: <strong>{verRol.activo ? 'Activo' : 'Inactivo'}</strong>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default Roles