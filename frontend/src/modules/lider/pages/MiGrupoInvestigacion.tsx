import { useEffect, useState } from 'react'
import * as gruposApi from '../../proyectos/api/grupos'
import GrupoInformacionGeneralForm from '../../proyectos/components/GrupoInformacionGeneralForm'
import './SeguimientoProyectos.css'

/** El Líder mantiene aquí la información general de los grupos que lidera (facultad, GrupLAC, categoría...). */
function MiGrupoInvestigacion() {
  const [misGrupos, setMisGrupos] = useState<gruposApi.GrupoInvestigacionItem[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    gruposApi
      .listarMisGrupos()
      .then(setMisGrupos)
      .catch(() => setMisGrupos([]))
      .finally(() => setCargando(false))
  }, [])

  return (
    <div className="lider-page">
      <div className="lider-header-card">
        <h2>Mi grupo de investigación</h2>
        <p>Información general del grupo de investigación que lideras.</p>
      </div>

      <div className="lider-mis-grupos">
        {cargando && <p className="lider-vacio">Cargando...</p>}
        {!cargando && misGrupos.length === 0 && (
          <p className="lider-vacio">
            Todavía no tienes ningún grupo de investigación asignado. El Administrador debe asignarte como líder desde el catálogo de grupos.
          </p>
        )}
        {misGrupos.map((g) => (
          <div className="lider-grupo-card" key={g.id_grupo}>
            <h3>{g.nombre}</h3>
            <GrupoInformacionGeneralForm
              grupo={g}
              esAdmin={false}
              onGuardado={(registro) => setMisGrupos((actual) => actual.map((x) => (x.id_grupo === registro.id_grupo ? registro : x)))}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default MiGrupoInvestigacion
