import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Upload, Search, MessageCircle, FilePlus,
  Eye, ArrowLeft, CheckCheck, X as XIcon,
} from 'lucide-react'
import { estadoConfig, ordenEstados, mapearEstado } from '../../../shared/lib/estado'
import { getRole } from '../../auth/lib/auth'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import './Proyectos.css'
import * as convocatoriasApi from '../../convocatorias/lib/convocatorias'
import * as proyectosApi from '../api/proyectos'
import * as evaluacionesApi from '../../evaluaciones/api/evaluaciones'
import * as notificacionesApi from '../../notificaciones/api/notificaciones'
import { ApiError } from '../../../shared/api/client'
import { useAuth } from '../../auth/context/AuthContext'
import VistaDetalleProyecto from '../components/VistaDetalleProyecto'

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

  const refrescarProyectos = () => {
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
  }

  useEffect(() => {
    refrescarProyectos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const ETAPA_COMITE_INVESTIGACION = 2

  const [consolidado, setConsolidado] = useState<evaluacionesApi.EstadoConsolidado | null>(null)
  const [enviandoAsignacion, setEnviandoAsignacion] = useState(false)
  const [errorAsignacion, setErrorAsignacion] = useState('')
  const [envioExitoso, setEnvioExitoso] = useState(false)

  const [mostrarRechazoModal, setMostrarRechazoModal] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [enviandoRechazo, setEnviandoRechazo] = useState(false)
  const [errorRechazo, setErrorRechazo] = useState('')
  const [rechazoExitoso, setRechazoExitoso] = useState(false)

  /** Traduce lo que devuelve el backend (nombres de tabla en snake_case) a algo legible. */
  const ETIQUETAS_FALTANTES: Record<string, string> = {
    participantes: 'Participantes del proyecto',
    areas_conocimiento: 'Área de conocimiento',
    programas_academicos: 'Programa académico',
    financiacion: 'Financiación',
    grupos_investigacion: 'Grupo de investigación',
    objetivos: 'Objetivos',
    antecedentes: 'Antecedentes',
    cronograma: 'Cronograma de actividades',
    documentos: 'Documentos anexos',
    productos_obligatorios: 'Productos de investigación obligatorios',
  }

  const mensajeErrorEnvio = (err: unknown): string => {
    if (err instanceof ApiError && err.faltantes && err.faltantes.length > 0) {
      const legibles = err.faltantes.map((f) => ETIQUETAS_FALTANTES[f] ?? f)
      return `Al proyecto todavía le falta: ${legibles.join(', ')}.`
    }
    return err instanceof ApiError ? err.message : 'No se pudo enviar el proyecto.'
  }

  const refrescarConsolidado = (idProyecto: number) => {
    evaluacionesApi
      .obtenerEstadoConsolidado(idProyecto)
      .then(setConsolidado)
      .catch(() => setConsolidado(null))
  }

  const abrirRevisionDocumentos = (id: number) => {
    setPostuladoAbiertoId(id)
    refrescarConsolidado(id)
  }

  const volverAPostulados = () => {
    setPostuladoAbiertoId(null)
    setConsolidado(null)
    setErrorAsignacion('')
  }

  const handleAceptarYEnviarComite = () => {
    if (postuladoAbiertoId === null) return
    setEnviandoAsignacion(true)
    setErrorAsignacion('')
    evaluacionesApi
      .asignarProyectoAEtapa(postuladoAbiertoId, { id_etapa: ETAPA_COMITE_INVESTIGACION })
      .then(() => {
        refrescarProyectos()
        setPostuladoAbiertoId(null)
        setConsolidado(null)
        setTabAdmin('proyectos')
        setEnvioExitoso(true)
      })
      .catch((err) => setErrorAsignacion(mensajeErrorEnvio(err)))
      .finally(() => setEnviandoAsignacion(false))
  }

  const abrirRechazoModal = () => {
    setMotivoRechazo('')
    setErrorRechazo('')
    setMostrarRechazoModal(true)
  }

  const cerrarRechazoModal = () => {
    setMostrarRechazoModal(false)
  }

  const confirmarRechazo = () => {
    if (postuladoAbiertoId === null || !postuladoAbierto) return
    setEnviandoRechazo(true)
    setErrorRechazo('')

    const motivo = motivoRechazo.trim()

    evaluacionesApi
      .rechazarProyectoInicial(postuladoAbiertoId, motivo || undefined)
      .then(() =>
        notificacionesApi.crearNotificacion(postuladoAbierto.creador.id_usuario, {
          titulo: 'Tu proyecto fue rechazado',
          mensaje: motivo
            ? `Tu proyecto "${postuladoAbierto.titulo}" fue rechazado en la revisión inicial. Motivo: ${motivo}`
            : `Tu proyecto "${postuladoAbierto.titulo}" fue rechazado en la revisión inicial.`,
          enlace: `/proyectos/ver/${postuladoAbiertoId}`,
        })
      )
      .then(() => {
        refrescarProyectos()
        setMostrarRechazoModal(false)
        setPostuladoAbiertoId(null)
        setConsolidado(null)
        setTabAdmin('proyectos')
        setRechazoExitoso(true)
      })
      .catch((err) => setErrorRechazo(err instanceof ApiError ? err.message : 'No se pudo rechazar el proyecto.'))
      .finally(() => setEnviandoRechazo(false))
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
                <span className="fase-legend-caption" style={{ background: estadoConfig[estadoResaltado].color, color: estadoConfig[estadoResaltado].colorTexto }}>
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

              <VistaDetalleProyecto id_proyecto={postuladoAbierto.id_proyecto} />

              <div className="post-detalle-envio">
                {consolidado && !consolidado.etapa_actual && (
                  <>
                    <div className="post-detalle-envio-botones">
                      <button
                        type="button"
                        className="post-aceptar-comite"
                        onClick={handleAceptarYEnviarComite}
                        disabled={enviandoAsignacion}
                      >
                        {enviandoAsignacion ? 'Enviando...' : 'Enviar a Comité de Investigación'}
                        <CheckCheck size={16} />
                      </button>
                      <button type="button" className="post-rechazar-btn" onClick={abrirRechazoModal}>
                        <XIcon size={16} />
                        Rechazar y notificar al investigador
                      </button>
                    </div>
                    {errorAsignacion && <p className="post-error">{errorAsignacion}</p>}
                  </>
                )}
                {consolidado?.etapa_actual && (
                  <p className="post-ya-asignado">
                    Ya fue enviado a "{consolidado.etapa_actual.nombre.replace(/_/g, ' ')}" — en espera de esa
                    revisión.
                  </p>
                )}
              </div>

              {mostrarRechazoModal && (
                <div className="post-rechazo-overlay">
                  <div className="post-rechazo-box">
                    <h3>Rechazar proyecto</h3>
                    <p>Este motivo se le notificará al investigador que registró el proyecto.</p>
                    <textarea
                      value={motivoRechazo}
                      onChange={(e) => setMotivoRechazo(e.target.value)}
                      placeholder="Explica por qué se rechaza este proyecto..."
                    />
                    {errorRechazo && <p className="post-error">{errorRechazo}</p>}
                    <div className="post-rechazo-acciones">
                      <button type="button" className="post-rechazo-cancelar" onClick={cerrarRechazoModal} disabled={enviandoRechazo}>
                        Cancelar
                      </button>
                      <button type="button" className="post-rechazo-confirmar" onClick={confirmarRechazo} disabled={enviandoRechazo}>
                        {enviandoRechazo ? 'Rechazando...' : 'Rechazar y notificar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {envioExitoso && (
        <ConfirmModal
          mensaje="El proyecto se envió a Comité de Investigación correctamente."
          botonPrimario={{ label: 'Ok', onClick: () => setEnvioExitoso(false), variante: 'azul' }}
          onClose={() => setEnvioExitoso(false)}
        />
      )}

      {rechazoExitoso && (
        <ConfirmModal
          mensaje="El proyecto se rechazó y se notificó al investigador."
          botonPrimario={{ label: 'Ok', onClick: () => setRechazoExitoso(false), variante: 'azul' }}
          onClose={() => setRechazoExitoso(false)}
        />
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

  // El estado "activa" en BD es manual: nada lo cierra solo cuando pasa
  // fecha_fin. Se calcula aquí para no mostrarle al investigador una
  // convocatoria como disponible cuando el backend ya la va a rechazar al
  // intentar guardar el proyecto (ver ConvocatoriaVencidaError).
  const convocatoriaVencida = convocatoriaActiva ? new Date(convocatoriaActiva.fecha_fin) < new Date() : false

  const handleCrearProyecto = () => {
    if (!convocatoriaActiva || convocatoriaVencida) return

    setErrorConvocatoria('')
    setRevalidando(true)
    convocatoriasApi
      .obtenerConvocatoria(convocatoriaActiva.id_convocatoria)
      .then((actual) => {
        if (actual.estado === 'activa' && new Date(actual.fecha_fin) >= new Date()) {
          navigate('/proyectos/nuevo')
        } else {
          setConvocatoriaActiva(actual)
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
          {convocatoriaVencida ? 'Convocatoria:' : 'Convocatoria Activa:'}{' '}
          <strong>
            {cargandoConvocatoria ? 'Cargando...' : convocatoriaActiva?.nombre ?? 'No hay convocatoria activa'}
          </strong>
          {convocatoriaVencida && <span className="convocatoria-badge-cerrada">Cerrada</span>}
        </span>

        <button
          type="button"
          className="btn-crear-proyecto"
          onClick={handleCrearProyecto}
          disabled={cargandoConvocatoria || !convocatoriaActiva || convocatoriaVencida || revalidando}
          title={
            !cargandoConvocatoria && !convocatoriaActiva
              ? 'No hay ninguna convocatoria activa en este momento'
              : convocatoriaVencida
                ? 'La convocatoria ya venció — no se pueden registrar proyectos nuevos'
                : undefined
          }
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
            <span className="fase-legend-caption" style={{ background: estadoConfig[estadoResaltado].color, color: estadoConfig[estadoResaltado].colorTexto }}>
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
              <div
                className="info-proyecto-row info-proyecto-row-clicable"
                key={p.id_proyecto}
                onClick={() => navigate(`/proyectos/ver/${p.id_proyecto}`)}
              >
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
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/proyectos/ver/${p.id_proyecto}`)
                  }}
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