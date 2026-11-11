import { useState } from 'react'
import { Eye } from 'lucide-react'
import { cargarDatosVistaProyecto } from '../lib/datosVistaProyecto'
import { verPdfProyecto } from '../lib/exportarProyecto'
import './DescargarProyectoBoton.css'

/**
 * Botón para ver el documento del proyecto (formato INV-IC-FR-001 en PDF) en el visor de la aplicación, sin
 * descargarlo — al lado de "Descargar documento".
 */
function VerProyectoBoton({ id_proyecto, conTexto = false }: { id_proyecto: number; conTexto?: boolean }) {
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState(false)

  const ver = (e: React.MouseEvent) => {
    e.stopPropagation()
    setGenerando(true)
    setError(false)
    cargarDatosVistaProyecto(id_proyecto)
      .then((datos) => verPdfProyecto(datos))
      .catch(() => setError(true))
      .finally(() => setGenerando(false))
  }

  if (conTexto) {
    return (
      <div className="dpb-acciones-izquierda">
        <button type="button" className="vdp-descargar-documento-btn" disabled={generando} onClick={ver} title="Ver el documento del proyecto">
          <Eye size={16} />
          {generando ? 'Abriendo...' : 'Ver documento'}
        </button>
        {error && <span className="dpb-error-texto">No se pudo abrir el documento — intenta de nuevo</span>}
      </div>
    )
  }

  return (
    <button
      type="button"
      className="dpb-btn dpb-btn-ver"
      aria-label="Ver documento"
      title={error ? 'No se pudo abrir el documento — intenta de nuevo' : 'Ver documento (PDF)'}
      disabled={generando}
      onClick={ver}
    >
      <Eye size={15} />
    </button>
  )
}

export default VerProyectoBoton
