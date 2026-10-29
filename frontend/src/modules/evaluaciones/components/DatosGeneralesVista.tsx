import type { CampoDatoGeneral, ParticipanteDatoGeneral } from '../lib/datosGeneralesProyecto'
import './DatosGeneralesVista.css'

/** "Información general" del proyecto en los checklists de comité: una tarjeta por participante y luego los datos del proyecto. */
function DatosGeneralesVista({
  camposProyecto,
  participantes,
}: {
  camposProyecto: CampoDatoGeneral[]
  participantes: ParticipanteDatoGeneral[]
}) {
  return (
    <div className="dgv">
      <div className="dgv-bloque">
        <span className="dgv-bloque-titulo">Participantes</span>
        <div className="dgv-participantes">
          {participantes.map((p, idx) => (
            <div className="dgv-participante" key={idx}>
              <div className="dgv-participante-encabezado">
                <span className="dgv-participante-nombre">{p.nombre}</span>
                <span className="dgv-participante-rol">{p.categoria}</span>
              </div>
              <span className="dgv-participante-correo">{p.correo}</span>
              <div className="dgv-grid dgv-grid-compacta">
                {p.campos.map((campo) => (
                  <div className="dgv-campo" key={campo.label}>
                    <span className="dgv-etiqueta">{campo.label}</span>
                    <span className="dgv-valor">{campo.valor}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="dgv-bloque">
        <span className="dgv-bloque-titulo">Datos del proyecto</span>
        <div className="dgv-grid">
          {camposProyecto.map((campo) => (
            <div className={`dgv-campo${campo.valor.length > 60 ? ' dgv-campo-ancho' : ''}`} key={campo.label}>
              <span className="dgv-etiqueta">{campo.label}</span>
              <span className="dgv-valor">{campo.valor}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DatosGeneralesVista
