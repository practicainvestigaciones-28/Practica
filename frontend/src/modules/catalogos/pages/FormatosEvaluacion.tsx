import { useState } from 'react'
import { ArrowLeft, FileText, FlaskConical, Scale, Users, Search, MessageCircle, Clock, CheckSquare } from 'lucide-react'
import { getReclamaciones, type EstadoReclamacion } from '../lib/reclamaciones'
import { seccionesFormatoProyecto } from '../lib/formatoProyecto'
import { checklistInvestigacion, checklistEtica } from '../../evaluaciones/lib/checklistComite'
import { criteriosEvaluacion, puntajeMaximoTotal } from '../../evaluaciones/lib/parEvaluador'
import './FormatosEvaluacion.css'
import './Reclamaciones.css'

type TabPrincipal = 'formatos' | 'reclamaciones'
type TipoFormato = 'proyecto' | 'investigacion' | 'etica' | 'pares'

const estadoColorReclamo: Record<EstadoReclamacion, string> = {
  'Pendiente': '#f2c94c',
  'En revisión': '#8f9bb3',
  'Resuelta': '#27ae60',
}

interface FormatoInfo {
  tipo: TipoFormato
  nombre: string
  codigo: string | null
  icono: typeof FileText
  cantidadItems: number
}

const formatos: FormatoInfo[] = [
  { tipo: 'proyecto', nombre: 'Formato de registro de proyecto', codigo: null, icono: Users, cantidadItems: seccionesFormatoProyecto.length },
  { tipo: 'investigacion', nombre: 'Comité de Investigación', codigo: 'INV-IC-FR-009', icono: FlaskConical, cantidadItems: checklistInvestigacion.length },
  { tipo: 'etica', nombre: 'Comité de Ética', codigo: 'INV-IC-FR-020', icono: Scale, cantidadItems: checklistEtica.length },
  { tipo: 'pares', nombre: 'Par Evaluador', codigo: 'INV-IC-FR-008', icono: FileText, cantidadItems: criteriosEvaluacion.length },
]

