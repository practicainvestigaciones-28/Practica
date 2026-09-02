import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, Search, MessageCircle, FilePlus } from 'lucide-react'
import { estadoConfig, ordenEstados, type Estado } from '../lib/estado'
import { getRole } from '../lib/auth'
import ConfirmModal from '../components/ConfirmModal'
import './Proyectos.css'
import * as convocatoriasApi from '../api/convocatorias'
import * as proyectosApi from '../api/proyectos'
import { useAuth } from '../context/AuthContext'

/** Traduce el estado_actual real del backend al tipo Estado que usa la UI */
function mapearEstado(estadoBackend: string): Estado {
  switch (estadoBackend) {
    case 'revision':
      return 'En revisión'
    case 'aprobado':
    case 'finalizado':
      return 'Aprobado'
    case 'aprobado_con_correcciones':
      return 'Correcciones'
    case 'rechazado':
    case 'no_cumple':
      return 'Rechazado'
    default:
      return 'Pendiente'
  }
}

// ---------- Vista de administrador (tabla global de proyectos) ----------

function ProyectosAdministrador() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [proyectos, setProyectos] = useState<proyectosApi.ProyectoListado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    proyectosApi
      .listarProyectos({ limit: 100 })
      .then((res) => setProyectos(res.data))
      .catch(() => setError('No se pudieron cargar los proyectos.'))
      .finally(() => setCargando(false))
  }, [])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [archivoCargado, setArchivoCargado] = useState<string | null>(null)

  const handleCargarClick = () => {
    fileInputRef.current?.click()
  }

  const handleArchivoSeleccionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    console.log('Cargar proyectos desde archivo:', file.name)
    setArchivoCargado(file.name)
    e.target.value = ''
  }

  const proyectosFiltrados = proyectos.filter((p) =>
    [p.titulo, `${p.creador.nombre} ${p.creador.apellido}`, p.convocatoria?.nombre ?? ''].some((campo) =>
      campo.toLowerCase().includes(busqueda.toLowerCase())
    )
  )

  return (
    <div className="proyectos-admin">
      <div className="proyectos-toolbar">
        <button
          type="button"
          className="btn-add-proyecto"
          onClick={() => navigate('/proyectos/nuevo')}
        >
          <Plus size={16} />
          Añadir proyecto
        </button>

        <button type="button" className="btn-upload-proyecto" onClick={handleCargarClick}>
          <Upload size={16} />
          Cargar proyectos
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
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
          <span>Título</span>
          <span className="proyectos-header-investigador">Investigador</span>
          <div className="proyectos-fase-header">
            <span>Convocatoria</span>
            <div className="proyectos-estado-legend">
              {ordenEstados.map((estado) => (
                <span
                  key={estado}
                  className="proyectos-estado-segment"
                  style={{ background: estadoConfig[estado].color }}
                  title={estado}
                />
              ))}
            </div>
          </div>
        </div>

        {cargando && <p className="proyectos-empty">Cargando proyectos...</p>}
        {error && <p className="proyectos-empty">{error}</p>}

        {!cargando &&
          proyectosFiltrados.map((p) => {
            const estado = mapearEstado(p.estado_actual)
            return (
              <button type="button" className="proyectos-row" key={p.id_proyecto}>
                <span className="proyectos-row-titulo">{p.titulo}</span>
                <span className="proyectos-row-investigador">
                  {p.creador.nombre} {p.creador.apellido}
                </span>
                <span className="proyectos-row-fase">{p.convocatoria?.nombre ?? '—'}</span>
                <span
                  className="proyectos-row-estado"
                  style={{ background: estadoConfig[estado].color }}
                  title={`Estado: ${estado}`}
                />
              </button>
            )
          })}

        {!cargando && !error && proyectosFiltrados.length === 0 && (
          <p className="proyectos-empty">No se encontraron proyectos.</p>
        )}
      </div>

      {archivoCargado && (
        <ConfirmModal
          mensaje={`Archivo "${archivoCargado}" recibido correctamente.`}
          botonPrimario={{ label: 'Ok', onClick: () => setArchivoCargado(null), variante: 'azul' }}
          onClose={() => setArchivoCargado(null)}
        />
      )}
    </div>
  )
}

