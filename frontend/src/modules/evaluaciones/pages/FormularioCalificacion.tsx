import { Fragment, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Download, Save } from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import { ApiError } from '../../../shared/api/client'
import * as evaluacionesApi from '../api/evaluaciones'
import * as proyectosApi from '../../proyectos/api/proyectos'
import { cargarDatosVistaProyecto } from '../../proyectos/lib/datosVistaProyecto'
import { generarPdfProyecto } from '../../proyectos/lib/exportarProyecto'
import { criteriosEvaluacion, type PuntajeCriterio } from '../lib/parEvaluador'
import { construirDetalleItemPar, MESES_ABREV, type ContextoDetalleProyecto } from '../lib/detalleItemChecklist'
import './FormularioCalificacion.css'

type ContextoPar = Pick<ContextoDetalleProyecto, 'proyecto' | 'objetivos' | 'antecedentes' | 'referencias' | 'cronograma'>

function puntajesIniciales(): PuntajeCriterio[] {
  return criteriosEvaluacion.map((c) => ({ criterioId: c.id, puntaje: null, observacion: '' }))
}

/** Junta la rúbrica completa en un solo texto: el backend solo guarda un puntaje y un comentario por evaluación. */
function construirComentarios(puntajes: PuntajeCriterio[], observacionesGenerales: string): string {
  const lineas: string[] = []

  for (const c of criteriosEvaluacion) {
    const fila = puntajes.find((p) => p.criterioId === c.id)
    if (fila?.puntaje != null || fila?.observacion.trim()) {
      lineas.push(
        `Criterio ${c.numero} (${c.titulo}): ${fila?.puntaje ?? '—'}/${c.maximoPuntos}${fila?.observacion.trim() ? ` — ${fila.observacion.trim()}` : ''}`
      )
    }
  }

  if (observacionesGenerales.trim()) {
    lineas.push('', `Observaciones generales: ${observacionesGenerales.trim()}`)
  }

  return lineas.join('\n')
}

/**
 * El resultado individual de cada par ya no decide nada por sí solo: el
 * Administrador consolida el promedio de todos los pares evaluadores y envía
 * el resultado final (ver calcularPromedioPares/enviarResultadoPares en el
 * backend, que solo miran el puntaje, no este campo). Igual hay que mandar
 * un resultado válido en el registro individual, así que se deriva del
 * puntaje con la misma escala oficial, sin pedírselo al evaluador.
 */
function derivarResultado(totalAcumulado: number): evaluacionesApi.ResultadoEvaluacion {
  if (totalAcumulado >= 80) return 'aprobado'
  if (totalAcumulado >= 70) return 'aprobado_con_correcciones'
  return 'rechazado'
}

/**
 * Si el puntaje no alcanza "aprobado" (menos de 80, es decir que queda como
 * "aprobado con correcciones" o "rechazado"), la observación general es
 * obligatoria: sin ella el investigador no sabría qué corregir o mejorar.
 */
const PUNTAJE_MINIMO_SIN_OBSERVACION = 80

