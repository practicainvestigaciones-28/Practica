import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, X as XIcon, Save, Check, AlertTriangle } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import {
  criteriosEvaluacion,
  puntajeMaximoTotal,
  getProyectoParaEvaluar,
  getEvaluacionGuardada,
  guardarEvaluacion,
  type DecisionFinal,
  type PuntajeCriterio,
} from '../lib/parEvaluador'
import './FormularioCalificacion.css'

function puntajesIniciales(proyectoId: number): PuntajeCriterio[] {
  const guardada = getEvaluacionGuardada(proyectoId)
  return criteriosEvaluacion.map((c) => {
    const previo = guardada?.puntajes.find((p) => p.criterioId === c.id)
    return { criterioId: c.id, puntaje: previo?.puntaje ?? null, observacion: previo?.observacion ?? '' }
  })
}

function FormularioCalificacion() {
  const navigate = useNavigate()
  const location = useLocation()
  const proyectoId = (location.state as { proyectoId?: number } | undefined)?.proyectoId ?? null

  const proyecto = proyectoId !== null ? getProyectoParaEvaluar(proyectoId) : undefined
  const evaluacionPrevia = proyectoId !== null ? getEvaluacionGuardada(proyectoId) : undefined

  const [puntajes, setPuntajes] = useState<PuntajeCriterio[]>(
    proyectoId !== null ? puntajesIniciales(proyectoId) : []
  )
  const [observacionesGenerales, setObservacionesGenerales] = useState(evaluacionPrevia?.observacionesGenerales ?? '')
  const [decision, setDecision] = useState<DecisionFinal | null>(evaluacionPrevia?.decision ?? null)
  const [firmaArchivo, setFirmaArchivo] = useState<string | null>(evaluacionPrevia?.firmaArchivo ?? null)
  const [nombreEvaluador, setNombreEvaluador] = useState(evaluacionPrevia?.nombreEvaluador ?? '')
  const [cedula, setCedula] = useState(evaluacionPrevia?.cedula ?? '')
  const [ciudad, setCiudad] = useState(evaluacionPrevia?.ciudad ?? '')
  const [dia, setDia] = useState('')
  const [mes, setMes] = useState('')
  const [anio, setAnio] = useState('')
  const [pedirConfirmacion, setPedirConfirmacion] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  if (!proyecto) {
    return (
      <div className="calif-page">
        <button type="button" className="calif-volver" onClick={() => navigate('/evaluaciones')}>
          <ArrowLeft size={16} />
          Volver
        </button>
        <p className="calif-empty">No se encontró el proyecto a calificar. Vuelve a intentarlo desde la lista de evaluaciones.</p>
      </div>
    )
  }

  const totalAcumulado = puntajes.reduce((sum, p) => sum + (p.puntaje ?? 0), 0)

  const actualizarPuntaje = (criterioId: number, puntaje: number | null) => {
    setPuntajes((prev) => prev.map((p) => (p.criterioId === criterioId ? { ...p, puntaje } : p)))
  }

  const actualizarObservacion = (criterioId: number, observacion: string) => {
    setPuntajes((prev) => prev.map((p) => (p.criterioId === criterioId ? { ...p, observacion } : p)))
  }

  const handleCargarFirma = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFirmaArchivo(file.name)
    e.target.value = ''
  }

  const handleGuardarClick = () => {
    setPedirConfirmacion(true)
  }

  const confirmarGuardado = () => {
    const fecha = dia && mes && anio ? `${dia}/${mes}/${anio}` : evaluacionPrevia?.fecha ?? ''

    guardarEvaluacion({
      proyectoId: proyecto.id,
      puntajes,
      observacionesGenerales,
      decision,
      firmaArchivo,
      nombreEvaluador,
      cedula,
      ciudad,
      fecha,
    })

    setPedirConfirmacion(false)
    setGuardadoOk(true)
  }

  const cerrarGuardadoOk = () => {
    setGuardadoOk(false)
    navigate('/evaluaciones')
  }

  return (
    <div className="calif-page">
      <button type="button" className="calif-volver" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} />
        Volver
      </button>

      <div className="calif-header-card">
        <h2>Formulario de calificación por par evaluador</h2>
        <div className="calif-header-proyecto">
          <span>Nombre del proyecto:</span>
          <strong>{proyecto.titulo}</strong>
        </div>
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
              return (
                <tr key={c.id}>
                  <td>
                    <p className="calif-criterio-titulo">
                      CRITERIO DE EVALUACIÓN NÚMERO {c.numero}: {c.titulo}
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

      <div className="calif-observaciones-generales">
        <h3>OBSERVACIONES GENERALES</h3>
        <textarea
          placeholder="En este espacio puede incluir las sugerencias o comentarios que considere pertinentes para ajustar y mejorar el proyecto de investigación."
          value={observacionesGenerales}
          onChange={(e) => setObservacionesGenerales(e.target.value)}
        />
      </div>

      <p className="calif-escala-intro">
        Se debe tener en cuenta la escala de valoración descrita en la siguiente tabla en cuanto a cada aspecto a evaluar:
      </p>

      <div className="calif-escala-wrapper">
        <table className="calif-escala-tabla">
          <thead>
            <tr>
              <th>PUNTUACIÓN</th>
              <th>VALORACIÓN</th>
              <th>EVALUACIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr className={totalAcumulado >= 80 ? 'calif-escala-fila-sugerida' : ''}>
              <td>{puntajeMaximoTotal - 9} a {puntajeMaximoTotal} Puntos</td>
              <td>Susceptible a financiación sin ajustes</td>
              <td>
                <button
                  type="button"
                  className={`calif-btn-decision calif-btn-aprobar ${decision === 'aprobado' ? 'calif-btn-decision-activo' : ''}`}
                  onClick={() => setDecision('aprobado')}
                >
                  <Check size={14} />
                  Aprobar
                </button>
              </td>
            </tr>
            <tr className={totalAcumulado >= 70 && totalAcumulado < 80 ? 'calif-escala-fila-sugerida' : ''}>
              <td>De 70 a 79 Puntos</td>
              <td>Susceptible a financiación con ajustes</td>
              <td>
                <button
                  type="button"
                  className={`calif-btn-decision calif-btn-correccion ${decision === 'aprobado_con_correccion' ? 'calif-btn-decision-activo' : ''}`}
                  onClick={() => setDecision('aprobado_con_correccion')}
                >
                  <AlertTriangle size={14} />
                  Aprobar con corrección
                </button>
              </td>
            </tr>
            <tr className={totalAcumulado < 70 ? 'calif-escala-fila-sugerida' : ''}>
              <td>Menos de 70 Puntos</td>
              <td>No Aprobado</td>
              <td>
                <button
                  type="button"
                  className={`calif-btn-decision calif-btn-rechazar ${decision === 'no_aprobado' ? 'calif-btn-decision-activo' : ''}`}
                  onClick={() => setDecision('no_aprobado')}
                >
                  <XIcon size={14} />
                  No aprobar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="calif-firma-card">
        <div className="calif-firma-upload">
          <label className="calif-firma-label">
            <Upload size={18} />
            {firmaArchivo ?? 'Adjunte firma digital'}
            <input type="file" onChange={handleCargarFirma} />
          </label>
          <span className="calif-firma-caption">FIRMA</span>
        </div>

        <div className="calif-firma-campos">
          <div className="calif-firma-campo">
            <input
              type="text"
              placeholder="Nombre Completo Evaluador"
              value={nombreEvaluador}
              onChange={(e) => setNombreEvaluador(e.target.value)}
            />
          </div>

          <div className="calif-firma-fila-2">
            <div className="calif-firma-campo">
              <input
                type="text"
                placeholder="No. Cédula"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
              />
            </div>
            <div className="calif-firma-campo">
              <input
                type="text"
                placeholder="Ciudad"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
              />
            </div>
          </div>

          <div className="calif-firma-fecha">
            <span>Fecha</span>
            <input type="text" placeholder="DD" maxLength={2} value={dia} onChange={(e) => setDia(e.target.value)} />
            <input type="text" placeholder="MM" maxLength={2} value={mes} onChange={(e) => setMes(e.target.value)} />
            <input type="text" placeholder="YYYY" maxLength={4} value={anio} onChange={(e) => setAnio(e.target.value)} />
          </div>
        </div>

        <button type="button" className="calif-guardar-btn" onClick={handleGuardarClick}>
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