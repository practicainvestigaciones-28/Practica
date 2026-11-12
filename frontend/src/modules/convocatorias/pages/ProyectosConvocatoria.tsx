import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, Search } from 'lucide-react'
import * as convocatoriasApi from '../lib/convocatorias'
import * as proyectosApi from '../../proyectos/api/proyectos'
import { InsigniaHistorico } from '../../proyectos/components/DocumentosOriginales'
import Paginacion from '../../../shared/components/common/Paginacion'
import { paginar } from '../../../shared/lib/paginar'
import { estadoConfig, mapearEstado } from '../../../shared/lib/estado'
import './ProyectosConvocatoria.css'

/** Todos los proyectos de una convocatoria (el servidor entrega máximo 100 por página, así que se piden todas las páginas). */
async function listarTodosLosProyectosDe(idConvocatoria: number): Promise<proyectosApi.ProyectoListado[]> {
  const primera = await proyectosApi.listarProyectos({ id_convocatoria: idConvocatoria, page: 1, limit: 100 })
  const resto = await Promise.all(
    Array.from({ length: Math.max(0, primera.meta.totalPages - 1) }, (_, i) =>
      proyectosApi.listarProyectos({ id_convocatoria: idConvocatoria, page: i + 2, limit: 100 })
    )
  )
  return [primera, ...resto].flatMap((r) => r.data)
}

/** Proyectos de una convocatoria: el Administrador los ve listados y abre cualquiera. */
function ProyectosConvocatoria() {
  const navigate = useNavigate()
  const { id } = useParams()
  const idConvocatoria = Number(id)

  const [convocatoria, setConvocatoria] = useState<convocatoriasApi.ConvocatoriaBackend | null>(null)
  const [proyectos, setProyectos] = useState<proyectosApi.ProyectoListado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    if (!Number.isInteger(idConvocatoria)) {
      setError('La convocatoria no es válida.')
      setCargando(false)
      return
    }
    Promise.all([convocatoriasApi.obtenerConvocatoria(idConvocatoria), listarTodosLosProyectosDe(idConvocatoria)])
      .then(([c, lista]) => {
        setConvocatoria(c)
        setProyectos(lista)
      })
      .catch(() => setError('No se pudieron cargar los proyectos de la convocatoria.'))
      .finally(() => setCargando(false))
  }, [idConvocatoria])

  useEffect(() => setPagina(1), [busqueda])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return proyectos.filter(
      (p) => !q || `${p.titulo} ${p.creador.nombre} ${p.creador.apellido} ${p.modalidad?.nombre ?? ''}`.toLowerCase().includes(q)
    )
  }, [proyectos, busqueda])
  const paginados = paginar(filtrados, pagina)

  return (
    <div className="pc-page">
      <button type="button" className="pc-volver" onClick={() => navigate('/convocatorias')}>
        <ArrowLeft size={16} />
        Volver a convocatorias
      </button>

      <div className="pc-card">
        <h2 className="pc-titulo">
          {convocatoria?.nombre ?? 'Convocatoria'}
          {convocatoria?.es_historica && <span className="pc-historica">Histórica</span>}
        </h2>
        <p className="pc-subtitulo">
          Proyectos de esta convocatoria{!cargando && !error ? `: ${proyectos.length}` : ''}
        </p>

        <div className="pc-busqueda">
          <Search size={16} />
          <input type="text" placeholder="Buscar por título, investigador o modalidad" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>

        {error && <p className="pc-vacio">{error}</p>}
        {cargando && <p className="pc-vacio">Cargando proyectos...</p>}

        {!cargando && !error && (
          <>
            <div className="pc-lista">
              {paginados.visibles.map((p) => {
                const estado = mapearEstado(p.estado_actual)
                return (
                  <div className="pc-fila" key={p.id_proyecto}>
                    <div className="pc-fila-info">
                      <span className="pc-fila-titulo">
                        {p.titulo} {p.es_historico && <InsigniaHistorico />}
                      </span>
                      <span className="pc-fila-detalle">
                        {p.creador.nombre} {p.creador.apellido} · {p.modalidad?.nombre ?? 'Sin modalidad'}
                      </span>
                    </div>
                    <span className="pc-estado" style={{ background: estadoConfig[estado].color, color: estadoConfig[estado].colorTexto }}>
                      {estado}
                    </span>
                    <button type="button" className="pc-ver" onClick={() => navigate(`/proyectos/ver/${p.id_proyecto}`)}>
                      <Eye size={14} />
                      Ver
                    </button>
                  </div>
                )
              })}
              {filtrados.length === 0 && (
                <p className="pc-vacio">{proyectos.length === 0 ? 'Esta convocatoria todavía no tiene proyectos.' : 'No se encontraron proyectos.'}</p>
              )}
            </div>
            <Paginacion pagina={paginados.pagina} totalPaginas={paginados.totalPaginas} onCambiar={setPagina} />
          </>
        )}
      </div>
    </div>
  )
}

export default ProyectosConvocatoria
