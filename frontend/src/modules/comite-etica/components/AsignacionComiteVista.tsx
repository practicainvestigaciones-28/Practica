import { useEffect, useState } from 'react'
import { Archive, Search, Trash2, Info, UserPlus, ArrowLeft } from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import {
  getProyectosParaAsignar,
  getParesEvaluadores,
  getAsignacion,
  guardarAsignacion,
  estaAsignado,
  configComite,
  sincronizarAsignaciones,
  sincronizarEvaluadores,
  type TipoComite,
} from '../lib/asignacionComite'
import './AsignacionComiteVista.css'

type TabLista = 'pendientes' | 'asignados'

interface AsignacionComiteVistaProps {
  tipo: TipoComite

  columnaSubtab?: number
}

function AsignacionComiteVista({ tipo, columnaSubtab = 1 }: AsignacionComiteVistaProps) {
  const config = configComite[tipo]

  const [cargando, setCargando] = useState(true)
  // Arrancan vacíos a propósito: `proyectosEnCache`/`paresEnCache` (en
  // asignacionComite.ts) son variables compartidas entre las 3 pestañas
  // (Investigación/Ética/Pares). Si se leyeran aquí de una vez, al cambiar
  // de pestaña este componente se vuelve a montar y alcanzaría a leer la
  // caché todavía con los datos de la pestaña ANTERIOR, antes de que
  // termine `cargarDatos()`. Se rellenan solo cuando llega la respuesta
  // real del backend para este `tipo` (ver abajo).
  const [proyectos, setProyectos] = useState<ReturnType<typeof getProyectosParaAsignar>>([])
  const [pares, setPares] = useState<ReturnType<typeof getParesEvaluadores>>([])

  const [vista, setVista] = useState<'lista' | 'detalle'>('lista')
  const [tabLista, setTabLista] = useState<TabLista>('pendientes')
  const [busquedaLista, setBusquedaLista] = useState('')

  const [proyectoId, setProyectoId] = useState<number>(0)
  const [busquedaPar, setBusquedaPar] = useState('')
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const [avisoLimite, setAvisoLimite] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Sincronizar datos del backend cuando cambia el tipo de comité
  useEffect(() => {
    const cargarDatos = async () => {
      setCargando(true)
      await Promise.all([sincronizarAsignaciones(tipo), sincronizarEvaluadores(tipo)])
      const proyectosFrescos = getProyectosParaAsignar()
      setProyectos(proyectosFrescos)
      setPares(getParesEvaluadores())
      // Fija el proyecto inicial recién ahora, con la caché ya actualizada
      // para este `tipo` — dispara el efecto de abajo con datos correctos.
      setProyectoId(proyectosFrescos[0]?.id ?? 0)
      setCargando(false)
    }
    cargarDatos()
  }, [tipo])

  // Recalcula la selección cuando cambia el proyecto elegido. Para cuando
  // esto corre, `cargarDatos()` ya actualizó la caché para el `tipo`
  // vigente (proyectoId solo cambia después, vía setProyectoId de arriba o
  // al elegir otro proyecto en el selector), así que nunca lee datos de
  // otra pestaña.
  useEffect(() => {
    setSeleccionados(getAsignacion(tipo, proyectoId))
    setAvisoLimite(false)
    setErrorGuardado('')
  }, [proyectoId, tipo])

  const proyectoActual = proyectos.find((p) => p.id === proyectoId) ?? null

  const abrirDetalleDeLista = (id: number) => {
    setProyectoId(id)
    setVista('detalle')
  }

  const volverALista = () => {
    setVista('lista')
  }

  // Al confirmar una asignación exitosa, lleva directo a la pestaña
  // "Asignados" — antes se quedaba en la misma pantalla de selección, como
  // si nada hubiera pasado, en vez de mostrar dónde quedó el proyecto que
  // se acaba de asignar.
  const irAListaAsignados = () => {
    setGuardadoOk(false)
    setTabLista('asignados')
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
    setErrorGuardado('')
  }

  const handleAsignar = async () => {
    // No se puede guardar una asignación vacía: si ya había un responsable y
    // el Administrador lo quitó para reemplazarlo (está saturado, etc.), debe
    // elegir uno nuevo antes de poder guardar — no queda sin nadie asignado.
    if (seleccionados.length === 0) {
      setErrorGuardado('Selecciona un responsable antes de guardar: la asignación no puede quedar vacía.')
      return
    }
    setErrorGuardado('')
    setGuardando(true)
    try {
      await guardarAsignacion(tipo, proyectoId, seleccionados)
      setGuardadoOk(true)
      // Recargar datos después de guardar
      await Promise.all([sincronizarAsignaciones(tipo), sincronizarEvaluadores(tipo)])
      setProyectos(getProyectosParaAsignar())
      setPares(getParesEvaluadores())
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : 'No se pudo guardar la asignación.')
    } finally {
      setGuardando(false)
    }
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

  if (cargando) {
    return (
      <div className="asig-page">
        <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando asignaciones...</p>
      </div>
    )
  }

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
            <span>{tabLista === 'asignados' ? 'Responsable asignado' : 'Asignar Responsable'}</span>
          </div>

          {proyectosListaFiltrados.map((p) => (
            <div className="asig-lista-row" key={p.id}>
              <span className="asig-par-nombre">{p.titulo}</span>
              <span className="asig-par-especialidad">{p.investigador}</span>
              <div className="asig-lista-accion">
                {tabLista === 'asignados' && p.nombresAsignados.length > 0 && (
                  <div className="asig-lista-responsable-nombre">
                    {p.nombresAsignados.map((nombre, i) => (
                      <span key={i}>{nombre}</span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="asig-lista-asignar-btn"
                  aria-label={tabLista === 'asignados' ? 'Editar responsable' : 'Asignar responsable'}
                  onClick={() => abrirDetalleDeLista(p.id)}
                >
                  <UserPlus size={18} />
                </button>
              </div>
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
        <div className="asig-proyecto-nombre">
          <Archive size={16} />
          <span>{proyectoActual?.titulo ?? ''}</span>
        </div>
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
            <span>{config.etiquetaEvaluador}</span>
            <span>Especialidad</span>
            <span>Estado</span>
          </div>

          <div className="asig-tabla-body">
            {paresFiltrados.map((p) => {
              const marcado = seleccionados.includes(p.id)
              // Al llegar al límite de evaluadores del proyecto, no se puede
              // marcar a nadie más hasta quitar a alguno de "Pares seleccionados".
              const deshabilitado = !marcado && seleccionados.length >= config.maxPares
              return (
                <label className={`asig-tabla-row ${deshabilitado ? 'asig-tabla-row-deshabilitada' : ''}`} key={p.id}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={deshabilitado}
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
          <h3>{config.tituloPanelDerecho}</h3>

          <div className="asig-tabla-header asig-tabla-header-seleccionados">
            <span>{config.etiquetaEvaluador}</span>
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

      {errorGuardado && <p className="asig-error">{errorGuardado}</p>}

      <div className="asig-acciones">
        <button type="button" className="asig-btn-cancelar" onClick={handleCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button
          type="button"
          className="asig-btn-asignar"
          onClick={handleAsignar}
          disabled={guardando || seleccionados.length === 0}
          title={seleccionados.length === 0 ? 'Selecciona un responsable antes de guardar' : undefined}
        >
          {guardando ? 'Guardando...' : 'Asignar proyecto'}
        </button>
      </div>

      {guardadoOk && (
        <ConfirmModal
          mensaje={`Se asignaron ${seleccionados.length} evaluador(es) a "${proyectoActual?.titulo ?? 'el proyecto'}" exitosamente.`}
          botonPrimario={{ label: 'Ok', onClick: irAListaAsignados, variante: 'azul' }}
          onClose={irAListaAsignados}
        />
      )}
    </div>
  )
}

export default AsignacionComiteVista