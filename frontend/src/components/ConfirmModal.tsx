import { X } from 'lucide-react'
import './ConfirmModal.css'

interface ConfirmModalProps {
  mensaje: string
  botonPrimario: { label: string; onClick: () => void; variante?: 'azul' | 'rojo' }
  botonSecundario?: { label: string; onClick: () => void; variante?: 'azul' | 'rojo' }
  onClose: () => void
}

function ConfirmModal({ mensaje, botonPrimario, botonSecundario, onClose }: ConfirmModalProps) {
  return (
    <div className="cm-overlay">
      <div className="cm-box">
        <button type="button" className="cm-close" onClick={onClose} aria-label="Cerrar">
          <X size={16} />
        </button>

        <p className="cm-mensaje">{mensaje}</p>

        <div className="cm-actions">
          {botonSecundario && (
            <button
              type="button"
              className={`cm-btn cm-btn-${botonSecundario.variante ?? 'azul'}`}
              onClick={botonSecundario.onClick}
            >
              {botonSecundario.label}
            </button>
          )}
          <button
            type="button"
            className={`cm-btn cm-btn-${botonPrimario.variante ?? 'rojo'}`}
            onClick={botonPrimario.onClick}
          >
            {botonPrimario.label}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal