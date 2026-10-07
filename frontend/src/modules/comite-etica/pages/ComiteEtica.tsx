import { Fragment, useEffect, useState } from 'react'
import {
  FileCheck, Clock, CheckSquare, XCircle, FileText, Search, ArrowLeft, ChevronDown, Download, Eye,
} from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import { estadoConfig } from '../../../shared/lib/estado'
import { ApiError } from '../../../shared/api/client'
import * as evaluacionesApi from '../../evaluaciones/api/evaluaciones'
import * as proyectosApi from '../../proyectos/api/proyectos'
import * as documentosApi from '../../proyectos/api/documentos'
import { cargarProyectosAsignados, type ProyectoEnRevision } from '../../evaluaciones/lib/bandejaEvaluacion'
import { listarEtapas } from '../../proyectos/api/tiposDocumento'
import {
  checklistEtica,
  construirBloqueChecklist,
  parsearChecklistComite,
  respuestaVacia,
  todosCumplenSi,
  type RespuestasChecklist,
} from '../../evaluaciones/lib/checklistComite'
import { construirDetalleItemEtica, type ContextoDetalleProyecto } from '../../evaluaciones/lib/detalleItemChecklist'
import './ComiteEtica.css'

type Vista = 'panel' | 'lista' | 'detalle'
type CategoriaLista = 'asignados' | 'pendientes' | 'revisados'
type Orden = 'titulo-asc' | 'titulo-desc'
type Accion = 'aprobar' | 'correcciones' | null

