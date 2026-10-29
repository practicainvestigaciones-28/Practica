import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AsignacionComiteVista from '../components/AsignacionComiteVista'
import ResultadosPares from '../../evaluaciones/pages/ResultadosPares'
import './Asignaciones.css'

type TabAsignacion = 'etica' | 'investigacion' | 'pares' | 'resultados'
const TABS: TabAsignacion[] = ['investigacion', 'etica', 'pares', 'resultados']

/** Las notificaciones enlazan a /asignaciones?tab=... para abrir la pestaña que corresponde. */
function tabDesdeUrl(valor: string | null): TabAsignacion {
  return TABS.includes(valor as TabAsignacion) ? (valor as TabAsignacion) : 'investigacion'
}

function Asignaciones() {
  const [searchParams] = useSearchParams()
  const tabUrl = searchParams.get('tab')
  const [tab, setTab] = useState<TabAsignacion>(() => tabDesdeUrl(tabUrl))

  // Si ya estaba en Asignaciones y abre otra notificación, cambia de pestaña.
  useEffect(() => {
    if (tabUrl) setTab(tabDesdeUrl(tabUrl))
  }, [tabUrl])

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