import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, Search, MessageCircle, FilePlus } from 'lucide-react'
import { estadoConfig, ordenEstados, type Estado } from '../lib/estado'
import { getRole } from '../lib/auth'
import ConfirmModal from '../components/ConfirmModal'
import './Proyectos.css'
import * as convocatoriasApi from '../api/convocatorias'

// ---------- Vista de administrador (tabla global de proyectos) ----------

interface ProyectoAdmin {
  titulo: string
  investigador: string
  fase: string
  estado: Estado
}

const proyectosAdmin: ProyectoAdmin[] = [
  { titulo: 'Proyecto 1', investigador: 'Investigador 1', fase: 'Comité investigación', estado: 'Correcciones' },
  { titulo: 'Proyecto 2', investigador: 'Investigador 2', fase: 'Comité ética', estado: 'En revisión' },
  { titulo: 'Proyecto 3', investigador: 'Investigador 3', fase: 'Comité investigación', estado: 'Rechazado' },
  { titulo: 'Proyecto 4', investigador: 'Investigador 4', fase: 'Evaluación pares', estado: 'Aprobado' },
]

function ProyectosAdministrador() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')

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

  const proyectosFiltrados = proyectosAdmin.filter((p) =>
    [p.titulo, p.investigador, p.fase].some((campo) =>
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
            <span>Fase Actual</span>
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

        {proyectosFiltrados.map((p) => (
          <button type="button" className="proyectos-row" key={p.titulo}>
            <span className="proyectos-row-titulo">{p.titulo}</span>
            <span className="proyectos-row-investigador">{p.investigador}</span>
            <span className="proyectos-row-fase">{p.fase}</span>
            <span
              className="proyectos-row-estado"
              style={{ background: estadoConfig[p.estado].color }}
              title={p.estado}
            />
          </button>
        ))}

        {proyectosFiltrados.length === 0 && (
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

interface ProyectoPropio {
  titulo: string
  fase: string
  estado: Estado
}

const misProyectos: ProyectoPropio[] = [
  { titulo: 'Sistema Integral de Gestión Académica', fase: 'Comité investigación', estado: 'Pendiente' },
  { titulo: 'Plataforma de Seguimiento a Proyectos de Investigación', fase: 'Pares', estado: 'Rechazado' },
  { titulo: 'Observatorio de Innovación Regional', fase: 'Comité ética', estado: 'En revisión' },
  { titulo: 'Red de Conocimiento Universitario', fase: 'Comité investigación', estado: 'Aprobado' },
]

function ProyectosInvestigador() {
  const navigate = useNavigate()
  const [nombreConvocatoriaActiva, setNombreConvocatoriaActiva] = useState<string | null>(null)
  const [cargandoConvocatoria, setCargandoConvocatoria] = useState(true)

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
          disabled={cargandoConvocatoria || !nombreConvocatoriaActiva}
          title={
            !cargandoConvocatoria && !nombreConvocatoriaActiva
              ? 'No puedes crear un proyecto porque no hay una convocatoria activa'
              : undefined
          }
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
            <span>Fase Actual</span>
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

        {misProyectos.length === 0 ? (
          <p className="proyectos-empty">Todavía no tienes proyectos registrados.</p>
        ) : (
          misProyectos.map((p) => (
            <div className="info-proyecto-row" key={p.titulo}>
              <span className="info-proyecto-titulo">{p.titulo}</span>
              <span className="info-proyecto-fase">{p.fase}</span>
              <span
                className="info-proyecto-color"
                style={{ background: estadoConfig[p.estado].color }}
                title={p.estado}
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
          ))
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