function FormularioCalificacion() {
  const navigate = useNavigate()
  const location = useLocation()
  const estado = location.state as { id_proyecto?: number; id_etapa?: number; titulo?: string } | undefined
  const idProyecto = estado?.id_proyecto ?? null
  const idEtapa = estado?.id_etapa ?? null
  const tituloProyecto = estado?.titulo ?? ''

  const [puntajes, setPuntajes] = useState<PuntajeCriterio[]>(puntajesIniciales())
  const [observacionesGenerales, setObservacionesGenerales] = useState('')
  const [pedirConfirmacion, setPedirConfirmacion] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [intentosSinObservacion, setIntentosSinObservacion] = useState(0)

  const [contextoPar, setContextoPar] = useState<ContextoPar | null>(null)
  const [cargandoContexto, setCargandoContexto] = useState(true)
  const [criteriosExpandidos, setCriteriosExpandidos] = useState<Set<number>>(new Set())
  const [descargandoPdf, setDescargandoPdf] = useState(false)

  const observacionesRef = useRef<HTMLDivElement>(null)

  // Trae el contenido real del proyecto (planteamiento, objetivos,
  // antecedentes, referencias, cronograma) para que cada criterio pueda
  // mostrar, además de su descripción fija, lo que ese criterio evalúa en
  // ESTE proyecto — antes el formulario era puramente estático.
  useEffect(() => {
    if (idProyecto === null) return
    setCargandoContexto(true)
    Promise.all([
      proyectosApi.obtenerProyecto(idProyecto),
      proyectosApi.listarObjetivosProyecto(idProyecto),
      proyectosApi.listarAntecedentesProyecto(idProyecto),
      proyectosApi.listarReferenciasProyecto(idProyecto),
      proyectosApi.listarActividadesCronograma(idProyecto),
    ])
      .then(([proyecto, objetivos, antecedentes, referencias, cronograma]) => {
        setContextoPar({ proyecto, objetivos, antecedentes, referencias, cronograma })
      })
      .catch(() => setContextoPar(null))
      .finally(() => setCargandoContexto(false))
  }, [idProyecto])

  const toggleCriterio = (numero: number) => {
    setCriteriosExpandidos((actual) => {
      const siguiente = new Set(actual)
      if (siguiente.has(numero)) siguiente.delete(numero)
      else siguiente.add(numero)
      return siguiente
    })
  }

  // El par evaluador no debe saber a quién está calificando: el PDF se
  // genera sin nombres/correos de participantes, sin líder de grupo y sin
  // hojas de vida (ver construirDocumento con anonimo=true).
  const handleDescargarPdf = () => {
    if (idProyecto === null) return
    setDescargandoPdf(true)
    cargarDatosVistaProyecto(idProyecto)
      .then((datos) => generarPdfProyecto(datos, true))
      .catch(() => setError('No se pudo generar el PDF del proyecto.'))
      .finally(() => setDescargandoPdf(false))
  }

  const totalAcumulado = puntajes.reduce((sum, p) => sum + (p.puntaje ?? 0), 0)
  const requiereObservacion = totalAcumulado < PUNTAJE_MINIMO_SIN_OBSERVACION
  const observacionFaltante = requiereObservacion && !observacionesGenerales.trim()

  if (idProyecto === null || idEtapa === null) {
    return (
      <div className="calif-page">
        <button type="button" className="calif-volver" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} />
          Volver
        </button>
        <p className="calif-empty">No se encontró el proyecto a calificar. Vuelve a intentarlo desde "Proyectos asignados".</p>
      </div>
    )
  }

  const actualizarPuntaje = (criterioId: number, puntaje: number | null) => {
    setPuntajes((prev) => prev.map((p) => (p.criterioId === criterioId ? { ...p, puntaje } : p)))
  }

  const actualizarObservacion = (criterioId: number, observacion: string) => {
    setPuntajes((prev) => prev.map((p) => (p.criterioId === criterioId ? { ...p, observacion } : p)))
  }

  const confirmarGuardado = () => {
    setEnviando(true)
    evaluacionesApi
      .registrarEvaluacion(idProyecto, idEtapa, {
        resultado: derivarResultado(totalAcumulado),
        puntaje: totalAcumulado,
        comentarios: construirComentarios(puntajes, observacionesGenerales),
      })
      .then(() => {
        setPedirConfirmacion(false)
        setGuardadoOk(true)
      })
      .catch((err) => {
        setPedirConfirmacion(false)
        setError(err instanceof ApiError ? err.message : 'No se pudo registrar la calificación.')
      })
      .finally(() => setEnviando(false))
  }

  const cerrarGuardadoOk = () => {
    setGuardadoOk(false)
    navigate('/dashboard')
  }

  const handleGuardarClick = () => {
    if (observacionFaltante) {
      setIntentosSinObservacion((n) => n + 1)
      observacionesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setPedirConfirmacion(true)
  }

  return (
    <div className="calif-page">
      <button type="button" className="calif-volver" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} />
        Volver
      </button>

      {error && <p className="calif-empty">{error}</p>}

      <div className="calif-header-card">
        <h2>Formulario de calificación por par evaluador</h2>
        <div className="calif-header-proyecto">
          <span>Nombre del proyecto:</span>
          <strong>{tituloProyecto}</strong>
        </div>
        <button type="button" className="calif-descargar-btn" onClick={handleDescargarPdf} disabled={descargandoPdf}>
          <Download size={14} />
          {descargandoPdf ? 'Generando PDF...' : 'Descargar proyecto (PDF)'}
        </button>
      </div>

      <div className="calif-tabla-wrapper">
        <table className="calif-tabla">
          <thead>
            <tr>
              <th className="calif-th-criterio">CRITERIO</th>
              <th className="calif-th-puntaje">PUNTAJE</th>
              <th className="calif-th-observaciones">OBSERVACIONES</th>
            </tr>
          </thead>
          <tbody>
            {criteriosEvaluacion.map((c) => {
              const fila = puntajes.find((p) => p.criterioId === c.id)
              const bloque = contextoPar ? construirDetalleItemPar(c.numero, contextoPar) : null
              const expandible = bloque !== null
              const expandido = criteriosExpandidos.has(c.numero)
              return (
                <Fragment key={c.id}>
                  <tr>
                    <td>
                      <p className="calif-criterio-titulo">
                        {expandible ? (
                          <button type="button" className="calif-criterio-toggle" onClick={() => toggleCriterio(c.numero)}>
                            {c.numero}. {c.titulo}
                            <ChevronDown size={14} className={expandido ? 'calif-chevron-abierto' : ''} />
                          </button>
                        ) : (
                          <>{c.numero}. {c.titulo}</>
                        )}
                        <span className="calif-criterio-max"> (Máximo {c.maximoPuntos} puntos)</span>
                      </p>
                      <p className="calif-criterio-descripcion">{c.descripcion}</p>
                    </td>
                    <td className="calif-td-puntaje">
                      <input
                        type="number"
                        min={0}
                        max={c.maximoPuntos}
                        placeholder={`0 - ${c.maximoPuntos}`}
                        value={fila?.puntaje ?? ''}
                        onChange={(e) => {
                          const valor = e.target.value === '' ? null : Number(e.target.value)
                          const acotado =
                            valor === null ? null : Math.max(0, Math.min(c.maximoPuntos, valor))
                          actualizarPuntaje(c.id, acotado)
                        }}
                      />
                    </td>
                    <td>
                      <textarea
                        placeholder="Observaciones..."
                        value={fila?.observacion ?? ''}
                        onChange={(e) => actualizarObservacion(c.id, e.target.value)}
                      />
                    </td>
                  </tr>
                  {expandido && expandible && (
                    <tr className="calif-fila-detalle">
                      <td colSpan={3}>
                        {cargandoContexto || !bloque ? (
                          <p className="calif-empty">Cargando...</p>
                        ) : bloque.tipo === 'texto' ? (
                          <p className="calif-detalle-texto">{bloque.texto}</p>
                        ) : bloque.tipo === 'lista' ? (
                          bloque.items.length > 0 ? (
                            <ul className="calif-detalle-lista">
                              {bloque.items.map((linea, idx) => <li key={idx}>{linea}</li>)}
                            </ul>
                          ) : (
                            <p className="calif-empty">Sin información registrada.</p>
                          )
                        ) : bloque.tipo === 'objetivos' ? (
                          <div className="calif-detalle-objetivos">
                            <div className="calif-objetivo-card">
                              <span className="calif-objetivo-etiqueta">Objetivo general</span>
                              <p>{bloque.general}</p>
                            </div>
                            {bloque.especificos.map((descripcion, idx) => (
                              <div className="calif-objetivo-card" key={idx}>
                                <span className="calif-objetivo-etiqueta">Específico {idx + 1}</span>
                                <p>{descripcion}</p>
                              </div>
                            ))}
                          </div>
                        ) : bloque.tipo === 'impactos' ? (
                          <div className="calif-detalle-objetivos">
                            {bloque.especificos.map((im, idx) => (
                              <div className="calif-objetivo-card" key={idx}>
                                <span className="calif-objetivo-etiqueta">Objetivo Específico {im.numero}</span>
                                <p><strong>Impacto esperado:</strong> {im.impacto_esperado ?? '—'}</p>
                                <p><strong>Beneficiario potencial:</strong> {im.beneficiario_potencial ?? '—'}</p>
                                <p><strong>Indicador verificable:</strong> {im.indicador_verificable ?? '—'}</p>
                              </div>
                            ))}
                          </div>
                        ) : bloque.tipo === 'cronograma' ? (
                          <div className="calif-cronograma-wrapper">
                            {bloque.grupos.map((grupo, gi) => (
                              <div className="calif-cronograma-grupo" key={gi}>
                                <p className="calif-cronograma-etiqueta">{grupo.etiqueta}</p>
                                <div className="calif-table-scroll">
                                  <div className="calif-cronograma-tabla">
                                    <div className="calif-cronograma-header">
                                      <span className="calif-cronograma-col-actividad">Actividad</span>
                                      <span className="calif-cronograma-col-resultado">Resultado</span>
                                      <span className="calif-cronograma-col-responsable">Responsable(s)</span>
                                      {MESES_ABREV.map((mes) => <span key={mes} className="calif-cronograma-col-mes">{mes}</span>)}
                                    </div>
                                    {grupo.filas.map((f, fi) => (
                                      <div className="calif-cronograma-row" key={fi}>
                                        <span className="calif-cronograma-col-actividad">{f.actividad}</span>
                                        <span className="calif-cronograma-col-resultado">{f.resultado ?? '—'}</span>
                                        <span className="calif-cronograma-col-responsable">{f.responsable}</span>
                                        {f.meses.map((marcado, mi) => (
                                          <span key={mi} className="calif-cronograma-col-mes">{marcado ? '✓' : ''}</span>
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                            {bloque.sinPeriodo.length > 0 && (
                              <ul className="calif-detalle-lista">
                                {bloque.sinPeriodo.map((a, idx) => (
                                  <li key={idx}>{a.actividad}{a.resultado ? ` — Resultado: ${a.resultado}` : ''} — {a.responsable}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            <tr className="calif-fila-total">
              <td>Total acumulado</td>
              <td className="calif-td-puntaje">
                <span className="calif-total-valor">{totalAcumulado}</span>
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div
        key={intentosSinObservacion}
        ref={observacionesRef}
        className={`calif-observaciones-generales ${observacionFaltante && intentosSinObservacion > 0 ? 'calif-observaciones-alerta' : ''}`}
      >
        <h3>OBSERVACIONES GENERALES</h3>
        {requiereObservacion && (
          <p className="calif-observaciones-aviso">
            El puntaje total es menor a {PUNTAJE_MINIMO_SIN_OBSERVACION}: debes explicar por qué en una observación general antes de poder enviar.
          </p>
        )}
        <textarea
          placeholder="En este espacio puede incluir las sugerencias o comentarios que considere pertinentes para ajustar y mejorar el proyecto de investigación."
          value={observacionesGenerales}
          onChange={(e) => setObservacionesGenerales(e.target.value)}
        />
      </div>

      <div className="calif-guardar-wrapper">
        <button type="button" className="calif-guardar-btn" onClick={handleGuardarClick} disabled={enviando}>
          <Save size={16} />
          Guardar datos
        </button>
      </div>

      {pedirConfirmacion && (
        <ConfirmModal
          mensaje="¿Desea guardar la calificación?"
          botonSecundario={{ label: 'No', onClick: () => setPedirConfirmacion(false), variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: confirmarGuardado, variante: 'rojo' }}
          onClose={() => setPedirConfirmacion(false)}
        />
      )}

      {guardadoOk && (
        <ConfirmModal
          mensaje="La calificación se guardó exitosamente."
          botonPrimario={{ label: 'Ok', onClick: cerrarGuardadoOk, variante: 'azul' }}
          onClose={cerrarGuardadoOk}
        />
      )}
    </div>
  )
}

export default FormularioCalificacion