// ---------- Vista de investigador (solo sus propios proyectos) ----------

function ProyectosInvestigador() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [nombreConvocatoriaActiva, setNombreConvocatoriaActiva] = useState<string | null>(null)
  const [cargandoConvocatoria, setCargandoConvocatoria] = useState(true)
  const [misProyectos, setMisProyectos] = useState<proyectosApi.ProyectoListado[]>([])
  const [cargandoProyectos, setCargandoProyectos] = useState(true)

  useEffect(() => {
    convocatoriasApi
      .listarConvocatorias()
      .then((lista) => {
        const activa = lista.find((c) => c.estado === 'activa')
        setNombreConvocatoriaActiva(activa ? activa.nombre : null)
      })
      .catch(() => setNombreConvocatoriaActiva(null))
      .finally(() => setCargandoConvocatoria(false))
  }, [])

  useEffect(() => {
    if (!usuario) return
    // TODO: el backend todavía no filtra por creado_por — mientras tanto se
    // trae una página grande y se filtra en el cliente. Si el sistema llega
    // a tener más de 100 proyectos activos, esto debería moverse a un
    // filtro real del lado del servidor.
    proyectosApi
      .listarProyectos({ limit: 100 })
      .then((res) => setMisProyectos(res.data.filter((p) => p.creador.id_usuario === usuario.id_usuario)))
      .catch(() => setMisProyectos([]))
      .finally(() => setCargandoProyectos(false))
  }, [usuario])

  return (
    <div className="proyectos-investigador">
      <div className="convocatoria-bar">
        <span className="convocatoria-label">
          Convocatoria Activa:{' '}
          <strong>
            {cargandoConvocatoria ? 'Cargando...' : nombreConvocatoriaActiva ?? 'No hay convocatoria activa'}
          </strong>
        </span>

        <button
          type="button"
          className="btn-crear-proyecto"
          onClick={() => navigate('/proyectos/nuevo')}
        >
          <FilePlus size={16} />
          Crear Proyecto
        </button>
      </div>

      <div className="info-proyectos-card">
        <div className="info-proyectos-header">
          <h2>Información proyectos</h2>
        </div>

        <div className="info-proyectos-table-header">
          <span>Título</span>
          <div className="fase-header">
            <span>Estado</span>
            <div className="fase-legend">
              {ordenEstados.map((estado) => (
                <span
                  key={estado}
                  className="fase-legend-swatch"
                  style={{ background: estadoConfig[estado].color }}
                  title={estado}
                />
              ))}
            </div>
          </div>
        </div>

        {cargandoProyectos && <p className="proyectos-empty">Cargando proyectos...</p>}

        {!cargandoProyectos && misProyectos.length === 0 ? (
          <p className="proyectos-empty">Todavía no tienes proyectos registrados.</p>
        ) : (
          misProyectos.map((p) => {
            const estado = mapearEstado(p.estado_actual)
            return (
              <div className="info-proyecto-row" key={p.id_proyecto}>
                <span className="info-proyecto-titulo">{p.titulo}</span>
                <span className="info-proyecto-fase">{p.convocatoria?.nombre ?? '—'}</span>
                <span
                  className="info-proyecto-color"
                  style={{ background: estadoConfig[estado].color }}
                  title={`Estado: ${estado}`}
                />
                <button
                  type="button"
                  className="info-proyecto-chat"
                  aria-label="Ver observaciones"
                  onClick={() => navigate('/proyectos/observaciones', { state: { titulo: p.titulo } })}
                >
                  <MessageCircle size={16} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ---------- Selector según el rol ----------

function Proyectos() {
  const role = getRole()
  return role === 'administrador' ? <ProyectosAdministrador /> : <ProyectosInvestigador />
}

export default Proyectos