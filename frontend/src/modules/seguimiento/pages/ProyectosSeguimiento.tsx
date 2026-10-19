import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { getRolesEfectivos } from '../../auth/lib/auth'
import * as api from '../api/seguimiento'
import type { ProyectoSeguimiento } from '../api/tipos'
import { formatoFecha } from '../lib/formato'
import { estadoSeguimiento, fechaFin } from '../lib/reglas'
import { Aviso, Badge, Encabezado } from '../components/UI'
import './Seguimiento.css'

const DESCRIPCION: Record<string, string> = {
  administrador: 'Proyectos con acta de inicio legalizada: informes de avance, novedades, informe final y cierre.',
  usuario: 'Tus proyectos en ejecución: reporta avances, registra novedades y presenta el informe final.',
  vicerrector: 'Proyectos en ejecución: firma el acta de cierre.',
  lider: 'Proyectos de tu grupo: firma el informe técnico final y el acta de cierre.',
}

function ProyectosSeguimiento() {
  const navigate = useNavigate()
  // Mensaje con el que llega quien acaba de finalizar un proyecto desde la pestaña de cierre.
  const avisoLlegada = (useLocation().state as { aviso?: string } | null)?.aviso
  const roles = getRolesEfectivos()
  const [proyectos, setProyectos] = useState<ProyectoSeguimiento[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const cargar = () => {
    api
      .listarProyectosSeguimiento()
      .then(setProyectos)
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return proyectos.filter((p) => !q || `${p.titulo} ${p.investigador_principal} ${p.centro_costos}`.toLowerCase().includes(q))
  }, [proyectos, busqueda])

  const descripcion = DESCRIPCION[roles.find((r) => DESCRIPCION[r]) ?? 'usuario']

  return (
    <div className="seg-page">
      <Encabezado titulo="Seguimiento de proyectos" miga="Seguimiento, ejecución y cierre">
        <p className="seg-ayuda">{descripcion}</p>
      </Encabezado>

      {avisoLlegada && <Aviso tipo="ok">{avisoLlegada}</Aviso>}

      <div className="seg-filtros">
        <div className="seg-search">
          <Search size={16} />
          <input placeholder="Busca por título, investigador o centro de costos" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      {cargando ? (
        <p className="seg-vacio">Cargando...</p>
      ) : filtrados.length === 0 ? (
        <p className="seg-vacio">
          {proyectos.length === 0
            ? 'Aún no hay proyectos en etapa de seguimiento. Un proyecto aparece aquí cuando su acta de inicio queda legalizada.'
            : 'No hay proyectos que coincidan con la búsqueda.'}
        </p>
      ) : (
        <div className="seg-card seg-tabla-wrap">
          <table className="seg-tabla">
            <thead>
              <tr>
                <th>Proyecto</th><th>Investigador principal</th><th>Centro de costos</th><th>Finalización</th>
                <th className="c">Informes aprobados</th><th>Estado</th><th />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id_proyecto}>
                  <td>{p.titulo}<br /><small>{p.convocatoria} · {p.modalidad}</small></td>
                  <td>{p.investigador_principal}</td>
                  <td>{p.centro_costos}</td>
                  <td>{formatoFecha(fechaFin(p))}</td>
                  <td className="c">{p.periodos.filter((x) => x.estado === 'Aprobado').length} / {p.periodos.length}</td>
                  <td><Badge estado={estadoSeguimiento(p)} /></td>
                  <td>
                    <button type="button" className="seg-btn seg-btn-sm" onClick={() => navigate(`/seguimiento/${p.id_proyecto}`)}>Abrir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}

export default ProyectosSeguimiento
