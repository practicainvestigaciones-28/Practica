import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import BuscadorUsuario from '../../usuarios/components/BuscadorUsuario'
import type { UsuarioBuscado } from '../../usuarios/api/usuarios'
import '../../../shared/components/common/ConfirmModal.css'
import './ModalAsignarResponsable.css'

interface ModalAsignarResponsableProps {
  sugerenciaNombre?: string
  sugerenciaCorreo?: string
  advertencias: string[]
  onConfirmar: (usuario: UsuarioBuscado) => void
  onCancelar: () => void
}

function ModalAsignarResponsable({ sugerenciaNombre, sugerenciaCorreo, advertencias, onConfirmar, onCancelar }: ModalAsignarResponsableProps) {
  const [usuario, setUsuario] = useState<UsuarioBuscado | null>(null)

  return (
    <div className="cm-overlay">
      <div className="cm-box mar-box">
        <h3 className="mar-titulo">Asignar responsable del proyecto</h3>
        <p className="mar-texto">
          El documento quedó registrado a nombre del investigador, no del Administrador que lo está cargando. Busca y
          confirma la cuenta real de la persona responsable de este proyecto en el sistema.
        </p>

        {sugerenciaNombre && (
          <p className="mar-sugerencia">
            El documento indica como investigador(a) principal a <strong>{sugerenciaNombre}</strong>
            {sugerenciaCorreo ? ` (${sugerenciaCorreo})` : ''}.
          </p>
        )}

        <BuscadorUsuario
          value={usuario}
          onChange={setUsuario}
          placeholder="Busca por nombre o correo..."
          consultaInicial={sugerenciaNombre ?? ''}
        />

        {advertencias.length > 0 && (
          <div className="mar-advertencias">
            <p className="mar-advertencias-titulo">
              <AlertTriangle size={14} /> Algunos campos no se pudieron reconocer del documento:
            </p>
            <ul>
              {advertencias.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
            <p className="mar-advertencias-nota">Podrás completarlos a mano en el formulario antes de guardar.</p>
          </div>
        )}

        <div className="cm-actions">
          <button type="button" className="cm-btn cm-btn-rojo" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="cm-btn cm-btn-azul" disabled={!usuario} onClick={() => usuario && onConfirmar(usuario)}>
            Confirmar y continuar
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalAsignarResponsable
