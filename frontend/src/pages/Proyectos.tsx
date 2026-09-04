import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, Search, MessageCircle, FilePlus, SquarePen, Trash2, X } from 'lucide-react'
import { estadoConfig, ordenEstados, type Estado } from '../lib/estado'
import { getRole } from '../lib/auth'
import ConfirmModal from '../components/ConfirmModal'
import './Proyectos.css'
import './ModalidadTipoProyecto.css'
import * as convocatoriasApi from '../api/convocatorias'
import * as proyectosApi from '../api/proyectos'
import { useAuth } from '../context/AuthContext'
import {
  getModalidadTipoItems,
  addModalidadTipoItem,
  editarModalidadTipoItem,
  eliminarModalidadTipoItem,
  toggleModalidadTipoActivo,
  type ModalidadTipoItem,
  type CategoriaModalidadTipo,
} from '../lib/modalidadTipo'

/** Traduce el estado_actual real del backend al tipo Estado que usa la UI */
function mapearEstado(estadoBackend: string): Estado {
  switch (estadoBackend) {
    case 'revision':
      return 'En revisión'
    case 'aprobado':
    case 'finalizado':
      return 'Aprobado'
    case 'aprobado_con_correcciones':
      return 'Correcciones'
    case 'rechazado':
    case 'no_cumple':
      return 'Rechazado'
    default:
      return 'Pendiente'
  }
}

const textosMt: Record<CategoriaModalidadTipo, {
  tab: string
  addBtn: string
  buscarPlaceholder: string
  modalTituloCrear: string
  modalTituloEditar: string
  campoLabel: string
  exitoMensaje: string
}> = {
  modalidad: {
    tab: 'Modalidad de proyecto',
    addBtn: 'Añadir modalidad',
    buscarPlaceholder: 'Buscar modalidad de proyecto',
    modalTituloCrear: 'Registrar modalidad',
    modalTituloEditar: 'Editar modalidad',
    campoLabel: 'Nombre de la modalidad del proyecto:',
    exitoMensaje: 'Registro de modalidad exitoso.',
  },
  tipo: {
    tab: 'Tipo de proyecto',
    addBtn: 'Añadir proyecto',
    buscarPlaceholder: 'Buscar proyecto',
    modalTituloCrear: 'Registrar proyecto',
    modalTituloEditar: 'Editar proyecto',
    campoLabel: 'Nombre del proyecto:',
    exitoMensaje: 'Registro de proyecto exitoso.',
  },
}

type TabAdmin = 'proyectos' | 'modalidad'
type ModoFormulario = 'crear' | 'editar' | null
type ModalTipo = 'exito' | 'cancelar' | null

// ---------- Vista de administrador (tabla global de proyectos + catálogos) ----------

