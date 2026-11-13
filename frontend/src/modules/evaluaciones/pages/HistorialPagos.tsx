import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import * as pagosApi from '../api/pagos'
import { verPdfCalificacionPar } from '../lib/pdfCalificacionPar'
import { ApiError } from '../../../shared/api/client'
import { useCambios } from '../../../shared/realtime/RealtimeContext'
import './HistorialPagos.css'

function formatearValor(valor: number | null): string {
  if (valor === null) return '—'
  return `$${valor.toLocaleString('es-CO')}`
}

function HistorialPagos() {
  const [historial, setHistorial] = useState<pagosApi.HistorialPagoItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Su calificación firmada (formato INV-IC-FR-008) se ve en el visor; no se descarga.
  const verCalificacion = (id_evaluacion: number) => {
    verPdfCalificacionPar(id_evaluacion).catch((err) =>
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir el PDF de la calificación.')
    )
  }

  const refrescar = () => {
    pagosApi
      .obtenerMiHistorialPagos()
      .then(({ historial }) => setHistorial(historial))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial de pagos.'))
      .finally(() => setCargando(false))
  }

  useEffect(refrescar, [])

  useCambios('pagos', refrescar)

  // Los proyectos del par agrupados por la convocatoria a la que pertenecen (en el orden en que vienen).
  const gruposPorConvocatoria = historial.reduce<{ id_convocatoria: number; nombre: string; items: pagosApi.HistorialPagoItem[] }[]>((grupos, item) => {
    const { id_convocatoria, nombre } = item.proyecto.convocatoria
    const existente = grupos.find((g) => g.id_convocatoria === id_convocatoria)
    if (existente) existente.items.push(item)
    else grupos.push({ id_convocatoria, nombre, items: [item] })
    return grupos
  }, [])

  return (
    <div className="hist-page">
      <div className="hist-header-card">
        <h2>Historial de Pagos</h2>
        <p>Listado de pagos recibidos.</p>
      </div>

      {error && <p className="hist-error">{error}</p>}

      {cargando && <p className="hist-empty hist-vacio-card">Cargando historial...</p>}
      {!cargando && historial.length === 0 && <p className="hist-empty hist-vacio-card">Todavía no tienes pagos registrados.</p>}

      {/* Un bloque por convocatoria, con sus proyectos y el total de lo registrado. */}
      {!cargando &&
        gruposPorConvocatoria.map((grupo) => {
          const total = grupo.items.reduce((suma, i) => suma + (i.valor_pago !== null ? Number(i.valor_pago) : 0), 0)
          return (
            <div className="hist-grupo" key={grupo.id_convocatoria}>
              <h3 className="hist-grupo-titulo">Convocatoria {grupo.nombre}</h3>
              <div className="hist-tabla-wrapper">
                <table className="hist-tabla hist-tabla-proyectos">
                  <thead>
                    <tr>
                      <th>Proyectos</th>
                      <th>Valor a pagar</th>
                      <th>Estado</th>
                      <th>Mi calificación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.items.map((item) => (
                      <tr key={item.id_evaluacion}>
                        <td>
                          <span className="hist-titulo-proyecto" title={item.proyecto.titulo}>{item.proyecto.titulo}</span>
                        </td>
                        <td>{formatearValor(item.valor_pago)}</td>
                        <td>
                          <span className={`hist-estado-badge ${item.pagado ? 'hist-estado-pagado' : 'hist-estado-pendiente'}`}>
                            {item.pagado ? 'Pagado' : 'Pendiente'}
                          </span>
                        </td>
                        <td>
                          <div className="hist-calificacion-acciones">
                            <button type="button" className="hist-descargar-btn" onClick={() => verCalificacion(item.id_evaluacion)}>
                              <Eye size={13} />
                              Ver
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {grupo.items.length > 1 && (
                    <tfoot>
                      <tr>
                        <td>Total de la convocatoria</td>
                        <td>{formatearValor(total)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )
        })}
    </div>
  )
}

export default HistorialPagos
