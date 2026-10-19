import { useCallback, useEffect, useState } from 'react'
import * as api from '../api/seguimiento'
import type { ProyectoSeguimiento } from '../api/tipos'
import { useAccion } from '../lib/useAccion'
import { Aviso, Encabezado, Pestanas } from '../components/UI'
import { BandejaAvances, BandejaInformesFinales, BandejaNovedades, BandejaSolicitudesAvance } from '../components/Bandejas'
import { informeFinalSolicitudPendiente, solicitudPendiente } from '../lib/reglas'
import './Seguimiento.css'

type Bandeja = 'solicitudes' | 'avances' | 'novedades' | 'finales'

/** Bandejas de la Vicerrectoría: todo lo que espera una decisión del Administrador. */
function BandejasSeguimiento() {
  const [proyectos, setProyectos] = useState<ProyectoSeguimiento[]>([])
  const [bandeja, setBandeja] = useState<Bandeja>('solicitudes')
  const [soloPendientes, setSoloPendientes] = useState(true)

  const cargar = useCallback(() => {
    api.listarProyectosSeguimiento().then(setProyectos)
  }, [])
  const { ocupado, error, aviso, ejecutar } = useAccion(cargar)

  useEffect(() => {
    cargar()
  }, [cargar])

  const pendientes: Record<Bandeja, number> = {
    solicitudes: proyectos.reduce((t, p) => t + p.periodos.filter(solicitudPendiente).length + (informeFinalSolicitudPendiente(p) ? 1 : 0), 0),
    avances: proyectos.reduce((t, p) => t + p.periodos.filter((x) => x.estado === 'Radicado').length, 0),
    novedades: proyectos.reduce((t, p) => t + p.novedades.filter((n) => n.estado === 'Pendiente').length, 0),
    finales: proyectos.filter((p) => p.informe_final.estado === 'Radicado').length,
  }
  const etiqueta = (texto: string, b: Bandeja) => (pendientes[b] ? `${texto} (${pendientes[b]})` : texto)
  const props = { proyectos, soloPendientes, ejecutar, ocupado }

  return (
    <div className="seg-page">
      <Encabezado titulo="Bandejas de seguimiento" miga="Seguimiento › Bandejas de la Vicerrectoría">
        <p className="seg-ayuda">Solicitudes, informes y novedades que esperan la decisión de la Vicerrectoría de Investigación y Extensión.</p>
      </Encabezado>

      <Pestanas
        opciones={[
          { valor: 'solicitudes', etiqueta: etiqueta('Solicitudes de informe', 'solicitudes') },
          { valor: 'avances', etiqueta: etiqueta('Informes de avance', 'avances') },
          { valor: 'novedades', etiqueta: etiqueta('Novedades', 'novedades') },
          { valor: 'finales', etiqueta: etiqueta('Informes finales', 'finales') },
        ]}
        activa={bandeja}
        onCambiar={setBandeja}
      />

      {error && <Aviso tipo="error">{error}</Aviso>}
      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}

      <section className="seg-card">
        <label className="seg-check" style={{ marginBottom: 12 }}>
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
          Mostrar solo pendientes de decisión
        </label>
        {bandeja === 'solicitudes' && <BandejaSolicitudesAvance {...props} />}
        {bandeja === 'avances' && <BandejaAvances {...props} />}
        {bandeja === 'novedades' && <BandejaNovedades {...props} />}
        {bandeja === 'finales' && <BandejaInformesFinales {...props} />}
      </section>
    </div>
  )
}

export default BandejasSeguimiento