function ComiteEtica() {
  const [proyectos, setProyectos] = useState<ProyectoEnRevision[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [vista, setVista] = useState<Vista>('panel')
  const [categoriaLista, setCategoriaLista] = useState<CategoriaLista>('asignados')
  const [origenCategoria, setOrigenCategoria] = useState<CategoriaLista | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('titulo-asc')
  const [proyectoAbiertoId, setProyectoAbiertoId] = useState<number | null>(null)

  const [resumen, setResumen] = useState('')
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [contexto, setContexto] = useState<ContextoDetalleProyecto | null>(null)
  const [itemsExpandidos, setItemsExpandidos] = useState<Set<number>>(new Set())

  const [respuestas, setRespuestas] = useState<RespuestasChecklist>({})
  const [requiereSeguimiento, setRequiereSeguimiento] = useState<'si' | 'no' | null>(null)
  const [porQueSeguimiento, setPorQueSeguimiento] = useState('')
  const [accionPendiente, setAccionPendiente] = useState<Accion>(null)
  const [enviando, setEnviando] = useState(false)

  const refrescar = () => {
    setCargando(true)
    setError('')
    // El usuario logueado puede tener asignaciones en otras etapas (p. ej. si
    // además integra Comité de Investigación o es Par Evaluador) — hay que
    // acotar la bandeja a la etapa "Etica" para no mezclar proyectos ajenos.
    listarEtapas()
      .then((etapas) => {
        const idEtapaEtica = etapas.find((e) => e.nombre === 'Etica')?.id_etapa
        return cargarProyectosAsignados(idEtapaEtica)
      })
      .then(setProyectos)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los proyectos asignados.'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    refrescar()
  }, [])

  const remitidos = proyectos.filter((p) => p.abierta && p.estado === 'Pendiente').length
  const pendientes = proyectos.filter((p) => p.abierta && p.estado === 'En revisión').length
  const revisados = proyectos.filter(
    (p) => p.resultadoFinal === 'aprobado' || p.resultadoFinal === 'aprobado_con_correcciones'
  )
  const rechazados = proyectos.filter(
    (p) => p.resultadoFinal === 'rechazado' || p.resultadoFinal === 'no_cumple'
  ).length

  const asignados = proyectos
  const pendientesAsignados = proyectos.filter((p) => p.abierta)

  const abrirLista = (categoria: CategoriaLista) => {
    setCategoriaLista(categoria)
    setBusqueda('')
    setVista('lista')
  }

  const abrirDetalle = (id_proyecto: number) => {
    // Con qué categoría se abrió: solo desde "Proyectos pendientes" se puede
    // calificar. "Proyectos asignados" es un listado de referencia (incluye
    // proyectos ya evaluados), no debe permitir editar/evaluar desde ahí.
    setOrigenCategoria(categoriaLista)
    setProyectoAbiertoId(id_proyecto)
    setRespuestas({})
    setRequiereSeguimiento(null)
    setPorQueSeguimiento('')
    setItemsExpandidos(new Set())
    setContexto(null)
    setError('')
    setVista('detalle')

    setCargandoDetalle(true)
    Promise.all([
      proyectosApi.obtenerProyecto(id_proyecto),
      proyectosApi.listarParticipantes(id_proyecto),
      proyectosApi.listarAreasProyecto(id_proyecto),
      proyectosApi.listarProgramasProyecto(id_proyecto),
      proyectosApi.obtenerFinanciacionProyecto(id_proyecto).catch(() => null),
      proyectosApi.listarGruposDelProyecto(id_proyecto),
      proyectosApi.listarObjetivosProyecto(id_proyecto),
      proyectosApi.listarAntecedentesProyecto(id_proyecto),
      proyectosApi.listarReferenciasProyecto(id_proyecto),
      proyectosApi.listarActividadesCronograma(id_proyecto),
      proyectosApi.listarProductosProyecto(id_proyecto),
      documentosApi.listarDocumentosProyecto(id_proyecto),
    ])
      .then(([proyecto, participantes, areas, programas, financiacion, grupos, objetivos, antecedentes, referencias, cronograma, productos, documentos]) => {
        setResumen(proyecto.resumen ?? '')
        setContexto({ proyecto, participantes, areas, programas, financiacion, grupos, objetivos, antecedentes, referencias, cronograma, productos, documentos })
      })
      .catch(() => {
        setResumen('')
        setContexto(null)
      })
      .finally(() => setCargandoDetalle(false))
  }

  const toggleItem = (id: number) => {
    setItemsExpandidos((actual) => {
      const siguiente = new Set(actual)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  const handleDescargarDocumento = (doc: documentosApi.DocumentoProyecto) => {
    documentosApi
      .descargarDocumentoProyecto(doc.id_proyecto, doc.id_proyecto_documento, doc.archivo)
      .catch(() => setError('No se pudo descargar el documento.'))
  }

  const handleVerDocumento = (doc: documentosApi.DocumentoProyecto) => {
    documentosApi
      .verDocumentoProyecto(doc.id_proyecto, doc.id_proyecto_documento)
      .catch(() => setError('No se pudo abrir el documento.'))
  }

  const volverAPanel = () => setVista('panel')
  const volverALista = () => setVista('lista')

  const confirmarAccion = () => {
    if (proyectoAbiertoId === null || !accionPendiente) return
    const proyecto = proyectos.find((p) => p.id_proyecto === proyectoAbiertoId)
    if (!proyecto) return

    const resultado: evaluacionesApi.ResultadoEvaluacion =
      accionPendiente === 'aprobar' ? 'aprobado' : 'aprobado_con_correcciones'

    const bloqueChecklist = construirBloqueChecklist('Lista de chequeo (INV-IC-FR-020):', checklistEtica, respuestas)
    const seguimientoTexto =
      requiereSeguimiento &&
      `¿Requiere seguimiento del Comité de Ética?: ${requiereSeguimiento === 'si' ? 'SI' : 'NO'}${
        porQueSeguimiento.trim() ? ` — ¿Por qué? ${porQueSeguimiento.trim()}` : ''
      }`
    const comentarios = [bloqueChecklist, seguimientoTexto].filter(Boolean).join('\n\n')

    setEnviando(true)
    evaluacionesApi
      .registrarEvaluacion(proyecto.id_proyecto, proyecto.id_etapa, {
        resultado,
        comentarios,
      })
      .then(() => {
        setAccionPendiente(null)
        setVista('lista')
        refrescar()
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo registrar la evaluación.'))
      .finally(() => setEnviando(false))
  }

  const marcarCumple = (id: number, cumple: 'si' | 'no') => {
    setRespuestas((actual) => ({
      ...actual,
      [id]: { ...(actual[id] ?? respuestaVacia()), cumple },
    }))
  }

  const marcarObservacion = (id: number, observaciones: string) => {
    setRespuestas((actual) => ({
      ...actual,
      [id]: { ...(actual[id] ?? respuestaVacia()), observaciones },
    }))
  }

  const listaBase =
    categoriaLista === 'asignados' ? asignados : categoriaLista === 'pendientes' ? pendientesAsignados : revisados

  const listaFiltrada = listaBase
    .filter((p) =>
      [p.titulo, p.investigadorPrincipal, p.convocatoria].some((campo) =>
        campo.toLowerCase().includes(busqueda.toLowerCase())
      )
    )
    .sort((a, b) => (orden === 'titulo-asc' ? a.titulo.localeCompare(b.titulo) : b.titulo.localeCompare(a.titulo)))

  const proyectoAbierto = proyectos.find((p) => p.id_proyecto === proyectoAbiertoId) ?? null

  // El checklist define la decisión: solo con TODOS los criterios en SI se
  // puede aprobar (y así avanzar automáticamente a la siguiente etapa); si
  // hay al menos un NO, el envío pide correcciones automáticamente.
  const todosSI = todosCumplenSi(checklistEtica, respuestas)
  // Antes de poder enviar: cada ítem debe quedar marcado (SI o NO), y todo
  // ítem en NO debe llevar una observación — si no, el investigador no
  // tendría ninguna pista de qué corregir.
  const checklistCompleto = checklistEtica.every((item) => respuestas[item.id]?.cumple != null)
  const faltaObservacionEnNo = checklistEtica.some(
    (item) => respuestas[item.id]?.cumple === 'no' && !respuestas[item.id]?.observaciones.trim()
  )
  const listoParaEnviar = checklistCompleto && !faltaObservacionEnNo

  if (cargando) {
    return (
      <div className="cetica-page">
        <p className="cetica-empty">Cargando proyectos asignados...</p>
      </div>
    )
  }

  if (vista === 'panel') {
    return (
      <div className="cetica-page">
        {error && <p className="cetica-empty">{error}</p>}

        <div className="cetica-stats-grid">
          <div className="cetica-stat-card">
            <FileText size={18} className="cetica-stat-icon" />
            <span className="cetica-stat-label">Proyectos remitidos</span>
            <span className="cetica-stat-badge" style={{ background: '#2f5fa8' }}>{remitidos}</span>
          </div>
          <div className="cetica-stat-card">
            <Clock size={18} className="cetica-stat-icon" />
            <span className="cetica-stat-label">Proyectos pendientes</span>
            <span className="cetica-stat-badge" style={{ background: '#f2c94c', color: '#5c4600' }}>{pendientes}</span>
          </div>
          <div className="cetica-stat-card">
            <CheckSquare size={18} className="cetica-stat-icon" />
            <span className="cetica-stat-label">Proyectos revisados</span>
            <span className="cetica-stat-badge" style={{ background: '#27ae60' }}>{revisados.length}</span>
          </div>
          <div className="cetica-stat-card">
            <XCircle size={18} className="cetica-stat-icon" />
            <span className="cetica-stat-label">Proyectos rechazados</span>
            <span className="cetica-stat-badge" style={{ background: '#c0392b' }}>{rechazados}</span>
          </div>
        </div>

        <div className="cetica-paneles">
          <div className="cetica-panel">
            <div className="cetica-panel-header cetica-panel-header-azul">Proyectos asignados</div>
            <div className="cetica-panel-lista">
              {asignados.slice(0, 3).map((p) => (
                <div className="cetica-panel-item" key={p.id_asignacion}>
                  <FileText size={14} />
                  {p.titulo}
                </div>
              ))}
              {asignados.length === 0 && <p className="cetica-empty">No hay proyectos asignados.</p>}
            </div>
            <button type="button" className="cetica-ver-todos" onClick={() => abrirLista('asignados')}>
              Ver todos
            </button>
          </div>

          <div className="cetica-panel">
            <div className="cetica-panel-header cetica-panel-header-amarillo">Proyectos pendientes</div>
            <div className="cetica-panel-lista">
              {pendientesAsignados.slice(0, 3).map((p) => (
                <div className="cetica-panel-item" key={p.id_asignacion}>
                  <FileCheck size={14} />
                  {p.titulo}
                </div>
              ))}
              {pendientesAsignados.length === 0 && <p className="cetica-empty">No hay proyectos pendientes.</p>}
            </div>
            <button type="button" className="cetica-ver-todos" onClick={() => abrirLista('pendientes')}>
              Ver todos
            </button>
          </div>

          <div className="cetica-panel">
            <div className="cetica-panel-header cetica-panel-header-verde">Proyectos revisados</div>
            <div className="cetica-panel-lista">
              {revisados.slice(0, 3).map((p) => (
                <div className="cetica-panel-item" key={p.id_asignacion}>
                  <CheckSquare size={14} />
                  {p.titulo}
                </div>
              ))}
              {revisados.length === 0 && <p className="cetica-empty">No hay proyectos revisados.</p>}
            </div>
            <button type="button" className="cetica-ver-todos" onClick={() => abrirLista('revisados')}>
              Ver todos
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (vista === 'lista') {
    return (
      <div className="cetica-page">
        <button type="button" className="cetica-volver" onClick={volverAPanel}>
          <ArrowLeft size={16} />
          Volver al panel
        </button>

        {error && <p className="cetica-empty">{error}</p>}

        <div className="cetica-lista-header-card">
          <h2>Proyectos {categoriaLista}</h2>
          <p>
            Listado de proyectos{' '}
            {categoriaLista === 'asignados'
              ? 'asignados al comité'
              : categoriaLista === 'pendientes'
                ? 'pendientes de evaluación'
                : 'ya revisados'}
          </p>
        </div>

        <div className="cetica-filtros">
          <div className="cetica-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Busca por título, investigador o convocatoria"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="cetica-orden">
            <span>Ordenar por:</span>
            <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
              <option value="titulo-asc">Título A-Z</option>
              <option value="titulo-desc">Título Z-A</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="cetica-tabla">
          <div className="cetica-tabla-header">
            <span>Título</span>
            <span>Investigador principal</span>
            <span>Convocatoria</span>
            <span>Estado</span>
          </div>

          {listaFiltrada.map((p) =>
            // Una vez cerrada la etapa (ya tiene resultado), no se puede volver a
            // entrar: "Proyectos asignados"/"Proyectos revisados" solo dejan ver
            // la fila, no abrir el detalle. Solo "Proyectos pendientes" (todavía
            // abierta) se puede abrir, para calificar.
            p.abierta ? (
              <button type="button" className="cetica-tabla-row" key={p.id_asignacion} onClick={() => abrirDetalle(p.id_proyecto)}>
                <span className="cetica-fila-titulo">{p.titulo}</span>
                <span>{p.investigadorPrincipal}</span>
                <span>{p.convocatoria}</span>
                <span className="cetica-estado-badge" style={{ background: estadoConfig[p.estado].color }}>
                  {p.estado}
                </span>
              </button>
            ) : (
              <div className="cetica-tabla-row cetica-tabla-row-cerrada" key={p.id_asignacion}>
                <span className="cetica-fila-titulo">{p.titulo}</span>
                <span>{p.investigadorPrincipal}</span>
                <span>{p.convocatoria}</span>
                <span className="cetica-estado-badge" style={{ background: estadoConfig[p.estado].color }}>
                  {p.estado}
                </span>
              </div>
            )
          )}

          {listaFiltrada.length === 0 && (
            <p className="cetica-empty">No se encontraron proyectos.</p>
          )}
        </div>
      </div>
    )
  }

  if (!proyectoAbierto) {
    return (
      <div className="cetica-page">
        <p className="cetica-empty">No se encontró el proyecto.</p>
      </div>
    )
  }

  return (
    <div className="cetica-page">
      <button type="button" className="cetica-volver" onClick={volverALista}>
        <ArrowLeft size={16} />
        Volver
      </button>

      {error && <p className="cetica-empty">{error}</p>}

      <h2 className="cetica-detalle-titulo-pagina">Detalles del proyecto para revisión del comité</h2>

      <div className="cetica-detalle-info">
        <div className="cetica-detalle-info-top">
          <div>
            <p className="cetica-detalle-proyecto-nombre">{proyectoAbierto.titulo}</p>
            <p>Estado: <strong>{proyectoAbierto.estado}</strong></p>
          </div>
          <div className="cetica-detalle-fechas">
            <span>Fecha de envío: {proyectoAbierto.fechaEnvio}</span>
            <span>Fecha límite de evaluación: {proyectoAbierto.fechaLimiteEvaluacion ?? 'Sin definir'}</span>
          </div>
        </div>

        <p className="cetica-resumen-label">Resumen de proyecto</p>
        <p className="cetica-resumen-texto">{cargandoDetalle ? 'Cargando...' : resumen || 'Sin resumen registrado.'}</p>
      </div>

      {proyectoAbierto.abierta && origenCategoria === 'pendientes' ? (
        <div className="cetica-calificacion">
          <h3>Calificación del comité</h3>

          <div className="cetica-calificacion-body">
            <p className="cetica-checklist-titulo">Lista de chequeo — INV-IC-FR-020</p>
            <table className="cetica-checklist-tabla">
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th>SI</th>
                  <th>NO</th>
                  <th>OBSERVACIONES</th>
                </tr>
              </thead>
              <tbody>
                {checklistEtica.map((item, i) => {
                  // Cada ítem aparece solo después de que se diligenció el
                  // anterior — el checklist se va revelando conforme se avanza,
                  // no se muestra todo de una vez. "Diligenciado" es marcar SI,
                  // marcar NO, o escribir algo en observaciones — cualquiera
                  // de los tres alcanza.
                  const anterior = respuestas[checklistEtica[i - 1]?.id]
                  const visible = i === 0 || anterior?.cumple != null || Boolean(anterior?.observaciones.trim())
                  if (!visible) return null
                  const r = respuestas[item.id]
                  const bloque = contexto ? construirDetalleItemEtica(item.id, contexto) : null
                  const expandible = bloque !== null
                  const expandido = itemsExpandidos.has(item.id)
                  return (
                    <Fragment key={item.id}>
                      <tr className="cetica-checklist-fila-revelada">
                        <td>
                          {expandible ? (
                            <button
                              type="button"
                              className="cetica-datos-generales-toggle"
                              onClick={() => toggleItem(item.id)}
                            >
                              {item.texto}
                              <ChevronDown
                                size={14}
                                className={expandido ? 'cetica-chevron-abierto' : ''}
                              />
                            </button>
                          ) : (
                            item.texto
                          )}
                        </td>
                        <td className="cetica-checklist-radio-celda">
                          <input
                            type="radio"
                            name={`cetica-cumple-${item.id}`}
                            checked={r?.cumple === 'si'}
                            onChange={() => marcarCumple(item.id, 'si')}
                          />
                        </td>
                        <td className="cetica-checklist-radio-celda">
                          <input
                            type="radio"
                            name={`cetica-cumple-${item.id}`}
                            checked={r?.cumple === 'no'}
                            onChange={() => marcarCumple(item.id, 'no')}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={`cetica-checklist-obs${r?.cumple === 'no' && !r.observaciones.trim() ? ' cetica-checklist-obs-requerida' : ''}`}
                            value={r?.observaciones ?? ''}
                            onChange={(e) => marcarObservacion(item.id, e.target.value)}
                            placeholder={r?.cumple === 'no' ? 'Observación obligatoria...' : 'Observaciones...'}
                          />
                        </td>
                      </tr>
                      {expandido && (
                        <tr className="cetica-datos-generales-fila">
                          <td colSpan={4}>
                            {cargandoDetalle || !bloque ? (
                              <p className="cetica-empty">Cargando...</p>
                            ) : bloque.tipo === 'campos' ? (
                              <ul className="cetica-datos-generales-lista">
                                {bloque.campos.map((campo, idx) => (
                                  <li key={campo.label} style={{ animationDelay: `${idx * 0.45}s` }}>
                                    <strong>{campo.label}:</strong> {campo.valor}
                                  </li>
                                ))}
                              </ul>
                            ) : bloque.tipo === 'lista' ? (
                              bloque.items.length > 0 ? (
                                <ul className="cetica-datos-generales-lista">
                                  {bloque.items.map((linea, idx) => (
                                    <li key={idx} style={{ animationDelay: `${idx * 0.45}s` }}>{linea}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="cetica-empty">Sin información registrada.</p>
                              )
                            ) : bloque.tipo === 'documento' ? (
                              bloque.documento ? (
                                <div className="cetica-detalle-documento-acciones">
                                  <button type="button" className="cetica-detalle-documento-btn" onClick={() => handleVerDocumento(bloque.documento!)}>
                                    <FileText size={14} />
                                    {bloque.documento.tipoDocumento.nombre}
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="cetica-detalle-documento-descargar"
                                    aria-label="Descargar"
                                    title="Descargar"
                                    onClick={() => handleDescargarDocumento(bloque.documento!)}
                                  >
                                    <Download size={14} />
                                  </button>
                                </div>
                              ) : (
                                <p className="cetica-empty">Este archivo no ha sido cargado — posiblemente no sea obligatorio su cargue.</p>
                              )
                            ) : (
                              <p className="cetica-datos-generales-texto">{bloque.texto}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>

            <div className="cetica-seguimiento">
              <p>¿La investigación requiere seguimiento por parte del Comité de Ética?</p>
              <div className="cetica-seguimiento-opciones">
                <label>
                  <input
                    type="radio"
                    name="cetica-requiere-seguimiento"
                    checked={requiereSeguimiento === 'si'}
                    onChange={() => setRequiereSeguimiento('si')}
                  />
                  SI
                </label>
                <label>
                  <input
                    type="radio"
                    name="cetica-requiere-seguimiento"
                    checked={requiereSeguimiento === 'no'}
                    onChange={() => setRequiereSeguimiento('no')}
                  />
                  NO
                </label>
              </div>
              <input
                type="text"
                className="cetica-seguimiento-porque"
                placeholder="¿Por qué?"
                value={porQueSeguimiento}
                onChange={(e) => setPorQueSeguimiento(e.target.value)}
              />
            </div>

            <div className="cetica-decision-botones">
              <button
                type="button"
                className="cetica-btn-aprobar"
                onClick={() => setAccionPendiente(todosSI ? 'aprobar' : 'correcciones')}
                disabled={enviando || !listoParaEnviar}
              >
                Enviar
              </button>
              <button type="button" className="cetica-btn-cancelar" onClick={volverALista} disabled={enviando}>
                Cancelar
              </button>
            </div>
            <p className="cetica-decision-ayuda">
              {!checklistCompleto
                ? 'Marca SI o NO en cada criterio para poder enviar.'
                : faltaObservacionEnNo
                  ? 'Todo criterio marcado NO debe llevar una observación.'
                  : todosSI
                    ? 'Todos los criterios están en SI: al enviar, el proyecto se aprueba y avanza automáticamente a la siguiente etapa (Pares).'
                    : 'Hay criterios en NO: al enviar, el proyecto queda pendiente de correcciones (2 días de plazo para el investigador).'}
            </p>
          </div>
        </div>
      ) : proyectoAbierto.abierta ? (
        <p className="cetica-resumen-texto">
          Este proyecto todavía está pendiente de evaluación — para calificarlo, ábrelo desde "Proyectos pendientes".
        </p>
      ) : (
        <div className="cetica-resumen-evaluacion">
          <h3>Resumen de evaluación</h3>
          <p>
            Resultado: <strong>{proyectoAbierto.estado}</strong>
          </p>
          {proyectoAbierto.fechaLimiteCorreccion && (
            <p>
              Plazo para que el investigador reenvíe las correcciones: <strong>{proyectoAbierto.fechaLimiteCorreccion}</strong>
            </p>
          )}
          {proyectoAbierto.comentariosEvaluacion ? (
            (() => {
              const { titulo, items, observacionFinal } = parsearChecklistComite(proyectoAbierto.comentariosEvaluacion)
              return items.length > 0 ? (
                <div className="cetica-checklist-resumen">
                  {titulo && <p className="cetica-checklist-resumen-titulo">{titulo}</p>}
                  {items.map((item, i) => (
                    <div className="cetica-checklist-resumen-fila" key={i}>
                      <span className="cetica-checklist-resumen-texto">{item.texto}</span>
                      <span className={`cetica-checklist-resumen-marca cetica-checklist-resumen-marca-${item.cumple ?? 'sin-marcar'}`}>
                        {item.cumple === 'si' ? 'SI' : item.cumple === 'no' ? 'NO' : 'Sin marcar'}
                      </span>
                      {item.observacion && <span className="cetica-checklist-resumen-observacion">{item.observacion}</span>}
                    </div>
                  ))}
                  {observacionFinal && (
                    <div className="cetica-checklist-resumen-final">
                      <strong>Observación final:</strong> {observacionFinal}
                    </div>
                  )}
                </div>
              ) : (
                <pre className="cetica-resumen-evaluacion-texto">{proyectoAbierto.comentariosEvaluacion}</pre>
              )
            })()
          ) : (
            <p className="cetica-empty">No hay comentarios registrados para esta evaluación.</p>
          )}
        </div>
      )}

      {accionPendiente === 'aprobar' && (
        <ConfirmModal
          mensaje="Confirma la aprobación del proyecto?"
          botonSecundario={{ label: 'No', onClick: () => setAccionPendiente(null), variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: confirmarAccion, variante: 'rojo' }}
          onClose={() => setAccionPendiente(null)}
        />
      )}

      {accionPendiente === 'correcciones' && (
        <ConfirmModal
          mensaje="¿Confirma el envío a correcciones? El investigador tendrá 2 días de plazo para reenviar el proyecto corregido."
          botonSecundario={{ label: 'No', onClick: () => setAccionPendiente(null), variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: confirmarAccion, variante: 'rojo' }}
          onClose={() => setAccionPendiente(null)}
        />
      )}

    </div>
  )
}

export default ComiteEtica
