import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Upload, Search, MessageCircle, FilePlus, SquarePen, Trash2, X,
  Eye, ArrowLeft, Download, Check, CheckCheck,
} from 'lucide-react'
import { estadoConfig, ordenEstados, mapearEstado } from '../lib/estado'
import { getRole } from '../lib/auth'
import ConfirmModal from '../components/ConfirmModal'
import './Proyectos.css'
import './ModalidadTipoProyecto.css'
import * as convocatoriasApi from '../lib/convocatorias'
import * as catalogosApi from '../api/catalogos'
import * as proyectosApi from '../api/proyectos'
import * as documentosApi from '../api/documentos'
import * as evaluacionesApi from '../api/evaluaciones'
import * as observacionesApi from '../api/observaciones'
import { ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  getModalidadTipoItems,
  addModalidadTipoItem,
  editarModalidadTipoItem,
  eliminarModalidadTipoItem,
  toggleModalidadTipoActivo,
  sincronizarConBackend,
  type ModalidadTipoItem,
  type CategoriaModalidadTipo,
} from '../lib/modalidadTipo'

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

type TabAdmin = 'proyectos' | 'modalidad' | 'postulados'
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

  // Misma luz intermitente que en la vista del investigador — va
  // resaltando un estado a la vez en la leyenda, con su nombre debajo.
  const [indiceEstadoResaltado, setIndiceEstadoResaltado] = useState(0)

  useEffect(() => {
    const intervalo = setInterval(() => {
      setIndiceEstadoResaltado((i) => (i + 1) % ordenEstados.length)
    }, 1400)
    return () => clearInterval(intervalo)
  }, [])

  const estadoResaltado = ordenEstados[indiceEstadoResaltado]

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

  // Empareja los ids de la lista local (con la que esta pantalla edita/
  // desactiva/elimina) con los ids reales del backend, buscando por nombre.
  // Sin esto, el investigador podría terminar enviando un id_modalidad que
  // no existe de verdad al crear un proyecto.
  useEffect(() => {
    Promise.all([catalogosApi.listarModalidadesProyecto(), catalogosApi.listarTiposProyecto()])
      .then(([modalidadesReales, tiposReales]) => {
        sincronizarConBackend(modalidadesReales, tiposReales)
        refrescarMt()
      })
      .catch(() => {})
  }, [])

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

  const handleRegistrarMt = async () => {
    const nombre = mtNombreForm.trim()
    if (!nombre) return

    if (mtModoFormulario === 'editar' && mtEditandoId !== null) {
      editarModalidadTipoItem(mtEditandoId, nombre)
    } else {
      // Se registra primero en el backend real para obtener su id
      // verdadero — así lo que quede en la lista local ya sirve para
      // crear un proyecto de una vez. Esta pantalla sigue editando/
      // desactivando/eliminando solo en local (todavía no hay endpoints
      // reales para eso); si el registro en backend falla (ej. ya existe
      // con ese nombre, sin conexión), igual se agrega en local para que
      // el admin no se quede sin ver su cambio.
      let idReal: number | undefined
      try {
        const crearEnBackend =
          mtSubTab === 'modalidad' ? catalogosApi.crearModalidadProyecto : catalogosApi.crearTipoProyecto
        const respuesta = await crearEnBackend(nombre)
        idReal = mtSubTab === 'modalidad' ? respuesta.registro.id_modalidad : respuesta.registro.id_tipo_proyecto
      } catch {
        // sigue sin id real — se sincronizará solo si más tarde alguien
        // agrega uno con el mismo nombre desde el backend
      }
      addModalidadTipoItem(nombre, mtSubTab, idReal)
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

  // ---------- Estado: Proyectos postulados (revisión de documentos) ----------
  // Reutiliza la misma lista `proyectos` que ya trae la pestaña "Proyectos"
  // (no hace falta otro fetch) — "postulado" = proyecto recién enviado,
  // todavía sin pasar la revisión documental inicial (estado_actual === 'pendiente').
  const [busquedaPostulado, setBusquedaPostulado] = useState('')
  const [postuladoAbiertoId, setPostuladoAbiertoId] = useState<number | null>(null)
  const [documentos, setDocumentos] = useState<documentosApi.DocumentoProyecto[]>([])
  const [cargandoDocumentos, setCargandoDocumentos] = useState(false)
  const [errorDocumentos, setErrorDocumentos] = useState('')

  const refrescarDocumentos = (idProyecto: number) => {
    setCargandoDocumentos(true)
    setErrorDocumentos('')
    documentosApi
      .listarDocumentosProyecto(idProyecto)
      .then(setDocumentos)
      .catch((err) => setErrorDocumentos(err instanceof ApiError ? err.message : 'No se pudieron cargar los documentos.'))
      .finally(() => setCargandoDocumentos(false))
  }

  // Etapas sembradas en el backend (prisma/seed.ts): 1 = General/Inicial,
  // 2 = Comité de Investigación, 3 = Ética, 4 = Pares.
  const ETAPA_GENERAL_INICIAL = 1
  const ETAPA_COMITE_INVESTIGACION = 2

  const [consolidado, setConsolidado] = useState<evaluacionesApi.EstadoConsolidado | null>(null)
  const [enviandoAsignacion, setEnviandoAsignacion] = useState(false)
  const [errorAsignacion, setErrorAsignacion] = useState('')

  const [observaciones, setObservaciones] = useState<observacionesApi.ObservacionProyecto[]>([])
  const [docObservacionAbierto, setDocObservacionAbierto] = useState<number | null>(null)
  const [textoObservacion, setTextoObservacion] = useState('')
  const [enviandoObservacion, setEnviandoObservacion] = useState(false)

  const refrescarConsolidado = (idProyecto: number) => {
    evaluacionesApi
      .obtenerEstadoConsolidado(idProyecto)
      .then(setConsolidado)
      .catch(() => setConsolidado(null))
  }

  const refrescarObservaciones = (idProyecto: number) => {
    observacionesApi
      .listarObservacionesProyecto(idProyecto)
      .then(setObservaciones)
      .catch(() => setObservaciones([]))
  }

  const abrirRevisionDocumentos = (id: number) => {
    setPostuladoAbiertoId(id)
    refrescarDocumentos(id)
    refrescarConsolidado(id)
    refrescarObservaciones(id)
  }

  const volverAPostulados = () => {
    setPostuladoAbiertoId(null)
    setDocumentos([])
    setConsolidado(null)
    setObservaciones([])
    setDocObservacionAbierto(null)
    setErrorAsignacion('')
  }

  /** RQF44 - el botón "Aceptar y enviar a Comité": ya revisó los documentos
   * iniciales, así que abre la etapa de Comité de Investigación. */
  const handleAceptarYEnviarComite = () => {
    if (postuladoAbiertoId === null) return
    setEnviandoAsignacion(true)
    setErrorAsignacion('')
    evaluacionesApi
      .asignarProyectoAEtapa(postuladoAbiertoId, { id_etapa: ETAPA_COMITE_INVESTIGACION })
      .then(() => refrescarConsolidado(postuladoAbiertoId))
      .catch((err) => setErrorAsignacion(err instanceof ApiError ? err.message : 'No se pudo enviar el proyecto a comité.'))
      .finally(() => setEnviandoAsignacion(false))
  }

  const toggleObservacionDoc = (idDocumento: number) => {
    setDocObservacionAbierto((actual) => (actual === idDocumento ? null : idDocumento))
    setTextoObservacion('')
  }

  const handleAgregarObservacion = (idDocumento: number) => {
    if (postuladoAbiertoId === null || !textoObservacion.trim()) return
    setEnviandoObservacion(true)
    observacionesApi
      .crearObservacion(postuladoAbiertoId, idDocumento, {
        id_etapa: ETAPA_GENERAL_INICIAL,
        observacion: textoObservacion.trim(),
      })
      .then(() => {
        refrescarObservaciones(postuladoAbiertoId)
        setTextoObservacion('')
        setDocObservacionAbierto(null)
      })
      .catch((err) => setErrorDocumentos(err instanceof ApiError ? err.message : 'No se pudo registrar la observación.'))
      .finally(() => setEnviandoObservacion(false))
  }

  const handleValidarDocumento = (idProyectoDocumento: number, aprobado: boolean) => {
    if (postuladoAbiertoId === null) return
    documentosApi
      .validarDocumento(postuladoAbiertoId, idProyectoDocumento, aprobado)
      .then(() => refrescarDocumentos(postuladoAbiertoId))
      .catch((err) => setErrorDocumentos(err instanceof ApiError ? err.message : 'No se pudo actualizar el documento.'))
  }

  const handleAprobarTodo = () => {
    if (postuladoAbiertoId === null) return
    Promise.all(documentos.map((d) => documentosApi.validarDocumento(postuladoAbiertoId, d.id_proyecto_documento, true)))
      .then(() => refrescarDocumentos(postuladoAbiertoId))
      .catch((err) => setErrorDocumentos(err instanceof ApiError ? err.message : 'No se pudieron aprobar los documentos.'))
  }

  const handleDescargarDocumento = (doc: documentosApi.DocumentoProyecto) => {
    if (postuladoAbiertoId === null) return
    const extension = doc.archivo.includes('.') ? doc.archivo.slice(doc.archivo.lastIndexOf('.')) : ''
    documentosApi
      .descargarDocumentoProyecto(postuladoAbiertoId, doc.id_proyecto_documento, `${doc.tipoDocumento.nombre}${extension}`)
      .catch((err) => setErrorDocumentos(err instanceof ApiError ? err.message : 'No se pudo descargar el archivo.'))
  }

  const postulados = proyectos.filter((p) => p.estado_actual === 'pendiente')

  const postuladosFiltrados = postulados.filter((p) =>
    [p.titulo, `${p.creador.nombre} ${p.creador.apellido}`].some((campo) =>
      campo.toLowerCase().includes(busquedaPostulado.toLowerCase())
    )
  )

  const postuladoAbierto = postulados.find((p) => p.id_proyecto === postuladoAbiertoId) ?? null

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
        <button
          type="button"
          className={`proy-tab ${tabAdmin === 'postulados' ? 'proy-tab-active' : ''}`}
          onClick={() => setTabAdmin('postulados')}
        >
          Proyectos Postulados
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
              <span className="col-divisor">Título</span>
              <span className="proyectos-header-investigador col-divisor">Investigador</span>
              <span className="proyectos-header-convocatoria">Convocatoria</span>
              <div className="proyectos-fase-header">
                <span>Estado</span>
                <div className="proyectos-estado-legend">
                  {ordenEstados.map((estado, i) => (
                    <span
                      key={estado}
                      className={`proyectos-estado-segment ${i === indiceEstadoResaltado ? 'fase-legend-swatch-activo' : ''}`}
                      style={{ background: estadoConfig[estado].color }}
                      title={estado}
                    />
                  ))}
                </div>
                <span className="fase-legend-caption" style={{ color: estadoConfig[estadoResaltado].color }}>
                  {estadoResaltado}
                </span>
              </div>
            </div>

            {cargando && <p className="proyectos-empty">Cargando proyectos...</p>}
            {error && <p className="proyectos-empty">{error}</p>}

            {!cargando &&
              proyectosFiltrados.map((p) => {
                const estado = mapearEstado(p.estado_actual)
                return (
                  <div className="proyectos-row" key={p.id_proyecto}>
                    <span className="proyectos-row-titulo col-divisor">{p.titulo}</span>
                    <span className="proyectos-row-investigador col-divisor">
                      {p.creador.nombre} {p.creador.apellido}
                    </span>
                    <span className="proyectos-row-fase">{p.convocatoria?.nombre ?? '—'}</span>
                    <span
                      className="proyectos-row-estado"
                      style={{ background: estadoConfig[estado].color }}
                      title={`Estado: ${estado}`}
                    />
                  </div>
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

      {tabAdmin === 'postulados' && (
        <div className="post-page">
          {!postuladoAbierto ? (
            <>
              <div className="post-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar por investigador o título"
                  value={busquedaPostulado}
                  onChange={(e) => setBusquedaPostulado(e.target.value)}
                />
              </div>

              <div className="post-table">
                <div className="post-table-header">
                  <span>Título</span>
                  <span>Investigador</span>
                  <span className="post-header-revision">Revisión de documentos</span>
                </div>

                {postuladosFiltrados.map((p) => (
                  <div className="post-row" key={p.id_proyecto}>
                    <span className="post-row-titulo">{p.titulo}</span>
                    <span className="post-row-investigador">
                      {p.creador.nombre} {p.creador.apellido}
                    </span>
                    <button
                      type="button"
                      className="post-row-ver"
                      aria-label="Revisar documentos"
                      onClick={() => abrirRevisionDocumentos(p.id_proyecto)}
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                ))}

                {postuladosFiltrados.length === 0 && (
                  <p className="post-empty">No se encontraron proyectos postulados.</p>
                )}
              </div>
            </>
          ) : (
            <div className="post-detalle">
              <button type="button" className="post-volver" onClick={volverAPostulados}>
                <ArrowLeft size={16} />
                Volver
              </button>

              <div className="post-detalle-card">
                <div className="post-detalle-header">
                  <h2>Detalles del proyecto para revisión inicial</h2>
                </div>

                <div className="post-detalle-info">
                  <p><strong>Título del proyecto:</strong> {postuladoAbierto.titulo}</p>
                  <p>
                    <strong>Investigador principal del proyecto:</strong>{' '}
                    {postuladoAbierto.creador.nombre} {postuladoAbierto.creador.apellido}
                  </p>
                  <p><strong>Convocatoria:</strong> {postuladoAbierto.convocatoria?.nombre ?? '—'}</p>
                  <p><strong>Modalidad:</strong> {postuladoAbierto.modalidad?.nombre ?? '—'}</p>
                  <p><strong>Tipo de proyecto:</strong> {postuladoAbierto.tipoProyecto?.nombre ?? '—'}</p>
                  <p className="post-detalle-estado">
                    <strong>Estado del proyecto:</strong>
                    <span
                      className="post-estado-dot"
                      style={{ background: estadoConfig[mapearEstado(postuladoAbierto.estado_actual)].color }}
                    />
                    {mapearEstado(postuladoAbierto.estado_actual)}
                  </p>
                  {consolidado?.etapa_actual && (
                    <p>
                      <strong>Etapa actual:</strong> {consolidado.etapa_actual.nombre.replace(/_/g, ' ')}
                    </p>
                  )}
                </div>

                <div className="post-detalle-acciones">
                  {consolidado && !consolidado.etapa_actual && (
                    <>
                      <button
                        type="button"
                        className="post-aceptar-comite"
                        onClick={handleAceptarYEnviarComite}
                        disabled={enviandoAsignacion}
                      >
                        {enviandoAsignacion ? 'Enviando...' : 'Aceptar y enviar a Comité'}
                        <CheckCheck size={16} />
                      </button>
                      {errorAsignacion && <p className="post-empty">{errorAsignacion}</p>}
                    </>
                  )}
                  {consolidado?.etapa_actual && (
                    <p className="post-ya-asignado">
                      Ya fue enviado a "{consolidado.etapa_actual.nombre.replace(/_/g, ' ')}" — en espera de esa
                      revisión.
                    </p>
                  )}
                </div>
              </div>

              <div className="post-documentos-toolbar">
                <h3>Documento a revisar:</h3>
                <button
                  type="button"
                  className="post-aprobar-todo"
                  onClick={handleAprobarTodo}
                  disabled={cargandoDocumentos || documentos.length === 0}
                >
                  Aprobar todo
                  <CheckCheck size={16} />
                </button>
              </div>

              {errorDocumentos && <p className="post-empty">{errorDocumentos}</p>}
              {cargandoDocumentos && <p className="post-empty">Cargando documentos...</p>}

              {!cargandoDocumentos && !errorDocumentos && documentos.length === 0 && (
                <p className="post-empty">El investigador todavía no ha cargado documentos.</p>
              )}

              <div className="post-documentos-list">
                {documentos.map((doc) => {
                  const estadoDoc =
                    doc.aprobado_rechazado === true
                      ? 'aprobado'
                      : doc.aprobado_rechazado === false
                        ? 'rechazado'
                        : 'pendiente'
                  const obsDoc = observaciones.filter(
                    (o) => o.proyectoDocumento.id_proyecto_documento === doc.id_proyecto_documento
                  )
                  const panelAbierto = docObservacionAbierto === doc.id_proyecto_documento

                  return (
                    <div className={`post-documento-row post-documento-${estadoDoc}`} key={doc.id_proyecto_documento}>
                      <div className="post-documento-principal">
                        <span className="post-documento-nombre">{doc.tipoDocumento.nombre}</span>

                        <button
                          type="button"
                          className="post-documento-descargar"
                          onClick={() => handleDescargarDocumento(doc)}
                        >
                          <Download size={14} />
                          Descargar
                        </button>

                        <button
                          type="button"
                          className="post-documento-observar"
                          onClick={() => toggleObservacionDoc(doc.id_proyecto_documento)}
                        >
                          <MessageCircle size={14} />
                          Observaciones{obsDoc.length > 0 ? ` (${obsDoc.length})` : ''}
                        </button>

                        <button
                          type="button"
                          className="post-documento-aprobar"
                          aria-label="Aprobar documento"
                          onClick={() => handleValidarDocumento(doc.id_proyecto_documento, true)}
                        >
                          <Check size={16} />
                        </button>

                        <button
                          type="button"
                          className="post-documento-rechazar"
                          aria-label="Rechazar documento"
                          onClick={() => handleValidarDocumento(doc.id_proyecto_documento, false)}
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {panelAbierto && (
                        <div className="post-observaciones-panel">
                          {obsDoc.length > 0 && (
                            <ul className="post-observaciones-lista">
                              {obsDoc.map((o) => (
                                <li key={o.id_observacion}>
                                  <p>{o.observacion}</p>
                                  <span>
                                    {o.usuario.nombre} {o.usuario.apellido} ·{' '}
                                    {new Date(o.fecha_observacion).toLocaleDateString('es-CO')}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="post-observacion-form">
                            <textarea
                              value={textoObservacion}
                              onChange={(e) => setTextoObservacion(e.target.value)}
                              placeholder="Escribe qué debe corregir el investigador en este documento..."
                            />
                            <button
                              type="button"
                              className="post-observacion-enviar"
                              onClick={() => handleAgregarObservacion(doc.id_proyecto_documento)}
                              disabled={enviandoObservacion || !textoObservacion.trim()}
                            >
                              {enviandoObservacion ? 'Enviando...' : 'Agregar observación'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
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
  const [convocatoriaActiva, setConvocatoriaActiva] = useState<convocatoriasApi.ConvocatoriaBackend | null>(null)
  const [cargandoConvocatoria, setCargandoConvocatoria] = useState(true)
  const [revalidando, setRevalidando] = useState(false)
  const [errorConvocatoria, setErrorConvocatoria] = useState('')
  const [misProyectos, setMisProyectos] = useState<proyectosApi.ProyectoListado[]>([])
  const [cargandoProyectos, setCargandoProyectos] = useState(true)

  // La leyenda "Estado" va resaltando un estado a la vez, como una luz
  // intermitente — así el investigador aprende de un vistazo qué estados
  // puede tener un proyecto (y qué significa cada color) sin que nadie
  // se lo tenga que explicar.
  const [indiceEstadoResaltado, setIndiceEstadoResaltado] = useState(0)

  useEffect(() => {
    const intervalo = setInterval(() => {
      setIndiceEstadoResaltado((i) => (i + 1) % ordenEstados.length)
    }, 1400)
    return () => clearInterval(intervalo)
  }, [])

  const estadoResaltado = ordenEstados[indiceEstadoResaltado]

  const cargarConvocatoriaActiva = () => {
    setCargandoConvocatoria(true)
    convocatoriasApi
      .listarConvocatorias({ estado: 'activa' })
      .then((lista) => setConvocatoriaActiva(lista[0] ?? null))
      .catch(() => setConvocatoriaActiva(null))
      .finally(() => setCargandoConvocatoria(false))
  }

  useEffect(() => {
    cargarConvocatoriaActiva()
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

  // Antes de dejar entrar al formulario, revalida el estado de la
  // convocatoria puntual — por si se cerró justo después de cargar esta
  // pantalla (el backend igual la rechazaría con 409 al guardar, pero así
  // evitamos que el investigador llene todo el formulario para nada).
  const handleCrearProyecto = () => {
    if (!convocatoriaActiva) return

    setErrorConvocatoria('')
    setRevalidando(true)
    convocatoriasApi
      .obtenerConvocatoria(convocatoriaActiva.id_convocatoria)
      .then((actual) => {
        if (actual.estado === 'activa') {
          navigate('/proyectos/nuevo')
        } else {
          setConvocatoriaActiva(null)
          setErrorConvocatoria('La convocatoria se cerró justo ahora — ya no se pueden registrar proyectos nuevos.')
        }
      })
      .catch(() => {
        setErrorConvocatoria('No se pudo verificar el estado de la convocatoria. Intenta de nuevo.')
      })
      .finally(() => setRevalidando(false))
  }

  return (
    <div className="proyectos-investigador">
      <div className="convocatoria-bar">
        <span className="convocatoria-label">
          Convocatoria Activa:{' '}
          <strong>
            {cargandoConvocatoria ? 'Cargando...' : convocatoriaActiva?.nombre ?? 'No hay convocatoria activa'}
          </strong>
        </span>

        <button
          type="button"
          className="btn-crear-proyecto"
          onClick={handleCrearProyecto}
          disabled={cargandoConvocatoria || !convocatoriaActiva || revalidando}
          title={!cargandoConvocatoria && !convocatoriaActiva ? 'No hay ninguna convocatoria activa en este momento' : undefined}
        >
          <FilePlus size={16} />
          {revalidando ? 'Verificando...' : 'Crear Proyecto'}
        </button>
      </div>

      {errorConvocatoria && <p className="convocatoria-bar-error">{errorConvocatoria}</p>}

      <div className="info-proyectos-card">
        <div className="info-proyectos-header">
          <h2>Información proyectos</h2>
        </div>

        <div className="info-proyectos-table-header">
          <span className="col-divisor">Título</span>
          <span aria-hidden="true" />
          <div className="fase-header">
            <span>Estado</span>
            <div className="fase-legend">
              {ordenEstados.map((estado, i) => (
                <span
                  key={estado}
                  className={`fase-legend-swatch ${i === indiceEstadoResaltado ? 'fase-legend-swatch-activo' : ''}`}
                  style={{ background: estadoConfig[estado].color }}
                  title={estado}
                />
              ))}
            </div>
            <span className="fase-legend-caption" style={{ color: estadoConfig[estadoResaltado].color }}>
              {estadoResaltado}
            </span>
          </div>
          <span aria-hidden="true" />
        </div>

        {cargandoProyectos && <p className="proyectos-empty">Cargando proyectos...</p>}

        {!cargandoProyectos && misProyectos.length === 0 ? (
          <p className="proyectos-empty">Todavía no tienes proyectos registrados.</p>
        ) : (
          misProyectos.map((p) => {
            const estado = mapearEstado(p.estado_actual)
            return (
              <div className="info-proyecto-row" key={p.id_proyecto}>
                <span className="info-proyecto-titulo col-divisor">{p.titulo}</span>
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