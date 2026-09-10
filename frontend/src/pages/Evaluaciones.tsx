import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, FileText, Search, ArrowLeft, Download, ChevronDown, SquarePen } from 'lucide-react'
import { estadoConfig } from '../lib/estado'
import { getProyectosParaEvaluar, type ProyectoParaEvaluar } from '../lib/parEvaluador'
import './Evaluaciones.css'

type Vista = 'lista' | 'detalle'
type Orden = 'titulo-asc' | 'titulo-desc'

function Evaluaciones() {
  const navigate = useNavigate()
  const proyectos = getProyectosParaEvaluar()

  const [vista, setVista] = useState<Vista>('lista')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('titulo-asc')
  const [proyectoAbiertoId, setProyectoAbiertoId] = useState<number | null>(null)

  const handleFormatoEvaluacion = () => {
    // ⚠️ MODO PRUEBA — mientras el backend no esté listo.
    console.log('Descargar formato de evaluación (modo prueba, sin backend todavía)')
  }

  const handleHistorialEvaluacion = () => {
    // ⚠️ MODO PRUEBA — mientras el backend no esté listo.
    console.log('Consultar historial de evaluación (modo prueba, sin backend todavía)')
  }

  const handleDescargarAnexo = (nombre: string) => {
    // ⚠️ MODO PRUEBA — mientras el backend no esté listo.
    console.log('Descargar anexo (modo prueba, sin backend todavía):', nombre)
  }

  const abrirDetalle = (id: number) => {
    setProyectoAbiertoId(id)
    setVista('detalle')
  }

  const volverALista = () => setVista('lista')

  const proyectosAsignados = proyectos.filter((p) => p.asignado)

  const listaFiltrada = proyectosAsignados
    .filter((p) =>
      [p.titulo, p.investigadorPrincipal, p.convocatoria].some((campo) =>
        campo.toLowerCase().includes(busqueda.toLowerCase())
      )
    )
    .sort((a, b) => (orden === 'titulo-asc' ? a.titulo.localeCompare(b.titulo) : b.titulo.localeCompare(a.titulo)))

  const proyectoAbierto: ProyectoParaEvaluar | undefined = proyectos.find((p) => p.id === proyectoAbiertoId)

  if (vista === 'lista') {
    return (
      <div className="eval-page">
        <div className="eval-lista-header-card">
          <h2>Proyectos asignados</h2>
          <p>Listado de proyectos pendientes de evaluación</p>
        </div>

        <div className="eval-toolbar">
          <button type="button" className="eval-toolbar-btn" onClick={handleFormatoEvaluacion}>
            <FileText size={14} />
            Formato de evaluación
            <Download size={14} />
          </button>
          <button type="button" className="eval-toolbar-btn" onClick={handleHistorialEvaluacion}>
            <Clock size={14} />
            Historial de evaluación
            <span className="eval-toolbar-badge">Consultar</span>
          </button>
        </div>

        <div className="eval-filtros">
          <div className="eval-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Busca por título, investigador o convocatoria"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="eval-orden">
            <span>Ordenar por:</span>
            <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
              <option value="titulo-asc">Título A-Z</option>
              <option value="titulo-desc">Título Z-A</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="eval-tabla">
          <div className="eval-tabla-header">
            <span>Título</span>
            <span>Investigador principal</span>
            <span>Convocatoria</span>
            <span>Facultad</span>
            <span>Estado</span>
          </div>

          {listaFiltrada.map((p) => (
            <button type="button" className="eval-tabla-row" key={p.id} onClick={() => abrirDetalle(p.id)}>
              <span className="eval-fila-titulo">{p.titulo}</span>
              <span>{p.investigadorPrincipal}</span>
              <span>{p.convocatoria}</span>
              <span>{p.facultad}</span>
              <span className="eval-estado-badge" style={{ background: estadoConfig[p.estado].color }}>
                {p.estado}
              </span>
            </button>
          ))}

          {listaFiltrada.length === 0 && <p className="eval-empty">No se encontraron proyectos.</p>}
        </div>
      </div>
    )
  }

  if (!proyectoAbierto) {
    return (
      <div className="eval-page">
        <p className="eval-empty">No se encontró el proyecto.</p>
      </div>
    )
  }

  return (
    <div className="eval-page">
      <button type="button" className="eval-volver" onClick={volverALista}>
        <ArrowLeft size={16} />
        Volver
      </button>

      <div className="eval-detalle-card">
        <div className="eval-detalle-top">
          <div>
            <h2>Detalles de proyecto para revisión</h2>
            <p className="eval-detalle-proyecto-nombre">{proyectoAbierto.titulo}</p>
          </div>
          <div className="eval-detalle-fechas">
            <span>Fecha de envío: {proyectoAbierto.fechaEnvio}</span>
            <span>Fecha límite de evaluación: {proyectoAbierto.fechaLimiteEvaluacion}</span>
          </div>
        </div>

        <p className="eval-resumen-label">Resumen de proyecto</p>
        <p className="eval-resumen-texto">{proyectoAbierto.resumen}</p>

        <div className="eval-anexos">
          <h3>Anexos</h3>
          <div className="eval-anexos-lista">
            {proyectoAbierto.anexos.map((nombre) => (
              <div className="eval-anexo-item" key={nombre}>
                <FileText size={14} />
                <span>{nombre}</span>
                <button type="button" aria-label="Descargar" onClick={() => handleDescargarAnexo(nombre)}>
                  <Download size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="eval-ver-todos-anexos">Ver todos</button>
          </div>
        </div>

        <div className="eval-calificacion">
          <h3>Calificación del comité</h3>
          <button
            type="button"
            className="eval-realizar-calificacion"
            onClick={() => navigate('/evaluaciones/calificar', { state: { proyectoId: proyectoAbierto.id } })}
          >
            <SquarePen size={16} />
            Realizar calificación
          </button>
        </div>
      </div>
    </div>
  )
}

export default Evaluaciones