function FormatosEvaluacion() {
  const [tabPrincipal, setTabPrincipal] = useState<TabPrincipal>('formatos')

  const [busqueda, setBusqueda] = useState('')
  const [formatoAbierto, setFormatoAbierto] = useState<TipoFormato | null>(null)

  const formatosFiltrados = formatos.filter((f) =>
    f.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const infoFormatoAbierto = formatos.find((f) => f.tipo === formatoAbierto) ?? null

  const [busquedaReclamo, setBusquedaReclamo] = useState('')
  const reclamaciones = getReclamaciones()

  const totalReclamos = reclamaciones.length
  const reclamosEnRevision = reclamaciones.filter((r) => r.estado === 'En revisión').length
  const reclamosPendientes = reclamaciones.filter((r) => r.estado === 'Pendiente').length
  const reclamosResueltos = reclamaciones.filter((r) => r.estado === 'Resuelta').length

  const reclamosFiltrados = reclamaciones.filter((r) =>
    [r.evaluacion, r.reclamante, r.respuesta].some((campo) =>
      campo.toLowerCase().includes(busquedaReclamo.toLowerCase())
    )
  )

  return (
    <div className="etapa-page">
      <div className="fmt-tabs">
        <button
          type="button"
          className={`fmt-tab ${tabPrincipal === 'formatos' ? 'fmt-tab-active' : ''}`}
          onClick={() => setTabPrincipal('formatos')}
        >
          Formatos de evaluación
        </button>
        <button
          type="button"
          className={`fmt-tab ${tabPrincipal === 'reclamaciones' ? 'fmt-tab-active' : ''}`}
          onClick={() => setTabPrincipal('reclamaciones')}
        >
          Reclamaciones
        </button>
      </div>

      {tabPrincipal === 'formatos' && formatoAbierto === null && (
        <>
          <p className="fmt-intro">
            Estos son los formatos oficiales que usa el sistema para registrar un proyecto y para evaluarlo en cada
            etapa. Son de solo lectura: reflejan lo que ya está implementado en cada pantalla.
          </p>

          <div className="etapa-toolbar">
            <div className="etapa-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar por formato"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>

          <div className="fmt-grid">
            {formatosFiltrados.map((f) => (
              <button type="button" className="fmt-card" key={f.tipo} onClick={() => setFormatoAbierto(f.tipo)}>
                <f.icono size={22} className="fmt-card-icon" />
                <span className="fmt-card-nombre">{f.nombre}</span>
                {f.codigo && <span className="fmt-card-codigo">{f.codigo}</span>}
                <span className="fmt-card-cantidad">{f.cantidadItems} {f.tipo === 'proyecto' ? 'secciones' : 'criterios'}</span>
              </button>
            ))}

            {formatosFiltrados.length === 0 && (
              <p className="etapa-empty">No se encontraron formatos.</p>
            )}
          </div>
        </>
      )}

      {tabPrincipal === 'formatos' && formatoAbierto !== null && infoFormatoAbierto && (
        <div className="fmt-detalle">
          <button type="button" className="fmt-detalle-volver" onClick={() => setFormatoAbierto(null)}>
            <ArrowLeft size={16} />
            Volver
          </button>

          <div className="fmt-detalle-header">
            <h2>{infoFormatoAbierto.nombre}</h2>
            {infoFormatoAbierto.codigo && <span className="fmt-detalle-codigo">{infoFormatoAbierto.codigo}</span>}
          </div>

          {formatoAbierto === 'proyecto' && (
            <div className="fmt-detalle-secciones">
              {seccionesFormatoProyecto.map((s, i) => (
                <div className="fmt-seccion-proyecto" key={s.titulo}>
                  <p className="fmt-seccion-proyecto-titulo">{i + 1}. {s.titulo}</p>
                  <p className="fmt-seccion-proyecto-desc">{s.descripcion}</p>
                  <input type="text" className="fmt-input-fantasma" placeholder="Campo del formulario..." disabled />
                </div>
              ))}
            </div>
          )}

          {(formatoAbierto === 'investigacion' || formatoAbierto === 'etica') && (
            <table className="fmt-checklist-tabla">
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th>SI</th>
                  <th>NO</th>
                  <th>OBSERVACIÓN</th>
                </tr>
              </thead>
              <tbody>
                {(formatoAbierto === 'investigacion' ? checklistInvestigacion : checklistEtica).map((item) => (
                  <tr key={item.id}>
                    <td>{item.texto}</td>
                    <td className="fmt-checklist-radio-celda">
                      <input type="radio" disabled />
                    </td>
                    <td className="fmt-checklist-radio-celda">
                      <input type="radio" disabled />
                    </td>
                    <td>
                      <input type="text" className="fmt-input-fantasma" placeholder="Observación..." disabled />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {formatoAbierto === 'pares' && (
            <>
              <table className="fmt-checklist-tabla">
                <thead>
                  <tr>
                    <th>CRITERIO</th>
                    <th>PUNTAJE</th>
                    <th>OBSERVACIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {criteriosEvaluacion.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <p className="fmt-criterio-titulo">
                          {c.numero}. {c.titulo} <span className="fmt-detalle-item-max">(Máximo {c.maximoPuntos} puntos)</span>
                        </p>
                        <p className="fmt-criterio-desc">{c.descripcion}</p>
                      </td>
                      <td className="fmt-checklist-puntaje-celda">
                        <input type="number" className="fmt-input-fantasma" placeholder={`0 - ${c.maximoPuntos}`} disabled />
                      </td>
                      <td>
                        <input type="text" className="fmt-input-fantasma" placeholder="Observaciones..." disabled />
                      </td>
                    </tr>
                  ))}
                  <tr className="fmt-checklist-fila-total">
                    <td>Total acumulado</td>
                    <td className="fmt-checklist-puntaje-celda">0</td>
                    <td />
                  </tr>
                </tbody>
              </table>

              <table className="fmt-escala-tabla">
                <thead>
                  <tr>
                    <th>PUNTUACIÓN</th>
                    <th>VALORACIÓN</th>
                    <th>EVALUACIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>80 a {puntajeMaximoTotal} puntos</td>
                    <td>Susceptible a financiación sin ajustes</td>
                    <td><button type="button" className="fmt-btn-decision fmt-btn-aprobar" disabled>Aprobar</button></td>
                  </tr>
                  <tr>
                    <td>De 70 a 79 puntos</td>
                    <td>Susceptible a financiación con ajustes</td>
                    <td><button type="button" className="fmt-btn-decision fmt-btn-correccion" disabled>Aprobar con corrección</button></td>
                  </tr>
                  <tr>
                    <td>Menos de 70 puntos</td>
                    <td>No aprobado</td>
                    <td><button type="button" className="fmt-btn-decision fmt-btn-rechazar" disabled>No aprobar</button></td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {tabPrincipal === 'reclamaciones' && (
        <div className="reclamo-page">
          <div className="reclamo-stats-grid">
            <div className="reclamo-stat-card">
              <MessageCircle size={18} className="reclamo-stat-icon" />
              <span className="reclamo-stat-label">Total de reclamaciones</span>
              <span className="reclamo-stat-badge" style={{ background: '#d9e3f3', color: '#263d70' }}>
                {totalReclamos}
              </span>
            </div>

            <div className="reclamo-stat-card">
              <Search size={18} className="reclamo-stat-icon" />
              <span className="reclamo-stat-label">Reclamaciones en revisión</span>
              <span className="reclamo-stat-badge" style={{ background: '#e5e7ec', color: '#444' }}>
                {reclamosEnRevision}
              </span>
            </div>

            <div className="reclamo-stat-card">
              <Clock size={18} className="reclamo-stat-icon" />
              <span className="reclamo-stat-label">Reclamaciones pendientes</span>
              <span className="reclamo-stat-badge" style={{ background: '#f2c94c', color: '#5c4600' }}>
                {reclamosPendientes}
              </span>
            </div>

            <div className="reclamo-stat-card">
              <CheckSquare size={18} className="reclamo-stat-icon" />
              <span className="reclamo-stat-label">Reclamaciones resueltas</span>
              <span className="reclamo-stat-badge" style={{ background: '#27ae60', color: '#ffffff' }}>
                {reclamosResueltos}
              </span>
            </div>
          </div>

          <div className="reclamo-table-card">
            <div className="reclamo-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar documento o reclamación"
                value={busquedaReclamo}
                onChange={(e) => setBusquedaReclamo(e.target.value)}
              />
            </div>

            <div className="reclamo-table-header">
              <span>Evaluación</span>
              <span>Reclamante</span>
              <span>Respuesta</span>
              <span>Fecha</span>
              <span>Estado</span>
            </div>

            {reclamosFiltrados.map((r) => (
              <div className="reclamo-row" key={r.id}>
                <span className="reclamo-cell reclamo-cell-evaluacion">{r.evaluacion}</span>
                <span className="reclamo-cell">{r.reclamante}</span>
                <span className="reclamo-cell">{r.respuesta}</span>
                <span className="reclamo-cell">{r.fecha}</span>
                <span className="reclamo-cell reclamo-cell-estado" style={{ color: estadoColorReclamo[r.estado] }}>
                  {r.estado}
                </span>
              </div>
            ))}

            {reclamosFiltrados.length === 0 && (
              <p className="reclamo-empty">No se encontraron reclamaciones.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default FormatosEvaluacion