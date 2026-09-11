import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, ChevronDown, Search, Trash2, Info, UserPlus, ArrowLeft } from 'lucide-react'
import ConfirmModal from './ConfirmModal'
import {
  getProyectosParaAsignar,
  getParesEvaluadores,
  getAsignacion,
  guardarAsignacion,
  estaAsignado,
  configComite,
  type TipoComite,
} from '../lib/asignacionComite'
import './AsignacionComiteVista.css'

type TabLista = 'pendientes' | 'asignados'

interface AsignacionComiteVistaProps {
  tipo: TipoComite
  /** En qué columna (1 o 2, de 2) centrar la píldora de sub-pestañas,
   * según cuál pestaña principal (Ética/Investigación) esté activa. */
  columnaSubtab?: number
}

function AsignacionComiteVista({ tipo, columnaSubtab = 1 }: AsignacionComiteVistaProps) {
  const navigate = useNavigate()
  const config = configComite[tipo]

  const proyectos = getProyectosParaAsignar()
  const pares = getParesEvaluadores()

  // ---------- Pantalla de lista ----------
  const [vista, setVista] = useState<'lista' | 'detalle'>('lista')
  const [tabLista, setTabLista] = useState<TabLista>('pendientes')
  const [busquedaLista, setBusquedaLista] = useState('')

  // ---------- Pantalla de detalle ----------
  const [proyectoId, setProyectoId] = useState<number>(proyectos[0]?.id ?? 0)
  const [busquedaPar, setBusquedaPar] = useState('')
  const [seleccionados, setSeleccionados] = useState<number[]>(getAsignacion(tipo, proyectoId))
  const [avisoLimite, setAvisoLimite] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  useEffect(() => {
    setSeleccionados(getAsignacion(tipo, proyectoId))
    setAvisoLimite(false)
  }, [proyectoId, tipo])

  const proyectoActual = proyectos.find((p) => p.id === proyectoId) ?? null

  const abrirDetalleDeLista = (id: number) => {
    setProyectoId(id)
    setVista('detalle')
  }

  const volverALista = () => {
    setVista('lista')
  }

  const togglePar = (parId: number) => {
    setSeleccionados((prev) => {
      if (prev.includes(parId)) {
        return prev.filter((id) => id !== parId)
      }
      if (prev.length >= config.maxPares) {
        setAvisoLimite(true)
        return prev
      }
      setAvisoLimite(false)
      return [...prev, parId]
    })
  }

  const quitarPar = (parId: number) => {
    setSeleccionados((prev) => prev.filter((id) => id !== parId))
    setAvisoLimite(false)
  }

  const handleCancelar = () => {
    setSeleccionados(getAsignacion(tipo, proyectoId))
    setAvisoLimite(false)
  }

  const handleAsignar = () => {
    guardarAsignacion(tipo, proyectoId, seleccionados)
    setGuardadoOk(true)
  }

  const handleVerDetalles = () => {
    if (!proyectoActual) return
    navigate('/proyectos/observaciones', { state: { titulo: proyectoActual.titulo } })
  }

  const proyectosListaFiltrados = proyectos
    .filter((p) => estaAsignado(tipo, p.id) === (tabLista === 'asignados'))
    .filter((p) =>
      [p.titulo, p.investigador].some((campo) => campo.toLowerCase().includes(busquedaLista.toLowerCase()))
    )

  const paresFiltrados = pares.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busquedaPar.toLowerCase()) ||
      p.especialidad.toLowerCase().includes(busquedaPar.toLowerCase())
  )

  const paresSeleccionadosInfo = pares.filter((p) => seleccionados.includes(p.id))

  // ---------- Pantalla de lista ----------
  if (vista === 'lista') {
    return (
      <div className="asig-page">
        <div className="asignaciones-subtab-grid">
          <div className="asignaciones-subtab-cell" style={{ gridColumn: columnaSubtab }}>
            <div className="asig-lista-tabs">
              <button
                type="button"
                className={`asig-lista-tab ${tabLista === 'pendientes' ? 'asig-lista-tab-active' : ''}`}
                onClick={() => setTabLista('pendientes')}
              >
                Pendientes Asignación
              </button>
              <button
                type="button"
                className={`asig-lista-tab ${tabLista === 'asignados' ? 'asig-lista-tab-active' : ''}`}
                onClick={() => setTabLista('asignados')}
              >
                Asignados
              </button>
            </div>
          </div>
        </div>

        <div className="asig-search asig-search-ancho">
          <input
            type="text"
            placeholder="Buscar por investigador o título"
            value={busquedaLista}
            onChange={(e) => setBusquedaLista(e.target.value)}
          />
          <Search size={16} />
        </div>

        <div className="asig-lista-table">
          <div className="asig-lista-header">
            <span>Título</span>
            <span>Investigador</span>
            <span>Asignar Responsable</span>
          </div>

          {proyectosListaFiltrados.map((p) => (
            <div className="asig-lista-row" key={p.id}>
              <span className="asig-par-nombre">{p.titulo}</span>
              <span className="asig-par-especialidad">{p.investigador}</span>
              <button
                type="button"
                className="asig-lista-asignar-btn"
                aria-label="Asignar responsable"
                onClick={() => abrirDetalleDeLista(p.id)}
              >
                <UserPlus size={18} />
              </button>
            </div>
          ))}

          {proyectosListaFiltrados.length === 0 && (
            <p className="asig-empty">
              {tabLista === 'pendientes'
                ? 'No hay proyectos pendientes de asignación.'
                : 'Todavía no hay proyectos asignados.'}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ---------- Pantalla de detalle ----------
  return (
    <div className="asig-page">
      <button type="button" className="asig-volver" onClick={volverALista}>
        <ArrowLeft size={16} />
        Volver a la lista
      </button>

      <div className="asig-header-card">
        <h2>{config.tituloPagina}</h2>
        <p>{config.subtitulo}</p>
      </div>

      <div className="asig-proyecto-bar">
        <div className="asig-proyecto-select">
          <Archive size={16} />
          <select value={proyectoId} onChange={(e) => setProyectoId(Number(e.target.value))}>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>{p.titulo}</option>
            ))}
          </select>
          <ChevronDown size={16} className="asig-select-arrow" />
        </div>

        <button type="button" className="asig-ver-detalles" onClick={handleVerDetalles}>
          Ver detalles
        </button>
      </div>

      <div className="asig-columnas">
        <div className="asig-panel">
          <h3>{config.tituloPanelIzquierdo}</h3>

          <div className="asig-search">
            <input
              type="text"
              placeholder={config.placeholderBuscarPar}
              value={busquedaPar}
              onChange={(e) => setBusquedaPar(e.target.value)}
            />
            <Search size={16} />
          </div>

          <div className="asig-tabla-header">
            <span />
            <span>Par evaluador</span>
            <span>Especialidad</span>
            <span>Estado</span>
          </div>

          <div className="asig-tabla-body">
            {paresFiltrados.map((p) => {
              const marcado = seleccionados.includes(p.id)
              return (
                <label className="asig-tabla-row" key={p.id}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => togglePar(p.id)}
                  />
                  <span className="asig-par-nombre">{p.nombre}</span>
                  <span className="asig-par-especialidad">{p.especialidad}</span>
                  <span className={`asig-estado-badge ${marcado ? 'asig-estado-asignado' : 'asig-estado-disponible'}`}>
                    {marcado ? 'Asignado' : 'Disponible'}
                  </span>
                </label>
              )
            })}

            {paresFiltrados.length === 0 && (
              <p className="asig-empty">No se encontraron resultados.</p>
            )}
          </div>
        </div>

        <div className="asig-panel">
          <h3>Pares seleccionados</h3>

          <div className="asig-tabla-header asig-tabla-header-seleccionados">
            <span>Par evaluador</span>
            <span>Especialidad</span>
            <span>Acciones</span>
          </div>

          <div className="asig-tabla-body">
            {paresSeleccionadosInfo.map((p) => (
              <div className="asig-seleccionado-row" key={p.id}>
                <span className="asig-par-nombre">{p.nombre}</span>
                <span className="asig-par-especialidad">{p.especialidad}</span>
                <button
                  type="button"
                  className="asig-quitar-btn"
                  aria-label="Quitar de la asignación"
                  onClick={() => quitarPar(p.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {paresSeleccionadosInfo.length === 0 && (
              <p className="asig-empty">Todavía no has seleccionado ninguno.</p>
            )}
          </div>

          <div className={`asig-limite-nota ${avisoLimite ? 'asig-limite-nota-alerta' : ''}`}>
            <Info size={14} />
            {config.notaLimite(config.maxPares)}
          </div>
        </div>
      </div>

      <div className="asig-acciones">
        <button type="button" className="asig-btn-cancelar" onClick={handleCancelar}>
          Cancelar
        </button>
        <button type="button" className="asig-btn-asignar" onClick={handleAsignar}>
          Asignar proyecto
        </button>
      </div>

      {guardadoOk && (
        <ConfirmModal
          mensaje={`Se asignaron ${seleccionados.length} evaluador(es) a "${proyectoActual?.titulo ?? 'el proyecto'}" exitosamente.`}
          botonPrimario={{ label: 'Ok', onClick: () => setGuardadoOk(false), variante: 'azul' }}
          onClose={() => setGuardadoOk(false)}
        />
      )}
    </div>
  )
}

export default AsignacionComiteVista