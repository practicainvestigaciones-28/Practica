import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Upload, Search, MessageCircle, FilePlus, X,
  Eye, ArrowLeft, Download, Check, CheckCheck,
} from 'lucide-react'
import { estadoConfig, ordenEstados, mapearEstado } from '../../../shared/lib/estado'
import { getRole } from '../../auth/lib/auth'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import './Proyectos.css'
import * as convocatoriasApi from '../../convocatorias/lib/convocatorias'
import * as proyectosApi from '../api/proyectos'
import * as documentosApi from '../api/documentos'
import * as evaluacionesApi from '../../evaluaciones/api/evaluaciones'
import * as observacionesApi from '../api/observaciones'
import { ApiError } from '../../../shared/api/client'
import { useAuth } from '../../auth/context/AuthContext'

type TabAdmin = 'proyectos' | 'postulados'

function ProyectosAdministrador() {
  const navigate = useNavigate()
  const [tabAdmin, setTabAdmin] = useState<TabAdmin>('proyectos')
  const [busqueda, setBusqueda] = useState('')
  const [proyectos, setProyectos] = useState<proyectosApi.ProyectoListado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [indiceEstadoResaltado, setIndiceEstadoResaltado] = useState(0)

  useEffect(() => {
    const intervalo = setInterval(() => {
      setIndiceEstadoResaltado((i) => (i + 1) % ordenEstados.length)
    }, 1400)
    return () => clearInterval(intervalo)
  }, [])

  const estadoResaltado = ordenEstados[indiceEstadoResaltado]

  const [asignaciones, setAsignaciones] = useState<Record<number, string>>({})

  useEffect(() => {
    proyectosApi
      .listarProyectos({ limit: 100 })
      .then((res) => {
        setProyectos(res.data)
        Promise.all(
          res.data.map((p) =>
            evaluacionesApi
              .obtenerEstadoConsolidado(p.id_proyecto)
              .then((consolidado) => [p.id_proyecto, consolidado.etapa_actual?.nombre ?? null] as const)
              .catch(() => [p.id_proyecto, null] as const)
          )
        ).then((resultados) => {
          const conAsignacion = resultados.filter((r): r is readonly [number, string] => r[1] !== null)
          setAsignaciones(Object.fromEntries(conAsignacion))
        })
      })
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
              <span className="proyectos-header-convocatoria">Asignado a</span>
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
                    <span className="proyectos-row-fase">
                      {(asignaciones[p.id_proyecto] ?? 'Sin asignar').replace(/_/g, ' ')}
                    </span>
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

function ProyectosInvestigador() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [convocatoriaActiva, setConvocatoriaActiva] = useState<convocatoriasApi.ConvocatoriaBackend | null>(null)
  const [cargandoConvocatoria, setCargandoConvocatoria] = useState(true)
  const [revalidando, setRevalidando] = useState(false)
  const [errorConvocatoria, setErrorConvocatoria] = useState('')
  const [misProyectos, setMisProyectos] = useState<proyectosApi.ProyectoListado[]>([])
  const [cargandoProyectos, setCargandoProyectos] = useState(true)

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

    proyectosApi
      .listarProyectos({ limit: 100 })
      .then((res) => setMisProyectos(res.data.filter((p) => p.creador.id_usuario === usuario.id_usuario)))
      .catch(() => setMisProyectos([]))
      .finally(() => setCargandoProyectos(false))
  }, [usuario])

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

function Proyectos() {
  const role = getRole()
  return role === 'administrador' ? <ProyectosAdministrador /> : <ProyectosInvestigador />
}

export default Proyectos