function ProyectosAdministrador() {
  const navigate = useNavigate()
  const [tabAdmin, setTabAdmin] = useState<TabAdmin>('proyectos')
  const [busqueda, setBusqueda] = useState('')
  const [proyectos, setProyectos] = useState<proyectosApi.ProyectoListado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    proyectosApi
      .listarProyectos({ limit: 100 })
      .then((res) => setProyectos(res.data))
      .catch(() => setError('No se pudieron cargar los proyectos.'))
      .finally(() => setCargando(false))
  }, [])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [archivoCargado, setArchivoCargado] = useState<string | null>(null)

  const handleCargarClick = () => {
    fileInputRef.current?.click()
  }

  const handleArchivoSeleccionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    console.log('Cargar proyectos desde archivo:', file.name)
    setArchivoCargado(file.name)
    e.target.value = ''
  }

  const proyectosFiltrados = proyectos.filter((p) =>
    [p.titulo, `${p.creador.nombre} ${p.creador.apellido}`, p.convocatoria?.nombre ?? ''].some((campo) =>
      campo.toLowerCase().includes(busqueda.toLowerCase())
    )
  )

  // ---------- Estado: Modalidad y tipo de proyecto ----------
  const [mtSubTab, setMtSubTab] = useState<CategoriaModalidadTipo>('modalidad')
  const [mtItems, setMtItems] = useState<ModalidadTipoItem[]>(getModalidadTipoItems())
  const [busquedaMt, setBusquedaMt] = useState('')
  const [mtModoFormulario, setMtModoFormulario] = useState<ModoFormulario>(null)
  const [mtEditandoId, setMtEditandoId] = useState<number | null>(null)
  const [mtNombreForm, setMtNombreForm] = useState('')
  const [mtModal, setMtModal] = useState<ModalTipo>(null)
  const [mtEliminarId, setMtEliminarId] = useState<number | null>(null)

  const tMt = textosMt[mtSubTab]

  const refrescarMt = () => setMtItems([...getModalidadTipoItems()])

  const abrirMtCrear = () => {
    setMtNombreForm('')
    setMtEditandoId(null)
    setMtModoFormulario('crear')
  }

  const abrirMtEditar = (item: ModalidadTipoItem) => {
    setMtNombreForm(item.nombre)
    setMtEditandoId(item.id)
    setMtModoFormulario('editar')
  }

  const cerrarMtForm = () => {
    setMtModoFormulario(null)
    setMtEditandoId(null)
    setMtNombreForm('')
    setMtModal(null)
  }

  const handleRegistrarMt = () => {
    if (!mtNombreForm.trim()) return

    if (mtModoFormulario === 'editar' && mtEditandoId !== null) {
      editarModalidadTipoItem(mtEditandoId, mtNombreForm.trim())
    } else {
      addModalidadTipoItem(mtNombreForm.trim(), mtSubTab)
    }

    refrescarMt()
    setMtModal('exito')
  }

  const handleMtSeguirRegistrando = () => {
    setMtNombreForm('')
    setMtEditandoId(null)
    setMtModoFormulario('crear')
    setMtModal(null)
  }

  const handleMtOk = () => {
    cerrarMtForm()
  }

  const handleMtCancelarClick = () => {
    setMtModal('cancelar')
  }

  const handleMtCancelarNo = () => {
    setMtModal(null)
  }

  const handleMtCancelarSi = () => {
    cerrarMtForm()
  }

  const handleToggleMt = (id: number) => {
    toggleModalidadTipoActivo(id)
    refrescarMt()
  }

  const pedirEliminarMt = (id: number) => {
    setMtEliminarId(id)
  }

  const cancelarEliminarMt = () => {
    setMtEliminarId(null)
  }

  const confirmarEliminarMt = () => {
    if (mtEliminarId !== null) {
      eliminarModalidadTipoItem(mtEliminarId)
      refrescarMt()
    }
    setMtEliminarId(null)
  }

  const mtItemsFiltrados = mtItems.filter(
    (i) => i.categoria === mtSubTab && i.nombre.toLowerCase().includes(busquedaMt.toLowerCase())
  )

  const mtItemAEliminar = mtItems.find((i) => i.id === mtEliminarId) ?? null

  return (
    <div className="proyectos-admin">
      <div className="proy-tabs">
        <button
          type="button"
          className={`proy-tab ${tabAdmin === 'proyectos' ? 'proy-tab-active' : ''}`}
          onClick={() => setTabAdmin('proyectos')}
        >
          Proyectos
        </button>
        <button
          type="button"
          className={`proy-tab ${tabAdmin === 'modalidad' ? 'proy-tab-active' : ''}`}
          onClick={() => setTabAdmin('modalidad')}
        >
          Modalidad y tipo de proyecto
        </button>
      </div>

      {tabAdmin === 'proyectos' && (
        <>
          <div className="proyectos-toolbar">
            <button
              type="button"
              className="btn-add-proyecto"
              onClick={() => navigate('/proyectos/nuevo')}
            >
              <Plus size={16} />
              Añadir proyecto
            </button>

            <button type="button" className="btn-upload-proyecto" onClick={handleCargarClick}>
              <Upload size={16} />
              Cargar proyectos
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="proyectos-file-input"
              onChange={handleArchivoSeleccionado}
            />

            <div className="proyectos-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Busca por título, convocatoria, investigador o fase"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>

          <div className="proyectos-table">
            <div className="proyectos-table-header">
              <span>Título</span>
              <span className="proyectos-header-investigador">Investigador</span>
              <div className="proyectos-fase-header">
                <span>Convocatoria</span>
                <div className="proyectos-estado-legend">
                  {ordenEstados.map((estado) => (
                    <span
                      key={estado}
                      className="proyectos-estado-segment"
                      style={{ background: estadoConfig[estado].color }}
                      title={estado}
                    />
                  ))}
                </div>
              </div>
            </div>

            {cargando && <p className="proyectos-empty">Cargando proyectos...</p>}
            {error && <p className="proyectos-empty">{error}</p>}

            {!cargando &&
              proyectosFiltrados.map((p) => {
                const estado = mapearEstado(p.estado_actual)
                return (
                  <button type="button" className="proyectos-row" key={p.id_proyecto}>
                    <span className="proyectos-row-titulo">{p.titulo}</span>
                    <span className="proyectos-row-investigador">
                      {p.creador.nombre} {p.creador.apellido}
                    </span>
                    <span className="proyectos-row-fase">{p.convocatoria?.nombre ?? '—'}</span>
                    <span
                      className="proyectos-row-estado"
                      style={{ background: estadoConfig[estado].color }}
                      title={`Estado: ${estado}`}
                    />
                  </button>
                )
              })}

            {!cargando && !error && proyectosFiltrados.length === 0 && (
              <p className="proyectos-empty">No se encontraron proyectos.</p>
            )}
          </div>

          {archivoCargado && (
            <ConfirmModal
              mensaje={`Archivo "${archivoCargado}" recibido correctamente.`}
              botonPrimario={{ label: 'Ok', onClick: () => setArchivoCargado(null), variante: 'azul' }}
              onClose={() => setArchivoCargado(null)}
            />
          )}
        </>
      )}

      {tabAdmin === 'modalidad' && (
        <div className="mt-page">
          <div className="proy-subtab-grid">
            <div className="proy-subtab-cell" style={{ gridColumn: 2 }}>
              <div className="mt-tabs">
                <button
                  type="button"
                  className={`mt-tab ${mtSubTab === 'modalidad' ? 'mt-tab-active' : ''}`}
                  onClick={() => setMtSubTab('modalidad')}
                >
                  Modalidad de proyecto
                </button>
                <button
                  type="button"
                  className={`mt-tab ${mtSubTab === 'tipo' ? 'mt-tab-active' : ''}`}
                  onClick={() => setMtSubTab('tipo')}
                >
                  Tipo de proyecto
                </button>
              </div>
            </div>
          </div>

          <div className="mt-toolbar">
            <button type="button" className="mt-add-btn" onClick={abrirMtCrear}>
              <FilePlus size={16} />
              {tMt.addBtn}
            </button>

            <div className="mt-search">
              <Search size={16} />
              <input
                type="text"
                placeholder={tMt.buscarPlaceholder}
                value={busquedaMt}
                onChange={(e) => setBusquedaMt(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-list-wrapper">
            <div className="mt-grid">
              {mtItemsFiltrados.map((item) => (
                <div className="mt-card" key={item.id}>
                  <span className="mt-nombre">{item.nombre}</span>

                  <div className="mt-actions">
                    <button
                      type="button"
                      className="mt-edit-btn"
                      aria-label="Editar"
                      onClick={() => abrirMtEditar(item)}
                    >
                      <SquarePen size={16} />
                    </button>

                    <button
                      type="button"
                      className="mt-delete-btn"
                      aria-label="Eliminar"
                      onClick={() => pedirEliminarMt(item.id)}
                    >
                      <Trash2 size={16} />
                    </button>

                    <label className="mt-switch">
                      <input
                        type="checkbox"
                        checked={item.activo}
                        onChange={() => handleToggleMt(item.id)}
                      />
                      <span className="mt-switch-slider" />
                    </label>
                  </div>
                </div>
              ))}

              {mtItemsFiltrados.length === 0 && (
                <p className="mt-empty">No se encontraron resultados.</p>
              )}
            </div>

            {mtEliminarId !== null && (
              <ConfirmModal
                mensaje={`¿Seguro que desea eliminar "${mtItemAEliminar?.nombre ?? 'este elemento'}"?`}
                botonSecundario={{ label: 'No', onClick: cancelarEliminarMt, variante: 'azul' }}
                botonPrimario={{ label: 'Sí, eliminar', onClick: confirmarEliminarMt, variante: 'rojo' }}
                onClose={cancelarEliminarMt}
              />
            )}
          </div>

          {mtModoFormulario && (
            <div className="mt-modal-overlay">
              <div className="mt-modal-wrapper">
                <div className="mt-modal-box">
                  <button type="button" className="mt-modal-close" onClick={cerrarMtForm} aria-label="Cerrar">
                    <X size={16} />
                  </button>

                  <h2 className="mt-modal-title">
                    {mtModoFormulario === 'editar' ? tMt.modalTituloEditar : tMt.modalTituloCrear}
                  </h2>

                  <div className="mt-modal-field">
                    <label>{tMt.campoLabel}</label>
                    <input
                      type="text"
                      value={mtNombreForm}
                      onChange={(e) => setMtNombreForm(e.target.value)}
                    />
                  </div>

                  <div className="mt-modal-actions">
                    <button type="button" className="mt-modal-registrar" onClick={handleRegistrarMt}>
                      {mtModoFormulario === 'editar' ? 'Guardar cambios' : 'Registrar'}
                    </button>
                    <button type="button" className="mt-modal-cancelar" onClick={handleMtCancelarClick}>
                      Cancelar
                    </button>
                  </div>
                </div>

                {mtModal === 'exito' && (
                  <ConfirmModal
                    mensaje={mtModoFormulario === 'editar' ? 'Se han guardado los cambios exitosamente.' : tMt.exitoMensaje}
                    botonSecundario={
                      mtModoFormulario === 'crear'
                        ? { label: 'Seguir registrando', onClick: handleMtSeguirRegistrando, variante: 'azul' }
                        : undefined
                    }
                    botonPrimario={{ label: 'Ok', onClick: handleMtOk, variante: 'rojo' }}
                    onClose={handleMtOk}
                  />
                )}

                {mtModal === 'cancelar' && (
                  <ConfirmModal
                    mensaje="Seguro quiere cancelar el registro?"
                    botonSecundario={{ label: 'No', onClick: handleMtCancelarNo, variante: 'azul' }}
                    botonPrimario={{ label: 'Sí', onClick: handleMtCancelarSi, variante: 'rojo' }}
                    onClose={handleMtCancelarNo}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- Vista de investigador (solo sus propios proyectos) ----------

function ProyectosInvestigador() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [nombreConvocatoriaActiva, setNombreConvocatoriaActiva] = useState<string | null>(null)
  const [cargandoConvocatoria, setCargandoConvocatoria] = useState(true)
  const [misProyectos, setMisProyectos] = useState<proyectosApi.ProyectoListado[]>([])
  const [cargandoProyectos, setCargandoProyectos] = useState(true)

  useEffect(() => {
    convocatoriasApi
      .listarConvocatorias()
      .then((lista) => {
        const activa = lista.find((c) => c.estado === 'activa')
        setNombreConvocatoriaActiva(activa ? activa.nombre : null)
      })
      .catch(() => setNombreConvocatoriaActiva(null))
      .finally(() => setCargandoConvocatoria(false))
  }, [])

  useEffect(() => {
    if (!usuario) return
    // TODO: el backend todavía no filtra por creado_por — mientras tanto se
    // trae una página grande y se filtra en el cliente. Si el sistema llega
    // a tener más de 100 proyectos activos, esto debería moverse a un
    // filtro real del lado del servidor.
    proyectosApi
      .listarProyectos({ limit: 100 })
      .then((res) => setMisProyectos(res.data.filter((p) => p.creador.id_usuario === usuario.id_usuario)))
      .catch(() => setMisProyectos([]))
      .finally(() => setCargandoProyectos(false))
  }, [usuario])

  return (
    <div className="proyectos-investigador">
      <div className="convocatoria-bar">
        <span className="convocatoria-label">
          Convocatoria Activa:{' '}
          <strong>
            {cargandoConvocatoria ? 'Cargando...' : nombreConvocatoriaActiva ?? 'No hay convocatoria activa'}
          </strong>
        </span>

        <button
          type="button"
          className="btn-crear-proyecto"
          onClick={() => navigate('/proyectos/nuevo')}
        >
          <FilePlus size={16} />
          Crear Proyecto
        </button>
      </div>

      <div className="info-proyectos-card">
        <div className="info-proyectos-header">
          <h2>Información proyectos</h2>
        </div>

        <div className="info-proyectos-table-header">
          <span>Título</span>
          <div className="fase-header">
            <span>Estado</span>
            <div className="fase-legend">
              {ordenEstados.map((estado) => (
                <span
                  key={estado}
                  className="fase-legend-swatch"
                  style={{ background: estadoConfig[estado].color }}
                  title={estado}
                />
              ))}
            </div>
          </div>
        </div>

        {cargandoProyectos && <p className="proyectos-empty">Cargando proyectos...</p>}

        {!cargandoProyectos && misProyectos.length === 0 ? (
          <p className="proyectos-empty">Todavía no tienes proyectos registrados.</p>
        ) : (
          misProyectos.map((p) => {
            const estado = mapearEstado(p.estado_actual)
            return (
              <div className="info-proyecto-row" key={p.id_proyecto}>
                <span className="info-proyecto-titulo">{p.titulo}</span>
                <span className="info-proyecto-fase">{p.convocatoria?.nombre ?? '—'}</span>
                <span
                  className="info-proyecto-color"
                  style={{ background: estadoConfig[estado].color }}
                  title={`Estado: ${estado}`}
                />
                <button
                  type="button"
                  className="info-proyecto-chat"
                  aria-label="Ver observaciones"
                  onClick={() => navigate('/proyectos/observaciones', { state: { titulo: p.titulo } })}
                >
                  <MessageCircle size={16} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ---------- Selector según el rol ----------

function Proyectos() {
  const role = getRole()
  return role === 'administrador' ? <ProyectosAdministrador /> : <ProyectosInvestigador />
}

export default Proyectos