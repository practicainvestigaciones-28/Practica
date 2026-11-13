import { useRef, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Upload, Search, MessageCircle, FilePlus,
  Eye, ArrowLeft, CheckCheck, X as XIcon, SquarePen,
  CalendarCheck, CalendarX, CalendarClock, FolderPlus, Sparkles,
} from 'lucide-react'
import { estadoConfig, ordenEstados, mapearEstado, etapaPrevia } from '../../../shared/lib/estado'
import { getRole } from '../../auth/lib/auth'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import './Proyectos.css'
import * as convocatoriasApi from '../../convocatorias/lib/convocatorias'
import * as proyectosApi from '../api/proyectos'
import * as actaInicioApi from '../../acta-inicio/api/actaInicio'
import * as evaluacionesApi from '../../evaluaciones/api/evaluaciones'
import * as catalogosApi from '../../catalogos/api/catalogos'
import * as gruposApi from '../api/grupos'
import * as productosApi from '../api/productos'
import { mapearCategoriasBackend } from '../lib/productosInvestigacion'
import { ApiError } from '../../../shared/api/client'
import { useAuth } from '../../auth/context/AuthContext'
import VistaDetalleProyecto from '../components/VistaDetalleProyecto'
import Paginacion from '../../../shared/components/common/Paginacion'
import { paginar } from '../../../shared/lib/paginar'
import VerProyectoBoton from '../components/VerProyectoBoton'
import ModalAsignarResponsable from '../components/ModalAsignarResponsable'
import ModalTipoCarga, { type TipoCargaProyecto } from '../components/ModalTipoCarga'
import { importarProyectoDesdeDocx, construirBorradorDesdeExtraccion, type CatalogosParaImportar, type ExtraccionProyectoDocx } from '../lib/importar'
import { borradorTieneContenido } from './CrearProyecto'
import { useCambios } from '../../../shared/realtime/RealtimeContext'
import type { UsuarioBuscado } from '../../usuarios/api/usuarios'

type TabAdmin = 'proyectos' | 'postulados'

