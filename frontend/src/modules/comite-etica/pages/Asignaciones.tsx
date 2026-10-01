import { useState } from 'react'
import AsignacionComiteVista from '../components/AsignacionComiteVista'
import ResultadosPares from '../../evaluaciones/pages/ResultadosPares'
import './Asignaciones.css'

type TabAsignacion = 'etica' | 'investigacion' | 'pares' | 'resultados'

function Asignaciones() {
  const [tab, setTab] = useState<TabAsignacion>('investigacion')

  return (
    <div className="asignaciones-page">
      <div className="asignaciones-tabs">
        <button
          type="button"
          className={`asignaciones-tab ${tab === 'investigacion' ? 'asignaciones-tab-active' : ''}`}
          onClick={() => setTab('investigacion')}
        >
          Asignación Comité Investigación
        </button>
        <button
          type="button"
          className={`asignaciones-tab ${tab === 'etica' ? 'asignaciones-tab-active' : ''}`}
          onClick={() => setTab('etica')}
        >
          Asignación Comité Ética
        </button>
        <button
          type="button"
          className={`asignaciones-tab ${tab === 'pares' ? 'asignaciones-tab-active' : ''}`}
          onClick={() => setTab('pares')}
        >
          Asignación Pares
        </button>
        <button
          type="button"
          className={`asignaciones-tab ${tab === 'resultados' ? 'asignaciones-tab-active' : ''}`}
          onClick={() => setTab('resultados')}
        >
          Resultados de Pares
        </button>
      </div>

      {tab === 'investigacion' && <AsignacionComiteVista tipo="investigacion" columnaSubtab={1} />}
      {tab === 'etica' && <AsignacionComiteVista tipo="etica" columnaSubtab={2} />}
      {tab === 'pares' && <AsignacionComiteVista tipo="pares" columnaSubtab={3} />}
      {tab === 'resultados' && <ResultadosPares />}
    </div>
  )
}

export default Asignaciones