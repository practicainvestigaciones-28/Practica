import { useEffect, useState } from 'react'
import { Eye, Download } from 'lucide-react'
import * as pagosApi from '../api/pagos'
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

  useEffect(() => {
    pagosApi
      .obtenerMiHistorialPagos()
      .then(({ historial }) => setHistorial(historial))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial de pagos.'))
      .finally(() => setCargando(false))
  }, [])

  const verComprobante = (item: pagosApi.HistorialPagoItem) => {
    if (item.id_pago === null) return
    pagosApi.verMiComprobante(item.id_pago).catch(() => setError('No se pudo abrir el comprobante.'))
  }

  const descargarComprobante = (item: pagosApi.HistorialPagoItem) => {
    if (item.id_pago === null) return
    pagosApi.descargarMiComprobante(item.id_pago, `comprobante-${item.proyecto.titulo}`).catch(() => setError('No se pudo descargar el comprobante.'))
  }

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
              <th>Comprobante</th>
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
                  <div className="hist-comprobante-acciones">
                    <button
                      type="button"
                      className="hist-comprobante-btn"
                      disabled={!item.tiene_comprobante}
                      onClick={() => verComprobante(item)}
                    >
                      <Eye size={14} />
                      Ver
                    </button>
                    <button
                      type="button"
                      className="hist-comprobante-btn-descargar"
                      aria-label="Descargar comprobante"
                      title="Descargar"
                      disabled={!item.tiene_comprobante}
                      onClick={() => descargarComprobante(item)}
                    >
                      <Download size={14} />
                    </button>
                  </div>
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