function ProyectosAdministrador() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [searchParams] = useSearchParams()
  // El enlace de la notificación de "proyecto corregido reenviado" llega como
  // /proyectos?tab=postulados, para abrir directo en esa pestaña (no existe
  // una ruta separada para Postulados — es una pestaña de esta pantalla).
  const tabUrl = searchParams.get('tab')
  const [tabAdmin, setTabAdmin] = useState<TabAdmin>(tabUrl === 'postulados' ? 'postulados' : 'proyectos')
  // Si ya estaba en Proyectos y abre otra notificación con ?tab=postulados, cambia de pestaña igual.
  useEffect(() => {
    if (tabUrl === 'postulados') setTabAdmin('postulados')
  }, [tabUrl])
  const [busqueda, setBusqueda] = useState('')
  // Las listas van de a 10 por página; al buscar vuelven a la primera.
  const [paginaProyectos, setPaginaProyectos] = useState(1)
  useEffect(() => setPaginaProyectos(1), [busqueda])
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

  useCambios('proyectos', refrescarProyectos)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importando, setImportando] = useState(false)
  const [errorImportacion, setErrorImportacion] = useState('')
  const [extraccionPendiente, setExtraccionPendiente] = useState<ExtraccionProyectoDocx | null>(null)
  const [advertenciasImportacion, setAdvertenciasImportacion] = useState<string[]>([])

  // Al cargar, el Administrador elige primero si el proyecto está en curso o ya finalizó.
  const [mostrarTipoCarga, setMostrarTipoCarga] = useState(false)

  const handleCargarClick = () => {
    setErrorImportacion('')
    setMostrarTipoCarga(true)
  }

  const handleElegirTipoCarga = (tipo: TipoCargaProyecto) => {
    setMostrarTipoCarga(false)
    // Proyecto en curso: sigue el flujo de siempre (documento → responsable → formulario → firmas pendientes).
    if (tipo === 'en_curso') fileInputRef.current?.click()
    // Proyecto finalizado: anterior al sistema, se carga con sus documentos en PDF.
    else navigate('/proyectos/finalizado')
  }

  const handleArchivoSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setImportando(true)
    setErrorImportacion('')
    try {
      const resultado = await importarProyectoDesdeDocx(file)
      if (!resultado.extraccion) {
        setErrorImportacion(resultado.error ?? 'No se pudo leer el documento.')
        return
      }
      setExtraccionPendiente(resultado.extraccion)
      setAdvertenciasImportacion(resultado.advertencias)
    } finally {
      setImportando(false)
    }
  }

  const cancelarAsignarResponsable = () => {
    setExtraccionPendiente(null)
    setAdvertenciasImportacion([])
    setErrorImportacion('')
  }

  const confirmarResponsable = async (responsable: UsuarioBuscado) => {
    if (!extraccionPendiente || !usuario) return

    if (localStorage.getItem(`cp_borrador_${usuario.id_usuario}`)) {
      try {
        const existente = JSON.parse(localStorage.getItem(`cp_borrador_${usuario.id_usuario}`)!)
        if (borradorTieneContenido(existente)) {
          const continuar = window.confirm(
            'Ya tienes un borrador de proyecto sin terminar en este navegador. Si continúas, se reemplaza por los datos del documento que acabas de cargar. ¿Continuar?'
          )
          if (!continuar) return
        }
      } catch {
        // Borrador ilegible: se sobreescribe sin preguntar.
      }
    }

    setErrorImportacion('')
    setImportando(true)
    try {
      const [modalidades, areas, tiposProyecto, programas, categoriasReales, gruposInternos, lineasInvestigacion, ods, rolesEstudiante, dedicaciones] =
        await Promise.all([
          catalogosApi.listarModalidadesProyecto(true),
          catalogosApi.listarAreasConocimiento(true),
          catalogosApi.listarTiposProyecto(true),
          catalogosApi.listarProgramas(true),
          productosApi.listarCategoriasProducto(true),
          gruposApi.listarGrupos(true),
          catalogosApi.listarLineasInvestigacion(true),
          catalogosApi.listarOds(true),
          catalogosApi.listarRolesEstudiante(),
          catalogosApi.listarDedicaciones(),
        ])
      const catalogos: CatalogosParaImportar = {
        modalidades,
        areas,
        tiposProyecto,
        programas,
        categoriasProducto: mapearCategoriasBackend(categoriasReales),
        gruposInternos: gruposInternos.filter((g) => g.tipoGrupo.nombre === 'interno'),
        lineasInvestigacion,
        ods,
        rolesEstudiante,
        dedicaciones,
      }
      const { borrador } = construirBorradorDesdeExtraccion(extraccionPendiente, catalogos, responsable.id_usuario)
      localStorage.setItem(`cp_borrador_${usuario.id_usuario}`, JSON.stringify(borrador))
      setExtraccionPendiente(null)
      setAdvertenciasImportacion([])
      navigate('/proyectos/nuevo')
    } catch (err) {
      // El mensaje dice la causa real (antes siempre decía que fallaron los catálogos, aunque el problema fuera otro).
      console.error('Carga del documento:', err)
      const detalle =
        err instanceof ApiError
          ? err.message
          : err instanceof DOMException && err.name === 'QuotaExceededError'
            ? 'no hay espacio en el navegador para guardar el borrador (borra los datos del sitio o los borradores y vuelve a intentar)'
            : err instanceof Error
              ? err.message
              : ''
      setErrorImportacion(`No se pudo completar la carga${detalle ? `: ${detalle}` : ''}. Intenta de nuevo.`)
    } finally {
      setImportando(false)
    }
  }

  const proyectosFiltrados = proyectos.filter((p) =>
    [p.titulo, `${p.creador.nombre} ${p.creador.apellido}`, p.convocatoria?.nombre ?? ''].some((campo) =>
      campo.toLowerCase().includes(busqueda.toLowerCase())
    )
  )
  const proyectosPaginados = paginar(proyectosFiltrados, paginaProyectos)

  const [busquedaPostulado, setBusquedaPostulado] = useState('')
  const [paginaPostulados, setPaginaPostulados] = useState(1)
  useEffect(() => setPaginaPostulados(1), [busquedaPostulado])
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
    const motivo = motivoRechazo.trim()
    if (postuladoAbiertoId === null || !postuladoAbierto || !motivo) return
    setEnviandoRechazo(true)
    setErrorRechazo('')

    evaluacionesApi
      // El backend ya crea la notificación al investigador dentro de la
      // misma transacción del rechazo (ver rechazarProyectoInicial) — antes
      // se disparaba aparte desde aquí, y si esta segunda llamada fallaba el
      // proyecto quedaba rechazado sin que el investigador se enterara.
      .rechazarProyectoInicial(postuladoAbiertoId, motivo)
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
  const postuladosPaginados = paginar(postuladosFiltrados, paginaPostulados)

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

            <button type="button" className="btn-upload-proyecto" onClick={handleCargarClick} disabled={importando}>
              <Upload size={16} />
              {importando ? 'Leyendo documento...' : 'Cargar proyectos'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
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
              <span className="proyectos-header-convocatoria">Etapa</span>
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
              <span aria-hidden="true" />
            </div>

            {cargando && <p className="proyectos-empty">Cargando proyectos...</p>}
            {error && <p className="proyectos-empty">{error}</p>}

            {!cargando &&
              proyectosPaginados.visibles.map((p) => {
                const estado = mapearEstado(p.estado_actual)
                return (
                  <div className="proyectos-row" key={p.id_proyecto}>
                    <span className="proyectos-row-titulo col-divisor">{p.titulo}</span>
                    <span className="proyectos-row-investigador col-divisor">
                      {p.creador.nombre} {p.creador.apellido}
                    </span>
                    <span className="proyectos-row-fase">{p.convocatoria?.nombre ?? '—'}</span>
                    <span className="proyectos-row-fase">
                      {(asignaciones[p.id_proyecto] ?? etapaPrevia(p.estado_actual)).replace(/_/g, ' ')}
                    </span>
                    <span
                      className="proyectos-row-estado"
                      style={{ background: estadoConfig[estado].color }}
                      title={`Estado: ${estado}`}
                    />
                    <VerProyectoBoton id_proyecto={p.id_proyecto} />
                  </div>
                )
              })}

            {!cargando && !error && proyectosFiltrados.length === 0 && (
              <p className="proyectos-empty">No se encontraron proyectos.</p>
            )}
          </div>

          <Paginacion pagina={proyectosPaginados.pagina} totalPaginas={proyectosPaginados.totalPaginas} onCambiar={setPaginaProyectos} />

          {mostrarTipoCarga && <ModalTipoCarga finalizadoDisponible onElegir={handleElegirTipoCarga} onCancelar={() => setMostrarTipoCarga(false)} />}

          {errorImportacion && !extraccionPendiente && (
            <ConfirmModal
              mensaje={errorImportacion}
              botonPrimario={{ label: 'Ok', onClick: () => setErrorImportacion(''), variante: 'azul' }}
              onClose={() => setErrorImportacion('')}
            />
          )}

          {extraccionPendiente && (
            <ModalAsignarResponsable
              sugerenciaNombre={`${extraccionPendiente.principal.nombres} ${extraccionPendiente.principal.apellidos}`.trim()}
              sugerenciaCorreo={extraccionPendiente.principal.correo || extraccionPendiente.hojasVida[0]?.correo || undefined}
              advertencias={advertenciasImportacion}
              error={errorImportacion}
              onConfirmar={confirmarResponsable}
              onCancelar={cancelarAsignarResponsable}
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

                {postuladosPaginados.visibles.map((p) => (
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

              <Paginacion pagina={postuladosPaginados.pagina} totalPaginas={postuladosPaginados.totalPaginas} onCambiar={setPaginaPostulados} />
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
                    <p>Explica el motivo: es obligatorio, el investigador lo necesita para saber qué corregir.</p>
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
                      <button
                        type="button"
                        className="post-rechazo-confirmar"
                        onClick={confirmarRechazo}
                        disabled={enviandoRechazo || !motivoRechazo.trim()}
                        title={!motivoRechazo.trim() ? 'Escribe el motivo del rechazo' : undefined}
                      >
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
  const [paginaMisProyectos, setPaginaMisProyectos] = useState(1)
  const misProyectosPaginados = paginar(misProyectos, paginaMisProyectos)
  const [cargandoProyectos, setCargandoProyectos] = useState(true)
  const [etapas, setEtapas] = useState<Record<number, string>>({})

  // Editar proyecto desde la lista: mientras el líder del grupo no le haya dado el visto bueno, o si fue rechazado / no aprobado.
  // Las correcciones que pide un comité o los pares sobre un proyecto en curso se hacen desde la notificación.
  const puedeEditarProyecto = (p: proyectosApi.ProyectoListado) => ['pendiente_firmas', 'pendiente_lider', 'rechazado'].includes(p.estado_actual)

  const [indiceEstadoResaltado, setIndiceEstadoResaltado] = useState(0)

  useEffect(() => {
    const intervalo = setInterval(() => {
      setIndiceEstadoResaltado((i) => (i + 1) % ordenEstados.length)
    }, 1400)
    return () => clearInterval(intervalo)
  }, [])

  const estadoResaltado = ordenEstados[indiceEstadoResaltado]

  const cargarConvocatoriaActiva = (silencioso = false) => {
    if (!silencioso) setCargandoConvocatoria(true)
    convocatoriasApi
      .listarConvocatorias({ estado: 'activa' })
      .then((lista) => setConvocatoriaActiva(lista[0] ?? null))
      .catch(() => {
        if (!silencioso) setConvocatoriaActiva(null)
      })
      .finally(() => {
        if (!silencioso) setCargandoConvocatoria(false)
      })
  }

  useEffect(() => {
    cargarConvocatoriaActiva()
  }, [])

  useCambios('convocatorias', () => cargarConvocatoriaActiva(true))

  const refrescarMisProyectos = () => {
    if (!usuario) return

    proyectosApi
      .listarProyectos({ limit: 100 })
      .then((res) => {
        const propios = res.data.filter((p) => p.creador.id_usuario === usuario.id_usuario)
        setMisProyectos(propios)
        Promise.all(
          propios.map((p) =>
            evaluacionesApi
              .obtenerEstadoConsolidado(p.id_proyecto)
              .then((consolidado) => [p.id_proyecto, consolidado.etapa_actual?.nombre ?? null] as const)
              .catch(() => [p.id_proyecto, null] as const)
          )
        ).then((resultados) => {
          const conEtapa = resultados.filter((r): r is readonly [number, string] => r[1] !== null)
          setEtapas(Object.fromEntries(conEtapa))
        })
      })
      .catch(() => setMisProyectos([]))
      .finally(() => setCargandoProyectos(false))
  }

  useEffect(() => {
    refrescarMisProyectos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  useCambios('proyectos', refrescarMisProyectos)

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

  const estadoConvocatoria = cargandoConvocatoria
    ? 'cargando'
    : convocatoriaActiva && !convocatoriaVencida
      ? 'activa'
      : 'inactiva'

  const IconoConvocatoria = cargandoConvocatoria ? CalendarClock : estadoConvocatoria === 'activa' ? CalendarCheck : CalendarX

  const diasRestantesConvocatoria =
    convocatoriaActiva && !convocatoriaVencida
      ? Math.max(0, Math.ceil((new Date(convocatoriaActiva.fecha_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null

  return (
    <div className="proyectos-investigador">
      <div className="info-proyectos-card">
        <div className={`info-proyectos-header info-proyectos-header--${estadoConvocatoria}`}>
          <div className="info-proyectos-header-conv">
            <span className="info-proyectos-convocatoria-icono">
              <IconoConvocatoria size={15} />
            </span>
            <span className="info-proyectos-convocatoria-texto">
              {cargandoConvocatoria ? (
                'Verificando convocatoria...'
              ) : convocatoriaActiva ? (
                <>
                  Convocatoria {convocatoriaVencida ? 'cerrada' : 'activa'}: <strong>{convocatoriaActiva.nombre}</strong>
                </>
              ) : (
                'No hay ninguna convocatoria activa en este momento'
              )}
            </span>
          </div>

          <h2>Información proyectos</h2>

          <div className="info-proyectos-header-right">
            {diasRestantesConvocatoria !== null && (
              <span className="info-proyectos-convocatoria-plazo">
                {diasRestantesConvocatoria === 0
                  ? 'Cierra hoy'
                  : diasRestantesConvocatoria === 1
                    ? 'Cierra mañana'
                    : `${diasRestantesConvocatoria} días restantes`}
              </span>
            )}

            {misProyectos.length > 0 && (
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
            )}
          </div>
        </div>

        {errorConvocatoria && <p className="convocatoria-bar-error">{errorConvocatoria}</p>}

        {cargandoProyectos && <p className="proyectos-empty">Cargando proyectos...</p>}

        {!cargandoProyectos && misProyectos.length === 0 && (
          <div className="proyectos-vacio">
            <div className="proyectos-vacio-icono">
              <FolderPlus size={34} />
            </div>
            <h3 className="proyectos-vacio-titulo">Aún no tienes proyectos</h3>
            <p className="proyectos-vacio-texto">
              Registra tu primer proyecto de investigación para empezar a hacerle seguimiento aquí.
            </p>
            {!cargandoConvocatoria && (!convocatoriaActiva || convocatoriaVencida) && (
              <p className="proyectos-vacio-aviso">
                {!convocatoriaActiva
                  ? 'No hay ninguna convocatoria activa en este momento — mira el estado arriba.'
                  : 'La convocatoria ya venció — no se pueden registrar proyectos nuevos.'}
              </p>
            )}
            <button
              type="button"
              className="proyectos-vacio-btn"
              onClick={handleCrearProyecto}
              disabled={cargandoConvocatoria || !convocatoriaActiva || convocatoriaVencida || revalidando}
            >
              <Sparkles size={18} />
              {revalidando ? 'Verificando...' : 'Crear mi primer proyecto'}
            </button>
          </div>
        )}

        {!cargandoProyectos && misProyectos.length > 0 && (
          <div className="info-proyectos-table-header">
            <span className="col-divisor">Título</span>
            <span className="info-proyecto-columna-label col-divisor">Convocatoria</span>
            <span className="info-proyecto-columna-label col-divisor">Etapa</span>
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
            {/* Columnas de los íconos de acción (chat/editar/ver) de cada proyecto. */}
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
        )}

        {!cargandoProyectos && misProyectos.length > 0 && (
          misProyectosPaginados.visibles.map((p) => {
            const estado = mapearEstado(p.estado_actual)
            return (
              <div
                className="info-proyecto-row info-proyecto-row-clicable"
                key={p.id_proyecto}
                onClick={() => navigate(`/proyectos/ver/${p.id_proyecto}`)}
              >
                <span className="info-proyecto-titulo col-divisor">{p.titulo}</span>
                <span className="info-proyecto-fase col-divisor">{p.convocatoria?.nombre ?? '—'}</span>
                <span className="info-proyecto-fase">{(etapas[p.id_proyecto] ?? etapaPrevia(p.estado_actual)).replace(/_/g, ' ')}</span>
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
                <button
                  type="button"
                  className="info-proyecto-editar"
                  aria-label="Editar proyecto"
                  title={
                    puedeEditarProyecto(p)
                      ? 'Editar proyecto'
                      : 'El líder ya dio el visto bueno (o el proyecto está en otra etapa): si requiere correcciones, se hacen desde la notificación'
                  }
                  disabled={!puedeEditarProyecto(p)}
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/proyectos/editar/${p.id_proyecto}`)
                  }}
                >
                  <SquarePen size={16} />
                </button>
                <VerProyectoBoton id_proyecto={p.id_proyecto} />
              </div>
            )
          })
        )}
      </div>

      <Paginacion pagina={misProyectosPaginados.pagina} totalPaginas={misProyectosPaginados.totalPaginas} onCambiar={setPaginaMisProyectos} />
    </div>
  )
}

/**
 * Vista de solo lectura para el Vicerrector: todos los proyectos de todas
 * las convocatorias, organizados en dos niveles (convocatorias → proyectos
 * de esa convocatoria) para que no sea una sola tabla gigante. Sin botones
 * de crear ni editar — solo "Ver proyecto" (reusa /proyectos/ver/:id, que ya
 * es de solo lectura para cualquier rol) y, cuando el acta de inicio del
 * proyecto está "en firma", un acceso directo a /acta-inicio/:id para
 * firmarla ahí mismo.
 */
function ProyectosVicerrector() {
  const navigate = useNavigate()
  const [convocatorias, setConvocatorias] = useState<convocatoriasApi.ConvocatoriaBackend[]>([])
  const [cargandoConvocatorias, setCargandoConvocatorias] = useState(true)
  const [convocatoriaSel, setConvocatoriaSel] = useState<convocatoriasApi.ConvocatoriaBackend | null>(null)
  const [paginaVic, setPaginaVic] = useState(1)
  useEffect(() => setPaginaVic(1), [convocatoriaSel])
  const [proyectosConv, setProyectosConv] = useState<proyectosApi.ProyectoListado[]>([])
  const [cargandoProyectos, setCargandoProyectos] = useState(false)
  const [estadosActas, setEstadosActas] = useState<Record<number, actaInicioApi.EstadoActa | 'sin_acta'>>({})

  const refrescarConvocatorias = () => {
    convocatoriasApi
      .listarConvocatorias()
      // Las convocatorias "inactiva" las desactivó el Administrador a propósito
      // (datos de prueba, errores de captura, etc.): no tiene sentido que el
      // Vicerrector las vea en su panorama institucional. Las "cerrada" sí se
      // quedan, porque son convocatorias reales ya vencidas con proyectos reales.
      .then((lista) => setConvocatorias(lista.filter((c) => c.estado !== 'inactiva')))
      .catch(() => setConvocatorias([]))
      .finally(() => setCargandoConvocatorias(false))
  }

  useEffect(() => {
    refrescarConvocatorias()
    actaInicioApi.estadosActasInicio().then(setEstadosActas).catch(() => setEstadosActas({}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useCambios('convocatorias', refrescarConvocatorias)

  const abrirConvocatoria = (c: convocatoriasApi.ConvocatoriaBackend) => {
    setConvocatoriaSel(c)
    setCargandoProyectos(true)
    proyectosApi
      .listarProyectos({ id_convocatoria: c.id_convocatoria, limit: 200 })
      .then((res) => setProyectosConv(res.data))
      .catch(() => setProyectosConv([]))
      .finally(() => setCargandoProyectos(false))
  }

  useCambios(['proyectos', 'acta-inicio'], () => {
    if (convocatoriaSel) abrirConvocatoria(convocatoriaSel)
    actaInicioApi.estadosActasInicio().then(setEstadosActas).catch(() => setEstadosActas({}))
  })

  const volverAConvocatorias = () => {
    setConvocatoriaSel(null)
    setProyectosConv([])
  }

  const ETIQUETAS_ACTA: Record<actaInicioApi.EstadoActa | 'sin_acta', string> = {
    sin_acta: 'Sin acta de inicio',
    'en elaboracion': 'Acta en elaboración',
    'en firma': 'Acta en firma',
    legalizada: 'Acta legalizada',
  }

  if (!convocatoriaSel) {
    return (
      <div className="vic-proyectos">
        <h2 className="vic-titulo">Proyectos por convocatoria</h2>

        {cargandoConvocatorias && <p className="proyectos-empty">Cargando convocatorias...</p>}
        {!cargandoConvocatorias && convocatorias.length === 0 && (
          <p className="proyectos-empty">No hay convocatorias registradas.</p>
        )}

        <div className="vic-convocatorias-grid">
          {convocatorias.map((c) => {
            const cantidad = c._count?.proyectos ?? 0
            return (
              <button
                type="button"
                className="vic-convocatoria-card"
                key={c.id_convocatoria}
                onClick={() => abrirConvocatoria(c)}
              >
                <span className="vic-convocatoria-nombre">{c.nombre}</span>
                <span className="vic-convocatoria-count">
                  {cantidad} proyecto{cantidad === 1 ? '' : 's'}
                </span>
                <span className={`vic-convocatoria-estado vic-convocatoria-estado-${c.estado}`}>{c.estado}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="vic-proyectos">
      <button type="button" className="vic-volver" onClick={volverAConvocatorias}>
        <ArrowLeft size={16} />
        Volver a convocatorias
      </button>

      <div className="info-proyectos-card">
        <div className="info-proyectos-header">
          <h2>{convocatoriaSel.nombre}</h2>
        </div>

        <div className="vic-tabla-header">
          <span className="col-divisor">Investigador</span>
          <span className="col-divisor">Título</span>
          <span>Acta de inicio</span>
          <span aria-hidden="true" />
        </div>

        {cargandoProyectos && <p className="proyectos-empty">Cargando proyectos...</p>}
        {!cargandoProyectos && proyectosConv.length === 0 && (
          <p className="proyectos-empty">Esta convocatoria todavía no tiene proyectos.</p>
        )}

        {!cargandoProyectos &&
          paginar(proyectosConv, paginaVic).visibles.map((p) => {
            const estadoActa = estadosActas[p.id_proyecto] ?? 'sin_acta'
            return (
              <div className="vic-tabla-row" key={p.id_proyecto}>
                <span className="col-divisor">
                  {p.creador.nombre} {p.creador.apellido}
                </span>
                <span className="col-divisor info-proyecto-titulo">{p.titulo}</span>
                <span className={`vic-acta-badge vic-acta-badge-${estadoActa.replace(' ', '-')}`}>
                  {ETIQUETAS_ACTA[estadoActa]}
                </span>
                <div className="vic-tabla-acciones">
                  <button
                    type="button"
                    className="vic-link-btn"
                    onClick={() => navigate(`/proyectos/ver/${p.id_proyecto}`)}
                  >
                    <Eye size={14} />
                    Ver
                  </button>
                  {estadoActa === 'en firma' && (
                    <button
                      type="button"
                      className="vic-link-btn vic-link-btn-firmar"
                      onClick={() => navigate(`/acta-inicio/${p.id_proyecto}`)}
                    >
                      Ir a firmar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      <Paginacion
        pagina={paginar(proyectosConv, paginaVic).pagina}
        totalPaginas={paginar(proyectosConv, paginaVic).totalPaginas}
        onCambiar={setPaginaVic}
      />
    </div>
  )
}

function Proyectos() {
  const role = getRole()
  if (role === 'administrador') return <ProyectosAdministrador />
  if (role === 'vicerrector') return <ProyectosVicerrector />
  return <ProyectosInvestigador />
}

export default Proyectos