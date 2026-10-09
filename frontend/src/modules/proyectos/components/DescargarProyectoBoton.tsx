import { useEffect, useRef, useState } from 'react'
import { Download, ChevronDown } from 'lucide-react'
import { cargarDatosVistaProyecto } from '../lib/datosVistaProyecto'
import { generarWordProyecto, generarPdfProyecto } from '../lib/exportarProyecto'
import './DescargarProyectoBoton.css'

interface DescargarProyectoBotonProps {
  id_proyecto: number
}

/**
 * Botón "Descargar documento" con las dos opciones (Word/PDF) que ya existían
 * dentro de la revisión de postulados (VistaDetalleProyecto) — se separó en
 * un componente propio para poder ofrecer la misma descarga, con el mismo
 * formato oficial INV-IC-FR-001 ya diligenciado, desde cualquier otra parte
 * del sistema (ej. la lista principal de "Proyectos"), sin tener que abrir
 * toda la vista de revisión solo para descargarlo.
 */
function DescargarProyectoBoton({ id_proyecto }: DescargarProyectoBotonProps) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [])

  const descargar = (formato: 'word' | 'pdf') => {
    setMenuAbierto(false)
    setGenerando(true)
    setError(false)
    cargarDatosVistaProyecto(id_proyecto)
      .then((datos) => (formato === 'word' ? generarWordProyecto(datos) : generarPdfProyecto(datos)))
      .catch(() => setError(true))
      .finally(() => setGenerando(false))
  }

  return (
    <div className="dpb-wrapper" ref={menuRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="dpb-btn"
        aria-label="Descargar documento"
        title={error ? 'No se pudo generar el documento — intenta de nuevo' : 'Descargar documento'}
        disabled={generando}
        onClick={() => setMenuAbierto((actual) => !actual)}
      >
        <Download size={14} />
        <ChevronDown size={12} />
      </button>

      {menuAbierto && (
        <div className="dpb-menu">
          <button type="button" onClick={() => descargar('word')}>Formato Word (.docx)</button>
          <button type="button" onClick={() => descargar('pdf')}>Formato PDF</button>
        </div>
      )}
    </div>
  )
}

export default DescargarProyectoBoton
