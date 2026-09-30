import { Fragment, useEffect, useState } from 'react'
import {
  FileCheck, Clock, CheckSquare, XCircle, FileText, Search, ArrowLeft, ChevronDown,
} from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import { estadoConfig } from '../../../shared/lib/estado'
import { ApiError } from '../../../shared/api/client'
import * as evaluacionesApi from '../../evaluaciones/api/evaluaciones'
import * as proyectosApi from '../../proyectos/api/proyectos'
import { cargarProyectosAsignados, type ProyectoEnRevision } from '../../evaluaciones/lib/bandejaEvaluacion'
import {
  checklistEtica,
  construirBloqueChecklist,
  respuestaVacia,
  todosCumplenSi,
  type RespuestasChecklist,
} from '../../evaluaciones/lib/checklistComite'
import { construirCamposDatosGenerales, type CampoDatoGeneral } from '../../evaluaciones/lib/datosGeneralesProyecto'
import './ComiteEtica.css'

type Vista = 'panel' | 'lista' | 'detalle'
type CategoriaLista = 'asignados' | 'pendientes' | 'revisados'
type Orden = 'titulo-asc' | 'titulo-desc'
type Accion = 'aprobar' | 'correcciones' | 'rechazar' | null

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
  const [camposDatosGenerales, setCamposDatosGenerales] = useState<CampoDatoGeneral[]>([])
  const [mostrarDatosGenerales, setMostrarDatosGenerales] = useState(false)

  const [respuestas, setRespuestas] = useState<RespuestasChecklist>({})
  const [requiereSeguimiento, setRequiereSeguimiento] = useState<'si' | 'no' | null>(null)
  const [porQueSeguimiento, setPorQueSeguimiento] = useState('')
  const [accionPendiente, setAccionPendiente] = useState<Accion>(null)
  const [enviando, setEnviando] = useState(false)

  const refrescar = () => {
    setCargando(true)
    setError('')
    cargarProyectosAsignados()
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
    setMostrarDatosGenerales(false)
    setCamposDatosGenerales([])
    setError('')
    setVista('detalle')

    setCargandoDetalle(true)
    Promise.all([
      proyectosApi.obtenerProyecto(id_proyecto),
      proyectosApi.listarParticipantes(id_proyecto),
      proyectosApi.listarAreasProyecto(id_proyecto),
      proyectosApi.listarProgramasProyecto(id_proyecto),
      proyectosApi.obtenerFinanciacionProyecto(id_proyecto).catch(() => null),
    ])
      .then(([proyecto, participantes, areas, programas, financiacion]) => {
        setResumen(proyecto.resumen ?? '')
        setCamposDatosGenerales(construirCamposDatosGenerales(proyecto, participantes, areas, programas, financiacion))
      })
      .catch(() => {
        setResumen('')
        setCamposDatosGenerales([])
      })
      .finally(() => setCargandoDetalle(false))
  }

  const volverAPanel = () => setVista('panel')
  const volverALista = () => setVista('lista')

  const confirmarAccion = () => {
    if (proyectoAbiertoId === null || !accionPendiente) return
    const proyecto = proyectos.find((p) => p.id_proyecto === proyectoAbiertoId)
    if (!proyecto) return

    const resultado: evaluacionesApi.ResultadoEvaluacion =
      accionPendiente === 'aprobar'
        ? 'aprobado'
        : accionPendiente === 'correcciones'
          ? 'aprobado_con_correcciones'
          : 'rechazado'

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
  // hay al menos un NO (o falta alguno), la única salida es Correcciones o
  // No aprobar.
  const todosSI = todosCumplenSi(checklistEtica, respuestas)

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

          {listaFiltrada.map((p) => (
            // "Proyectos asignados" y "Proyectos revisados" sí se pueden abrir:
            // si la etapa ya está cerrada, abrirDetalle muestra el resumen de
            // evaluación (solo lectura); si sigue abierta, solo se puede
            // calificar desde "Proyectos pendientes" (ver abrirDetalle).
            <button type="button" className="cetica-tabla-row" key={p.id_asignacion} onClick={() => abrirDetalle(p.id_proyecto)}>
              <span className="cetica-fila-titulo">{p.titulo}</span>
              <span>{p.investigadorPrincipal}</span>
              <span>{p.convocatoria}</span>
              <span className="cetica-estado-badge" style={{ background: estadoConfig[p.estado].color }}>
                {p.estado}
              </span>
            </button>
          ))}

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
                  const esDatosGenerales = item.id === 1
                  return (
                    <Fragment key={item.id}>
                      <tr className="cetica-checklist-fila-revelada">
                        <td>
                          {esDatosGenerales ? (
                            <button
                              type="button"
                              className="cetica-datos-generales-toggle"
                              onClick={() => setMostrarDatosGenerales((actual) => !actual)}
                            >
                              {item.texto}
                              <ChevronDown
                                size={14}
                                className={mostrarDatosGenerales ? 'cetica-chevron-abierto' : ''}
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
                            className="cetica-checklist-obs"
                            value={r?.observaciones ?? ''}
                            onChange={(e) => marcarObservacion(item.id, e.target.value)}
                            placeholder="Observaciones..."
                          />
                        </td>
                      </tr>
                      {esDatosGenerales && mostrarDatosGenerales && (
                        <tr className="cetica-datos-generales-fila">
                          <td colSpan={4}>
                            {camposDatosGenerales.length > 0 ? (
                              <ul className="cetica-datos-generales-lista">
                                {camposDatosGenerales.map((campo, i) => (
                                  <li key={campo.label} style={{ animationDelay: `${i * 0.45}s` }}>
                                    <strong>{campo.label}:</strong> {campo.valor}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="cetica-empty">Cargando datos generales...</p>
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
              <button type="button" className="cetica-btn-aprobar" onClick={() => setAccionPendiente('aprobar')} disabled={enviando || !todosSI}>
                Aprobar
              </button>
              <button type="button" className="cetica-btn-correcciones" onClick={() => setAccionPendiente('correcciones')} disabled={enviando || todosSI}>
                Correcciones
              </button>
              <button type="button" className="cetica-btn-rechazar" onClick={() => setAccionPendiente('rechazar')} disabled={enviando || todosSI}>
                No aprobar
              </button>
            </div>
            <p className="cetica-decision-ayuda">
              {todosSI
                ? 'Todos los criterios están en SI: puedes aprobar y el proyecto avanzará automáticamente a la siguiente etapa (Pares).'
                : 'Hay criterios en NO o sin marcar: solo puedes pedir correcciones (con 2 días de plazo para el investigador) o no aprobar el proyecto.'}
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
            <pre className="cetica-resumen-evaluacion-texto">{proyectoAbierto.comentariosEvaluacion}</pre>
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

      {accionPendiente === 'rechazar' && (
        <ConfirmModal
          mensaje="¿Desea rechazar el proyecto en revisión? El rechazo es definitivo, no tiene vuelta atrás."
          botonSecundario={{ label: 'No', onClick: () => setAccionPendiente(null), variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: confirmarAccion, variante: 'rojo' }}
          onClose={() => setAccionPendiente(null)}
        />
      )}
    </div>
  )
}

export default ComiteEtica
