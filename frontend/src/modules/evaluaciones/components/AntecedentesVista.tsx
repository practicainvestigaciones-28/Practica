import { partesAntecedente } from '../../proyectos/lib/antecedentes'
import './DatosGeneralesVista.css'

/** Antecedentes como en el documento: el título numerado arriba y su contenido debajo. */
function AntecedentesVista({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="dgv-etiqueta">Sin información registrada.</p>
  return (
    <div className="dgv-antecedentes">
      {items.map((texto, idx) => {
        const { titulo, contenido } = partesAntecedente(texto)
        return (
          <div className="dgv-antecedente" key={idx}>
            {titulo && <p className="dgv-antecedente-titulo">{titulo}</p>}
            {contenido && <p className="dgv-antecedente-contenido">{contenido}</p>}
          </div>
        )
      })}
    </div>
  )
}

export default AntecedentesVista
