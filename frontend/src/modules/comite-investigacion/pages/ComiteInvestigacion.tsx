import { Fragment, useEffect, useState } from 'react'
import {
  FileText, Clock, CheckSquare, Search, ArrowLeft, ChevronDown, Download, Eye,
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
  checklistInvestigacion,
  construirBloqueChecklist,
  parsearChecklistComite,
  respuestaVacia,
  todosCumplenSi,
  type RespuestasChecklist,
} from '../../evaluaciones/lib/checklistComite'
import { construirDetalleItemInvestigacion, type ContextoDetalleProyecto } from '../../evaluaciones/lib/detalleItemChecklist'
import './ComiteInvestigacion.css'

type Vista = 'panel' | 'lista' | 'detalle'
type CategoriaLista = 'asignados' | 'pendientes' | 'aprobados'
type Orden = 'titulo-asc' | 'titulo-desc'
type Accion = 'aprobar' | 'correcciones' | null

function ComiteInvestigacion() {
  const [proyectos, setProyectos] = useState<ProyectoEnRevision[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [vista, setVista] = useState<Vista>('panel')
  const [categoriaLista, setCategoriaLista] = useState<CategoriaLista>('asignados')
  const [origenCategoria, setOrigenCategoria] = useState<CategoriaLista | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('titulo-asc')
  const [proyectoAbiertoId, setProyectoAbiertoId] = useState<number | null>(null)

  const [contexto, setContexto] = useState<ContextoDetalleProyecto | null>(null)
  const [cargandoContexto, setCargandoContexto] = useState(false)
  const [itemsExpandidos, setItemsExpandidos] = useState<Set<number>>(new Set())

  const [respuestas, setRespuestas] = useState<RespuestasChecklist>({})
  const [observacionFinal, setObservacionFinal] = useState('')
  const [accionPendiente, setAccionPendiente] = useState<Accion>(null)
  const [enviando, setEnviando] = useState(false)

  const refrescar = () => {
    setCargando(true)
    setError('')
    // El usuario logueado puede tener asignaciones en otras etapas (p. ej. si
    // además integra Comité de Ética o es Par Evaluador) — hay que acotar la
    // bandeja a la etapa "Comite_Investigacion" para no mezclar proyectos ajenos.
    listarEtapas()
      .then((etapas) => {
        const idEtapaInvestigacion = etapas.find((e) => e.nombre === 'Comite_Investigacion')?.id_etapa
        return cargarProyectosAsignados(idEtapaInvestigacion)
      })
      .then(setProyectos)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los proyectos asignados.'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    refrescar()
  }, [])

  const asignados = proyectos
  const pendientes = proyectos.filter((p) => p.abierta)
  const aprobados = proyectos.filter((p) => p.resultadoFinal === 'aprobado')

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
    setObservacionFinal('')
    setItemsExpandidos(new Set())
    setContexto(null)
    setError('')
    setVista('detalle')

    setCargandoContexto(true)
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
        setContexto({ proyecto, participantes, areas, programas, financiacion, grupos, objetivos, antecedentes, referencias, cronograma, productos, documentos })
      })
      .catch(() => setContexto(null))
      .finally(() => setCargandoContexto(false))
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

    const bloqueChecklist = construirBloqueChecklist('Lista de chequeo (INV-IC-FR-009):', checklistInvestigacion, respuestas)
    const comentarios = [bloqueChecklist, observacionFinal.trim() && `Observación final: ${observacionFinal.trim()}`]
      .filter(Boolean)
      .join('\n\n')

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

  const listaBase = categoriaLista === 'asignados' ? asignados : categoriaLista === 'pendientes' ? pendientes : aprobados

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
  const todosSI = todosCumplenSi(checklistInvestigacion, respuestas)
  // Antes de poder enviar: cada ítem debe quedar marcado (SI o NO), y todo
  // ítem en NO debe llevar una observación — si no, el investigador no
  // tendría ninguna pista de qué corregir.
  const checklistCompleto = checklistInvestigacion.every((item) => respuestas[item.id]?.cumple != null)
  const faltaObservacionEnNo = checklistInvestigacion.some(
    (item) => respuestas[item.id]?.cumple === 'no' && !respuestas[item.id]?.observaciones.trim()
  )
  const listoParaEnviar = checklistCompleto && !faltaObservacionEnNo

  const tituloCategoria =
    categoriaLista === 'asignados' ? 'asignados' : categoriaLista === 'pendientes' ? 'pendientes' : 'revisados'

  if (cargando) {
    return (
      <div className="cinv-page">
        <p className="cinv-empty">Cargando proyectos asignados...</p>
      </div>
    )
  }

  if (vista === 'panel') {
    return (
      <div className="cinv-page">
        {error && <p className="cinv-error">{error}</p>}

        <div className="cinv-stats-grid">
          <div className="cinv-stat-card">
            <FileText size={18} className="cinv-stat-icon" />
            <span className="cinv-stat-label">Proyectos asignados</span>
            <span className="cinv-stat-badge" style={{ background: '#2f5fa8' }}>{asignados.length}</span>
          </div>
          <div className="cinv-stat-card">
            <Clock size={18} className="cinv-stat-icon" />
            <span className="cinv-stat-label">Proyectos pendientes</span>
            <span className="cinv-stat-badge" style={{ background: '#f2c94c', color: '#5c4600' }}>{pendientes.length}</span>
          </div>
          <div className="cinv-stat-card">
            <CheckSquare size={18} className="cinv-stat-icon" />
            <span className="cinv-stat-label">Proyectos revisados</span>
            <span className="cinv-stat-badge" style={{ background: '#27ae60' }}>{aprobados.length}</span>
          </div>
        </div>

        <div className="cinv-paneles">
          <div className="cinv-panel">
            <div className="cinv-panel-header cinv-panel-header-azul">Proyectos asignados</div>
            <div className="cinv-panel-lista">
              {asignados.slice(0, 3).map((p) => (
                <div className="cinv-panel-item" key={p.id_asignacion}>
                  <FileText size={14} />
                  {p.titulo}
                </div>
              ))}
              {asignados.length === 0 && <p className="cinv-empty">No hay proyectos asignados.</p>}
            </div>
            <button type="button" className="cinv-ver-todos" onClick={() => abrirLista('asignados')}>
              Ver todos
            </button>
          </div>

          <div className="cinv-panel">
            <div className="cinv-panel-header cinv-panel-header-amarillo">Proyectos pendientes</div>
            <div className="cinv-panel-lista">
              {pendientes.slice(0, 3).map((p) => (
                <div className="cinv-panel-item" key={p.id_asignacion}>
                  <FileText size={14} />
                  {p.titulo}
                </div>
              ))}
              {pendientes.length === 0 && <p className="cinv-empty">No hay proyectos pendientes.</p>}
            </div>
            <button type="button" className="cinv-ver-todos" onClick={() => abrirLista('pendientes')}>
              Ver todos
            </button>
          </div>

          <div className="cinv-panel">
            <div className="cinv-panel-header cinv-panel-header-verde">Proyectos revisados</div>
            <div className="cinv-panel-lista">
              {aprobados.slice(0, 3).map((p) => (
                <div className="cinv-panel-item" key={p.id_asignacion}>
                  <CheckSquare size={14} />
                  {p.titulo}
                </div>
              ))}
              {aprobados.length === 0 && <p className="cinv-empty">No hay proyectos revisados.</p>}
            </div>
            <button type="button" className="cinv-ver-todos" onClick={() => abrirLista('aprobados')}>
              Ver todos
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (vista === 'lista') {
    return (
      <div className="cinv-page">
        <button type="button" className="cinv-volver" onClick={volverAPanel}>
          <ArrowLeft size={16} />
          Volver al panel
        </button>

        {error && <p className="cinv-error">{error}</p>}

        <div className="cinv-lista-header-card">
          <h2>Proyectos {tituloCategoria}</h2>
          <p>Listado de proyectos {categoriaLista === 'pendientes' ? 'pendientes de evaluación' : tituloCategoria}</p>
        </div>

        <div className="cinv-filtros">
          <div className="cinv-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Busca por título, investigador o convocatoria"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="cinv-orden">
            <span>Ordenar por:</span>
            <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
              <option value="titulo-asc">Título A-Z</option>
              <option value="titulo-desc">Título Z-A</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="cinv-tabla">
          <div className="cinv-tabla-header">
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
              <button type="button" className="cinv-tabla-row" key={p.id_asignacion} onClick={() => abrirDetalle(p.id_proyecto)}>
                <span className="cinv-fila-titulo">{p.titulo}</span>
                <span>{p.investigadorPrincipal}</span>
                <span>{p.convocatoria}</span>
                <span className="cinv-estado-badge" style={{ background: estadoConfig[p.estado].color }}>
                  {p.estado}
                </span>
              </button>
            ) : (
              <div className="cinv-tabla-row cinv-tabla-row-cerrada" key={p.id_asignacion}>
                <span className="cinv-fila-titulo">{p.titulo}</span>
                <span>{p.investigadorPrincipal}</span>
                <span>{p.convocatoria}</span>
                <span className="cinv-estado-badge" style={{ background: estadoConfig[p.estado].color }}>
                  {p.estado}
                </span>
              </div>
            )
          )}

          {listaFiltrada.length === 0 && <p className="cinv-empty">No se encontraron proyectos.</p>}
        </div>
      </div>
    )
  }

  if (!proyectoAbierto) {
    return (
      <div className="cinv-page">
        <p className="cinv-empty">No se encontró el proyecto.</p>
      </div>
    )
  }

  return (
    <div className="cinv-page">
      <button type="button" className="cinv-volver" onClick={volverALista}>
        <ArrowLeft size={16} />
        Volver
      </button>

      {error && <p className="cinv-error">{error}</p>}

      <h2 className="cinv-detalle-titulo-pagina">Detalles del proyecto para revisión del comité</h2>

      <div className="cinv-detalle-info">
        <div className="cinv-detalle-info-top">
          <div>
            <p><strong>Título del proyecto:</strong> {proyectoAbierto.titulo}</p>
            <p><strong>Investigador principal del proyecto:</strong> {proyectoAbierto.investigadorPrincipal}</p>
            <p className="cinv-detalle-estado-linea">
              <strong>Estado del proyecto:</strong>
              <span className="cinv-estado-punto" style={{ background: estadoConfig[proyectoAbierto.estado].color }} />
              {proyectoAbierto.estado}
            </p>
          </div>
          <div className="cinv-detalle-fechas">
            <span>Fecha de envío: {proyectoAbierto.fechaEnvio}</span>
            <span>Fecha límite de evaluación: {proyectoAbierto.fechaLimiteEvaluacion ?? 'Sin definir'}</span>
          </div>
        </div>
      </div>

      {proyectoAbierto.abierta && origenCategoria === 'pendientes' ? (
        <div className="cinv-calificacion">
          <h3>Calificación del comité</h3>

          <div className="cinv-calificacion-body">
            <p className="cinv-checklist-titulo">Lista de chequeo — INV-IC-FR-009</p>
            <table className="cinv-checklist-tabla">
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th>SI</th>
                  <th>NO</th>
                  <th>OBSERVACIÓN</th>
                </tr>
              </thead>
              <tbody>
                {checklistInvestigacion.map((item, i) => {
                  // Cada ítem aparece solo después de que se diligenció el
                  // anterior — el checklist se va revelando conforme se avanza,
                  // no se muestra todo de una vez. "Diligenciado" es marcar SI,
                  // marcar NO, o escribir algo en observación — cualquiera de
                  // los tres alcanza.
                  const anterior = respuestas[checklistInvestigacion[i - 1]?.id]
                  const visible = i === 0 || anterior?.cumple != null || Boolean(anterior?.observaciones.trim())
                  if (!visible) return null
                  const r = respuestas[item.id]
                  const bloque = contexto ? construirDetalleItemInvestigacion(item.id, contexto) : null
                  const expandible = bloque !== null
                  const expandido = itemsExpandidos.has(item.id)
                  return (
                    <Fragment key={item.id}>
                      <tr className="cinv-checklist-fila-revelada">
                        <td>
                          {expandible ? (
                            <button
                              type="button"
                              className="cinv-datos-generales-toggle"
                              onClick={() => toggleItem(item.id)}
                            >
                              {item.texto}
                              <ChevronDown
                                size={14}
                                className={expandido ? 'cinv-chevron-abierto' : ''}
                              />
                            </button>
                          ) : (
                            item.texto
                          )}
                        </td>
                        <td className="cinv-checklist-radio-celda">
                          <input
                            type="radio"
                            name={`cinv-cumple-${item.id}`}
                            checked={r?.cumple === 'si'}
                            onChange={() => marcarCumple(item.id, 'si')}
                          />
                        </td>
                        <td className="cinv-checklist-radio-celda">
                          <input
                            type="radio"
                            name={`cinv-cumple-${item.id}`}
                            checked={r?.cumple === 'no'}
                            onChange={() => marcarCumple(item.id, 'no')}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={`cinv-checklist-obs${r?.cumple === 'no' && !r.observaciones.trim() ? ' cinv-checklist-obs-requerida' : ''}`}
                            value={r?.observaciones ?? ''}
                            onChange={(e) => marcarObservacion(item.id, e.target.value)}
                            placeholder={r?.cumple === 'no' ? 'Observación obligatoria...' : 'Observación...'}
                          />
                        </td>
                      </tr>
                      {expandido && (
                        <tr className="cinv-datos-generales-fila">
                          <td colSpan={4}>
                            {cargandoContexto || !bloque ? (
                              <p className="cinv-empty">Cargando...</p>
                            ) : bloque.tipo === 'campos' ? (
                              <ul className="cinv-datos-generales-lista">
                                {bloque.campos.map((campo, idx) => (
                                  <li key={campo.label} style={{ animationDelay: `${idx * 0.45}s` }}>
                                    <strong>{campo.label}:</strong> {campo.valor}
                                  </li>
                                ))}
                              </ul>
                            ) : bloque.tipo === 'lista' ? (
                              bloque.items.length > 0 ? (
                                <ul className="cinv-datos-generales-lista">
                                  {bloque.items.map((linea, idx) => (
                                    <li key={idx} style={{ animationDelay: `${idx * 0.45}s` }}>{linea}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="cinv-empty">Sin información registrada.</p>
                              )
                            ) : bloque.tipo === 'documento' ? (
                              bloque.documento ? (
                                <div className="cinv-detalle-documento-acciones">
                                  <button type="button" className="cinv-detalle-documento-btn" onClick={() => handleVerDocumento(bloque.documento!)}>
                                    <FileText size={14} />
                                    {bloque.documento.tipoDocumento.nombre}
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="cinv-detalle-documento-descargar"
                                    aria-label="Descargar"
                                    title="Descargar"
                                    onClick={() => handleDescargarDocumento(bloque.documento!)}
                                  >
                                    <Download size={14} />
                                  </button>
                                </div>
                              ) : (
                                <p className="cinv-empty">Este archivo no ha sido cargado — posiblemente no sea obligatorio su cargue.</p>
                              )
                            ) : (
                              <p className="cinv-datos-generales-texto">{bloque.texto}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>

            <div className="cinv-observacion-final">
              <label>Observación final</label>
              <textarea
                value={observacionFinal}
                onChange={(e) => setObservacionFinal(e.target.value)}
                placeholder="Observación final..."
              />
            </div>

            <div className="cinv-decision-botones">
              <button
                type="button"
                className="cinv-btn-aprobar"
                onClick={() => setAccionPendiente(todosSI ? 'aprobar' : 'correcciones')}
                disabled={enviando || !listoParaEnviar}
              >
                Enviar
              </button>
              <button type="button" className="cinv-btn-cancelar" onClick={volverALista} disabled={enviando}>
                Cancelar
              </button>
            </div>
            <p className="cinv-decision-ayuda">
              {!checklistCompleto
                ? 'Marca SI o NO en cada criterio para poder enviar.'
                : faltaObservacionEnNo
                  ? 'Todo criterio marcado NO debe llevar una observación.'
                  : todosSI
                    ? 'Todos los criterios están en SI: al enviar, el proyecto se aprueba y avanza automáticamente a la siguiente etapa.'
                    : 'Hay criterios en NO: al enviar, el proyecto queda pendiente de correcciones (2 días de plazo para el investigador).'}
            </p>
          </div>
        </div>
      ) : proyectoAbierto.abierta ? (
        <p className="cinv-nota-cerrada">
          Este proyecto todavía está pendiente de evaluación — para calificarlo, ábrelo desde "Proyectos pendientes".
        </p>
      ) : (
        <div className="cinv-resumen-evaluacion">
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
                <div className="cinv-checklist-resumen">
                  {titulo && <p className="cinv-checklist-resumen-titulo">{titulo}</p>}
                  {items.map((item, i) => (
                    <div className="cinv-checklist-resumen-fila" key={i}>
                      <span className="cinv-checklist-resumen-texto">{item.texto}</span>
                      <span className={`cinv-checklist-resumen-marca cinv-checklist-resumen-marca-${item.cumple ?? 'sin-marcar'}`}>
                        {item.cumple === 'si' ? 'SI' : item.cumple === 'no' ? 'NO' : 'Sin marcar'}
                      </span>
                      {item.observacion && <span className="cinv-checklist-resumen-observacion">{item.observacion}</span>}
                    </div>
                  ))}
                  {observacionFinal && (
                    <div className="cinv-checklist-resumen-final">
                      <strong>Observación final:</strong> {observacionFinal}
                    </div>
                  )}
                </div>
              ) : (
                <pre className="cinv-resumen-texto">{proyectoAbierto.comentariosEvaluacion}</pre>
              )
            })()
          ) : (
            <p className="cinv-empty">No hay comentarios registrados para esta evaluación.</p>
          )}
        </div>
      )}

      {accionPendiente === 'aprobar' && (
        <ConfirmModal
          mensaje="¿Confirma la aprobación del proyecto?"
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

export default ComiteInvestigacion
