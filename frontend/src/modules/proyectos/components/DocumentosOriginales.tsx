import { useEffect, useState } from 'react'
import { Download, Eye, FileText } from 'lucide-react'
import {
  ETIQUETA_TIPO_HISTORICO,
  descargarDocumentoHistorico,
  listarDocumentosHistoricos,
  verDocumentoHistorico,
  type DocumentoHistorico,
} from '../api/historicos'
import './DocumentosOriginales.css'

/** Insignia de un proyecto finalizado cargado desde sus PDF (anterior al sistema). */
export function InsigniaHistorico() {
  return (
    <span className="do-insignia" title="Proyecto anterior al sistema, cargado desde sus documentos en PDF">
      Histórico
    </span>
  )
}

const etiqueta = (d: DocumentoHistorico) =>
  d.tipo === 'informe_avance' ? `${ETIQUETA_TIPO_HISTORICO[d.tipo]}, periodo ${d.numero_periodo}` : ETIQUETA_TIPO_HISTORICO[d.tipo]

/** PDF originales de un proyecto finalizado: cada uno se puede ver o descargar. */
function DocumentosOriginales({ idProyecto }: { idProyecto: number }) {
  const [documentos, setDocumentos] = useState<DocumentoHistorico[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listarDocumentosHistoricos(idProyecto)
      .then(setDocumentos)
      .catch(() => setError('No se pudieron cargar los documentos originales.'))
  }, [idProyecto])

  if (error) return <p className="do-error">{error}</p>
  if (!documentos || documentos.length === 0) return null

  return (
    <section className="do-seccion">
      <h3 className="do-titulo">
        Documentos originales <InsigniaHistorico />
      </h3>
      <ul className="do-lista">
        {documentos.map((d) => (
          <li className="do-fila" key={d.id_documento_historico}>
            <span className="do-nombre">
              <FileText size={15} />
              <strong>{etiqueta(d)}</strong>
              <span className="do-archivo" title={d.nombre_original}>
                {d.nombre_original}
              </span>
            </span>
            <span className="do-acciones">
              <button type="button" className="do-boton" onClick={() => verDocumentoHistorico(idProyecto, d).catch(() => setError('No se pudo abrir el PDF.'))}>
                <Eye size={13} />
                Ver
              </button>
              <button
                type="button"
                className="do-boton"
                onClick={() => descargarDocumentoHistorico(idProyecto, d).catch(() => setError('No se pudo descargar el PDF.'))}
              >
                <Download size={13} />
                Descargar
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default DocumentosOriginales
