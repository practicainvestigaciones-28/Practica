import { useState } from 'react'
import AsignacionComiteVista from '../components/AsignacionComiteVista'
import './Asignaciones.css'

type TabAsignacion = 'etica' | 'investigacion' | 'pares'

function Asignaciones() {
  const [tab, setTab] = useState<TabAsignacion>('etica')

  return (
    <div className="asignaciones-page">
      <div className="asignaciones-tabs">
        <button
          type="button"
          className={`asignaciones-tab ${tab === 'etica' ? 'asignaciones-tab-active' : ''}`}
          onClick={() => setTab('etica')}
        >
          Asignación Comité Ética
        </button>
        <button
          type="button"
          className={`asignaciones-tab ${tab === 'investigacion' ? 'asignaciones-tab-active' : ''}`}
          onClick={() => setTab('investigacion')}
        >
          Asignación Comité Investigación
        </button>
        <button
          type="button"
          className={`asignaciones-tab ${tab === 'pares' ? 'asignaciones-tab-active' : ''}`}
          onClick={() => setTab('pares')}
        >
          Asignación Pares
        </button>
      </div>

      {tab === 'etica' && <AsignacionComiteVista tipo="etica" columnaSubtab={1} />}
      {tab === 'investigacion' && <AsignacionComiteVista tipo="investigacion" columnaSubtab={2} />}
      {tab === 'pares' && <AsignacionComiteVista tipo="pares" columnaSubtab={3} />}
    </div>
  )
}

export default Asignaciones