import { useState } from 'react'
import { Eye } from 'lucide-react'
import { cargarDatosVistaProyecto } from '../lib/datosVistaProyecto'
import { verPdfProyecto } from '../lib/exportarProyecto'
import './DescargarProyectoBoton.css'

/**
 * Botón para ver el documento del proyecto (formato INV-IC-FR-001 en PDF) en una pestaña nueva, sin
 * descargarlo — al lado de "Descargar documento". La pestaña se abre en el mismo clic, antes de generar el
 * PDF: si se abriera después de esperar, el navegador la bloquearía como ventana emergente.
 */
function VerProyectoBoton({ id_proyecto }: { id_proyecto: number }) {
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState(false)

  const ver = (e: React.MouseEvent) => {
    e.stopPropagation()
    const ventana = window.open('', '_blank')
    if (!ventana) {
      setError(true)
      return
    }
    setGenerando(true)
    setError(false)
    cargarDatosVistaProyecto(id_proyecto)
      .then((datos) => verPdfProyecto(datos, ventana))
      .catch(() => {
        ventana.close()
        setError(true)
      })
      .finally(() => setGenerando(false))
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
