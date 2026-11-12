import { CheckCircle2, Clock } from 'lucide-react'
import '../../../shared/components/common/ConfirmModal.css'
import './ModalTipoCarga.css'

export type TipoCargaProyecto = 'en_curso' | 'finalizado'

interface ModalTipoCargaProps {
  onElegir: (tipo: TipoCargaProyecto) => void
  onCancelar: () => void
  /** El proyecto finalizado se habilita cuando esté lista la carga de proyectos históricos. */
  finalizadoDisponible?: boolean
}

/** Al cargar un proyecto, el Administrador indica si va a entrar al flujo del sistema o si ya terminó y se carga como histórico. */
function ModalTipoCarga({ onElegir, onCancelar, finalizadoDisponible = false }: ModalTipoCargaProps) {
  return (
    <div className="cm-overlay">
      <div className="cm-box mtc-box">
        <h3 className="mtc-titulo">¿Qué proyecto vas a cargar?</h3>

        <div className="mtc-opciones">
          <button type="button" className="mtc-opcion" onClick={() => onElegir('finalizado')} disabled={!finalizadoDisponible}>
            <CheckCircle2 size={22} />
            <span className="mtc-opcion-titulo">Proyecto finalizado</span>
            <span className="mtc-opcion-texto">
              Ya terminó, anterior al sistema. Se anexan el proyecto, el acta de inicio, los informes y el acta de cierre en PDF.
              {!finalizadoDisponible && ' (Próximamente)'}
            </span>
          </button>

          <button type="button" className="mtc-opcion" onClick={() => onElegir('en_curso')}>
            <Clock size={22} />
            <span className="mtc-opcion-titulo">Proyecto en curso</span>
            <span className="mtc-opcion-texto">
              Entra al flujo del sistema. Las firmas quedan pendientes y al investigador le llega la notificación para firmar.
            </span>
          </button>
        </div>

        <div className="cm-actions">
          <button type="button" className="cm-btn cm-btn-rojo" onClick={onCancelar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalTipoCarga
