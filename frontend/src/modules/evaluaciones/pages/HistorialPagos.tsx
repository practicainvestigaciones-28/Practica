import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import * as pagosApi from '../api/pagos'
import { descargarPdfCalificacionPar } from '../lib/pdfCalificacionPar'
import { ApiError } from '../../../shared/api/client'
import './HistorialPagos.css'

function formatearValor(valor: number | null): string {
  if (valor === null) return '—'
  return `$${valor.toLocaleString('es-CO')}`
}

function HistorialPagos() {
  const [historial, setHistorial] = useState<pagosApi.HistorialPagoItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [descargando, setDescargando] = useState<number | null>(null)

  // Cada par puede descargar su calificación firmada (formato INV-IC-FR-008).
  const descargarCalificacion = (id_evaluacion: number) => {
    setDescargando(id_evaluacion)
    descargarPdfCalificacionPar(id_evaluacion)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo generar el PDF de la calificación.'))
      .finally(() => setDescargando(null))
  }

  useEffect(() => {
    pagosApi
      .obtenerMiHistorialPagos()
      .then(({ historial }) => setHistorial(historial))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial de pagos.'))
      .finally(() => setCargando(false))
  }, [])

  return (
    <div className="hist-page">
      <div className="hist-header-card">
        <h2>Historial de Pagos</h2>
        <p>Listado de pagos recibidos.</p>
      </div>

      {error && <p className="hist-error">{error}</p>}

      <div className="hist-tabla-wrapper">
        <table className="hist-tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Valor a pagar</th>
              <th>Estado</th>
              <th>Mi calificación</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={4} className="hist-empty">Cargando historial...</td>
              </tr>
            )}

            {!cargando && historial.length === 0 && (
              <tr>
                <td colSpan={4} className="hist-empty">Todavía no tienes pagos registrados.</td>
              </tr>
            )}

            {!cargando && historial.map((item) => (
              <tr key={item.id_evaluacion}>
                <td>{item.proyecto.titulo}</td>
                <td>{formatearValor(item.valor_pago)}</td>
                <td>
                  <span className={`hist-estado-badge ${item.pagado ? 'hist-estado-pagado' : 'hist-estado-pendiente'}`}>
                    {item.pagado ? 'Pagado' : 'Pendiente'}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="hist-descargar-btn"
                    onClick={() => descargarCalificacion(item.id_evaluacion)}
                    disabled={descargando === item.id_evaluacion}
                  >
                    <Download size={13} />
                    {descargando === item.id_evaluacion ? 'Generando...' : 'Descargar PDF'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default HistorialPagos
