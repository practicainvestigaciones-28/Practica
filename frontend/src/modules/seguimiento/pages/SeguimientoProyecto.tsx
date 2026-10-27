import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getRolesEfectivos, type Role } from '../../auth/lib/auth'
import * as api from '../api/seguimiento'
import type { ProyectoSeguimiento } from '../api/tipos'
import { formatoFecha } from '../lib/formato'
import { duracionTotal, estadoSeguimiento, fechaFin, informeFinalNoDisponible, proyectoBloqueado } from '../lib/reglas'
import { mensajeDeError, useAccion } from '../lib/useAccion'
import { Aviso, Badge, Encabezado, Pestanas } from '../components/UI'
import MensajeAccion from '../components/MensajeAccion'
import AvancesTab from '../components/AvancesTab'
import NovedadesTab from '../components/NovedadesTab'
import InformeFinalTab from '../components/InformeFinalTab'
import CierreTab from '../components/CierreTab'
import type { PropsPestana } from '../components/props'
import './Seguimiento.css'

type Pestana = 'avances' | 'novedades' | 'final' | 'cierre'

const PESTANAS: { valor: Pestana; etiqueta: string; roles: Role[]; Componente: (p: PropsPestana) => ReactNode }[] = [
  { valor: 'avances', etiqueta: 'Informes de avance', roles: ['administrador', 'usuario'], Componente: AvancesTab },
  { valor: 'novedades', etiqueta: 'Novedades', roles: ['administrador', 'usuario'], Componente: NovedadesTab },
  { valor: 'final', etiqueta: 'Informe final', roles: ['administrador', 'usuario', 'vicerrector', 'lider'], Componente: InformeFinalTab },
  { valor: 'cierre', etiqueta: 'Cierre', roles: ['administrador', 'usuario', 'vicerrector', 'lider'], Componente: CierreTab },
]

function SeguimientoProyecto() {
  const { id } = useParams()
  const id_proyecto = Number(id)
  const navigate = useNavigate()
  const roles = getRolesEfectivos()
  const visibles = PESTANAS.filter((p) => p.roles.some((r) => roles.includes(r)))

  const [proyecto, setProyecto] = useState<ProyectoSeguimiento | null>(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [pestana, setPestana] = useState<Pestana>(visibles[0]?.valor ?? 'avances')

  const cargar = useCallback(() => {
    api
      .obtenerProyectoSeguimiento(id_proyecto)
      .then(setProyecto)
      .catch((err) => setErrorCarga(mensajeDeError(err, 'No se pudo cargar el proyecto.')))
  }, [id_proyecto])

  const { ocupado, error, aviso, ancla, ejecutar } = useAccion(cargar)

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!proyecto) {
    return (
      <div className="seg-page">
        {errorCarga ? <Aviso tipo="error">{errorCarga}</Aviso> : <p className="seg-vacio">Cargando proyecto...</p>}
      </div>
    )
  }

  const activa = visibles.find((p) => p.valor === pestana) ?? visibles[0]
  const bloqueado = proyectoBloqueado(proyecto)

  return (
    <div className="seg-page">
      <Encabezado titulo={proyecto.titulo} miga="Seguimiento › Proyecto">
        <button type="button" className="seg-link" onClick={() => navigate('/seguimiento')}>
          <ArrowLeft size={14} /> Volver al listado
        </button>
        <div className="seg-meta">
          <span>Estado: <Badge estado={estadoSeguimiento(proyecto)} /></span>
          <span><b>Investigador principal:</b> {proyecto.investigador_principal}</span>
          <span><b>Grupo:</b> {proyecto.grupo}</span>
          <span><b>Centro de costos:</b> {proyecto.centro_costos}</span>
          <span><b>Ejecución:</b> {formatoFecha(proyecto.fecha_inicio)} – {formatoFecha(fechaFin(proyecto))} ({duracionTotal(proyecto)} meses)</span>
        </div>
      </Encabezado>

      {bloqueado && <Aviso tipo="info">El proyecto está {estadoSeguimiento(proyecto).toLowerCase()}: toda la información queda de solo lectura.</Aviso>}

      <Pestanas
        opciones={visibles.map((p) => ({
          ...p,
          etiqueta: p.valor === 'final' && informeFinalNoDisponible(proyecto) ? `${p.etiqueta} (bloqueado)` : p.etiqueta,
        }))}
        activa={activa.valor}
        onCambiar={setPestana}
      />

      <MensajeAccion error={error} aviso={aviso} ancla={ancla} />

      <activa.Componente proyecto={proyecto} roles={roles} ejecutar={ejecutar} ocupado={ocupado} bloqueado={bloqueado} />
    </div>
  )
}

export default SeguimientoProyecto
