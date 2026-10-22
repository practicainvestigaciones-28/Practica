import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [posicion, setPosicion] = useState<{ top: number; right: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // El botón suele vivir dentro de una tabla (p. ej. el listado de
  // "Proyectos"): si el menú fuera hijo directo del botón, el `overflow` de
  // la fila o de la tabla lo recorta y queda tapado. Se saca por portal a
  // <body> y se posiciona con las coordenadas reales del botón.
  useEffect(() => {
    if (!menuAbierto) return

    const actualizarPosicion = () => {
      const rect = botonRef.current?.getBoundingClientRect()
      if (rect) setPosicion({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }

    actualizarPosicion()
    window.addEventListener('scroll', actualizarPosicion, true)
    window.addEventListener('resize', actualizarPosicion)
    return () => {
      window.removeEventListener('scroll', actualizarPosicion, true)
      window.removeEventListener('resize', actualizarPosicion)
    }
  }, [menuAbierto])

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      const objetivo = e.target as Node
      const dentro = wrapperRef.current?.contains(objetivo) || menuRef.current?.contains(objetivo)
      if (!dentro) setMenuAbierto(false)
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
    <div className="dpb-wrapper" ref={wrapperRef} onClick={(e) => e.stopPropagation()}>
      <button
        ref={botonRef}
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

      {menuAbierto &&
        posicion &&
        createPortal(
          <div className="dpb-menu" ref={menuRef} style={{ position: 'fixed', top: posicion.top, right: posicion.right }}>
            <button type="button" onClick={() => descargar('word')}>Formato Word (.docx)</button>
            <button type="button" onClick={() => descargar('pdf')}>Formato PDF</button>
          </div>,
          document.body
        )}
    </div>
  )
}

export default DescargarProyectoBoton
