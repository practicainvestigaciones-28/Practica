import { GripVertical } from 'lucide-react'
import type { EstadoArrastre } from '../../hooks/useArrastrarLista'

interface CuadroFlotanteArrastreProps {
  arrastre: EstadoArrastre | null
  className: string
}

/** "Cuadro flotante" que sigue al cursor mientras se arrastra una fila (ver useArrastrarLista). */
function CuadroFlotanteArrastre({ arrastre, className }: CuadroFlotanteArrastreProps) {
  if (!arrastre) return null
  return (
    <div className={className} style={{ left: arrastre.x, top: arrastre.y, width: arrastre.ancho, height: arrastre.alto }}>
      <GripVertical size={14} />
      {arrastre.contenido}
    </div>
  )
}

export default CuadroFlotanteArrastre
