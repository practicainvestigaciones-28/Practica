import { useEffect, useState } from 'react'
import { ArrowLeft, Download, Eye, Search, Upload } from 'lucide-react'
import * as pagosApi from '../api/pagos'
import { ApiError } from '../../../shared/api/client'
import './PagosPares.css'

const DOCUMENTOS: { tipo: pagosApi.TipoDocumentoPago; label: string }[] = [
  { tipo: 'rut', label: 'RUT actualizado' },
  { tipo: 'certificacion_bancaria', label: 'Certificación bancaria' },
  { tipo: 'cedula', label: 'Copia de cédula de ciudadanía' },
]

function formatearValor(valor: number | string | null): string {
  // El backend serializa valor_pago (Decimal de Prisma) como texto — se
  // fuerza a número acá para que siempre salga con separador de miles.
  if (valor === null) return '—'
  return `$${Number(valor).toLocaleString('es-CO')}`
}

function PagosPares() {
  const [pares, setPares] = useState<pagosApi.ParPagoResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [parAbierto, setParAbierto] = useState<pagosApi.ParPagoResumen | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [datosBancarios, setDatosBancarios] = useState<pagosApi.DatosBancarios | null>(null)
  const [evaluaciones, setEvaluaciones] = useState<pagosApi.HistorialPagoItem[]>([])
  const [montos, setMontos] = useState<Record<number, string>>({})
  const [registrando, setRegistrando] = useState<number | null>(null)
  const [subiendoComprobante, setSubiendoComprobante] = useState<number | null>(null)

  const cargarLista = () => {
    setCargando(true)
    setError('')
    pagosApi
      .listarParesConPagos()
      .then(({ pares }) => setPares(pares))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de pares.'))
      .finally(() => setCargando(false))
  }

  useEffect(cargarLista, [])

  const cargarDetalle = (par: pagosApi.ParPagoResumen) => {
    setCargandoDetalle(true)
    setError('')
    Promise.all([pagosApi.obtenerDatosBancariosDePar(par.id_usuario), pagosApi.listarEvaluacionesDePar(par.id_usuario)])
      .then(([{ datos }, { historial }]) => {
        setDatosBancarios(datos)
        setEvaluaciones(historial)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la información del par.'))
      .finally(() => setCargandoDetalle(false))
  }

  const abrirPar = (par: pagosApi.ParPagoResumen) => {
    setParAbierto(par)
    cargarDetalle(par)
  }

  const volver = () => {
    setParAbierto(null)
    cargarLista()
  }

  const tieneArchivo = (tipo: pagosApi.TipoDocumentoPago): boolean => {
    if (!datosBancarios) return false
    if (tipo === 'rut') return Boolean(datosBancarios.rut_path)
    if (tipo === 'certificacion_bancaria') return Boolean(datosBancarios.certificacion_bancaria_path)
    return Boolean(datosBancarios.cedula_path)
  }

  const handleVerDocumento = (tipo: pagosApi.TipoDocumentoPago) => {
    if (!parAbierto) return
    pagosApi.verDocumentoDePar(parAbierto.id_usuario, tipo).catch(() => setError('No se pudo abrir el documento.'))
  }

  const handleDescargarDocumento = (tipo: pagosApi.TipoDocumentoPago, label: string) => {
    if (!parAbierto) return
    pagosApi.descargarDocumentoDePar(parAbierto.id_usuario, tipo, label).catch(() => setError('No se pudo descargar el documento.'))
  }

  const handleRegistrarPago = (item: pagosApi.HistorialPagoItem) => {
    const valor = Number(montos[item.id_evaluacion])
    if (!valor || valor <= 0) {
      setError('Ingresa un valor de pago válido.')
      return
    }
    setError('')
    setRegistrando(item.id_evaluacion)
    pagosApi
      .registrarPago(item.id_evaluacion, valor)
      .then(() => parAbierto && cargarDetalle(parAbierto))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo registrar el pago.'))
      .finally(() => setRegistrando(null))
  }

  const handleSubirComprobante = (item: pagosApi.HistorialPagoItem, archivo: File) => {
    if (item.id_pago === null) return
    setError('')
    setSubiendoComprobante(item.id_pago)
    pagosApi
      .subirComprobantePago(item.id_pago, archivo)
      .then(() => parAbierto && cargarDetalle(parAbierto))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo subir el comprobante.'))
      .finally(() => setSubiendoComprobante(null))
  }

  const handleDescargarComprobante = (item: pagosApi.HistorialPagoItem) => {
    if (item.id_pago === null) return
    pagosApi
      .descargarComprobanteAdmin(item.id_pago, `comprobante-${item.proyecto.titulo}`)
      .catch(() => setError('No se pudo descargar el comprobante.'))
  }

  const paresFiltrados = pares.filter((p) =>
    [p.nombre, p.apellido, p.correo].some((campo) => campo.toLowerCase().includes(busqueda.toLowerCase()))
  )

  if (parAbierto) {
    return (
      <div className="pp-page">
        <button type="button" className="pp-volver" onClick={volver}>
          <ArrowLeft size={16} />
          Volver a la lista
        </button>

        <div className="pp-header-card">
          <h2>{parAbierto.nombre} {parAbierto.apellido}</h2>
          <p>{parAbierto.correo}</p>
        </div>

        {error && <p className="pp-error">{error}</p>}

        {cargandoDetalle ? (
          <p className="pp-empty">Cargando información...</p>
        ) : (
          <>
            <div className="pp-card">
              <h3>Documentos tributarios</h3>
              <div className="pp-docs-grid">
                {DOCUMENTOS.map((d) => (
                  <div className="pp-doc-field" key={d.tipo}>
                    <span className="pp-doc-label">{d.label}</span>
                    {tieneArchivo(d.tipo) ? (
                      <div className="pp-doc-acciones">
                        <button type="button" className="pp-doc-btn-ver" onClick={() => handleVerDocumento(d.tipo)}>
                          <Eye size={14} />
                          Ver
                        </button>
                        <button
                          type="button"
                          className="pp-doc-btn-descargar"
                          aria-label="Descargar"
                          title="Descargar"
                          onClick={() => handleDescargarDocumento(d.tipo, d.label)}
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="pp-doc-faltante">Este archivo no ha sido cargado.</span>
                    )}
                  </div>
                ))}
              </div>
              {!parAbierto.documentos_completos && (
                <p className="pp-aviso">
                  Mientras falte alguno de los 3 documentos no se puede registrar ningún pago a este par.
                </p>
              )}
            </div>

            <div className="pp-card">
              <h3>Evaluaciones de Pares y pagos</h3>
              <div className="pp-tabla-wrapper">
                <table className="pp-tabla">
                  <thead>
                    <tr>
                      <th>Proyecto</th>
                      <th>Valor</th>
                      <th>Estado</th>
                      <th>Comprobante</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluaciones.length === 0 && (
                      <tr>
                        <td colSpan={5} className="pp-empty">Este par todavía no ha evaluado ningún proyecto.</td>
                      </tr>
                    )}
                    {evaluaciones.map((item) => (
                      <tr key={item.id_evaluacion}>
                        <td>{item.proyecto.titulo}</td>
                        <td>
                          {item.pagado ? (
                            formatearValor(item.valor_pago)
                          ) : (
                            <input
                              type="number"
                              min={0}
                              className="pp-input-valor"
                              placeholder="Valor"
                              value={montos[item.id_evaluacion] ?? ''}
                              onChange={(e) => setMontos((m) => ({ ...m, [item.id_evaluacion]: e.target.value }))}
                              disabled={!parAbierto.documentos_completos}
                            />
                          )}
                        </td>
                        <td>
                          <span className={`pp-estado-badge ${item.pagado ? 'pp-estado-pagado' : 'pp-estado-pendiente'}`}>
                            {item.pagado ? 'Pagado' : 'Pendiente'}
                          </span>
                        </td>
                        <td>
                          {item.tiene_comprobante ? (
                            <button type="button" className="pp-link-btn" onClick={() => handleDescargarComprobante(item)}>
                              Ver comprobante
                            </button>
                          ) : item.pagado && item.id_pago !== null ? (
                            <label className="pp-subir-comprobante">
                              <Upload size={13} />
                              {subiendoComprobante === item.id_pago ? 'Subiendo...' : 'Subir comprobante'}
                              <input
                                type="file"
                                accept=".pdf,application/pdf,image/*"
                                className="pp-input-oculto"
                                onChange={(e) => {
                                  const archivo = e.target.files?.[0]
                                  if (archivo) handleSubirComprobante(item, archivo)
                                }}
                              />
                            </label>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {!item.pagado && (
                            <button
                              type="button"
                              className="pp-btn-registrar"
                              disabled={registrando === item.id_evaluacion || !parAbierto.documentos_completos}
                              title={
                                !parAbierto.documentos_completos
                                  ? 'El par debe completar sus 3 documentos tributarios antes de poder pagarle'
                                  : undefined
                              }
                              onClick={() => handleRegistrarPago(item)}
                            >
                              {registrando === item.id_evaluacion ? 'Registrando...' : 'Registrar pago'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="pp-page">
      <div className="pp-header-card">
        <h2>Pagos a pares</h2>
        <p>Consulta los documentos tributarios de cada par evaluador y registra el pago según los proyectos que haya evaluado.</p>
      </div>

      {error && <p className="pp-error">{error}</p>}

      <div className="pp-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Busca por nombre o correo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="pp-tabla-wrapper">
        <table className="pp-tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Proyectos evaluados</th>
              <th>Pagos</th>
              <th>Documentos</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={5} className="pp-empty">Cargando pares evaluadores...</td>
              </tr>
            )}
            {!cargando && paresFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} className="pp-empty">No hay pares evaluadores registrados.</td>
              </tr>
            )}
            {!cargando &&
              paresFiltrados.map((par) => (
                <tr key={par.id_usuario} className="pp-fila-clickable" onClick={() => abrirPar(par)}>
                  <td>{par.nombre} {par.apellido}</td>
                  <td>{par.correo}</td>
                  <td>{par.proyectos_evaluados}</td>
                  <td>
                    {par.pagos_pendientes > 0 ? (
                      <span className="pp-estado-badge pp-estado-pendiente">
                        {par.pagos_pendientes} pendiente{par.pagos_pendientes === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="pp-estado-badge pp-estado-pagado">Al día</span>
                    )}
                  </td>
                  <td>
                    <span className={`pp-estado-badge ${par.documentos_completos ? 'pp-estado-pagado' : 'pp-estado-pendiente'}`}>
                      {par.documentos_completos ? 'Completos' : 'Incompletos'}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PagosPares
