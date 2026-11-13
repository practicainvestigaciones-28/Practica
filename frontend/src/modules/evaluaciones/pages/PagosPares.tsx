import { useEffect, useState } from 'react'
import { ArrowLeft, Eye, Search, Upload, Send, CheckCircle2 } from 'lucide-react'
import * as pagosApi from '../api/pagos'
import { verPdfCalificacionPar } from '../lib/pdfCalificacionPar'
import Paginacion from '../../../shared/components/common/Paginacion'
import { paginar } from '../../../shared/lib/paginar'
import { ApiError } from '../../../shared/api/client'
import { useCambios } from '../../../shared/realtime/RealtimeContext'
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

/** Formatea lo que el administrador va tecleando como pesos colombianos ($1.234.567), sin decimales. */
function formatearValorEntrada(soloDigitos: string): string {
  if (!soloDigitos) return ''
  return `$${Number(soloDigitos).toLocaleString('es-CO')}`
}

function PagosPares() {
  const [pares, setPares] = useState<pagosApi.ParPagoResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  // La lista de pares va de a 10 por página.
  const [paginaPares, setPaginaPares] = useState(1)
  useEffect(() => setPaginaPares(1), [busqueda])

  const [parAbierto, setParAbierto] = useState<pagosApi.ParPagoResumen | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [datosBancarios, setDatosBancarios] = useState<pagosApi.DatosBancarios | null>(null)
  const [evaluaciones, setEvaluaciones] = useState<pagosApi.HistorialPagoItem[]>([])
  const [montos, setMontos] = useState<Record<number, string>>({})
  const [registrando, setRegistrando] = useState<number | null>(null)
  const [subiendoCertificado, setSubiendoCertificado] = useState<number | null>(null)
  const [enviandoAgradecimiento, setEnviandoAgradecimiento] = useState<number | null>(null)

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

  useCambios('pagos', cargarLista)

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

  const handleCambiarMonto = (id_evaluacion: number, valorTecleado: string) => {
    const soloDigitos = valorTecleado.replace(/\D/g, '')
    setMontos((m) => ({ ...m, [id_evaluacion]: soloDigitos }))
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

  const handleSubirCertificado = (id_pago: number, archivo: File) => {
    setError('')
    setSubiendoCertificado(id_pago)
    pagosApi
      .subirCertificadoPago(id_pago, archivo)
      .then(() => parAbierto && cargarDetalle(parAbierto))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo subir el certificado.'))
      .finally(() => setSubiendoCertificado(null))
  }

  const handleDescargarCertificado = (id_pago: number, convocatoria: string) => {
    pagosApi
      .descargarCertificadoPago(id_pago, `certificado-convocatoria-${convocatoria}`)
      .catch(() => setError('No se pudo descargar el certificado.'))
  }

  const handleEnviarAgradecimiento = (id_pago: number) => {
    setError('')
    setEnviandoAgradecimiento(id_pago)
    pagosApi
      .enviarAgradecimientoPago(id_pago)
      .then(() => parAbierto && cargarDetalle(parAbierto))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo enviar el correo de agradecimiento.'))
      .finally(() => setEnviandoAgradecimiento(null))
  }

  const paresFiltrados = pares.filter((p) =>
    [p.nombre, p.apellido, p.correo].some((campo) => campo.toLowerCase().includes(busqueda.toLowerCase()))
  )
  const paresPaginados = paginar(paresFiltrados, paginaPares)
  // Las evaluaciones del par agrupadas por la convocatoria de su proyecto (en el orden en que aparecen).
  const gruposPorConvocatoria = evaluaciones.reduce<{ id_convocatoria: number; nombre: string; items: pagosApi.HistorialPagoItem[] }[]>((grupos, item) => {
    const { id_convocatoria, nombre } = item.proyecto.convocatoria
    const existente = grupos.find((g) => g.id_convocatoria === id_convocatoria)
    if (existente) existente.items.push(item)
    else grupos.push({ id_convocatoria, nombre, items: [item] })
    return grupos
  }, [])

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
              {evaluaciones.length === 0 && <p className="pp-empty">Este par todavía no ha evaluado ningún proyecto.</p>}
              {/* Un bloque por convocatoria: cada proyecto tiene su pago, pero el certificado de participación es uno solo por convocatoria. */}
              {gruposPorConvocatoria.map((grupo) => {
                const conPago = grupo.items.filter((i) => i.id_pago !== null)
                const idPagoGrupo = conPago[0]?.id_pago ?? null
                const tieneCertificado = grupo.items.some((i) => i.tiene_certificado)
                const todosConPago = conPago.length === grupo.items.length
                const agradecimientoEnviado = todosConPago && grupo.items.every((i) => i.agradecimiento_enviado)
                return (
                  <div className="pp-grupo" key={grupo.id_convocatoria}>
                    <h4 className="pp-grupo-titulo">Convocatoria {grupo.nombre}</h4>
                    <div className="pp-tabla-wrapper">
                      <table className="pp-tabla pp-tabla-proyectos">
                        <thead>
                          <tr>
                            <th>Proyectos</th>
                            <th>Valor</th>
                            <th>Estado</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.items.map((item) => (
                            <tr key={item.id_evaluacion}>
                              <td>
                                <span className="pp-titulo-proyecto" title={item.proyecto.titulo}>{item.proyecto.titulo}</span>
                                <div className="pp-calificacion-acciones">
                                  <span>Calificación firmada:</span>
                                  <button
                                    type="button"
                                    className="pp-link-btn pp-calificacion-btn"
                                    onClick={() =>
                                      verPdfCalificacionPar(item.id_evaluacion).catch((err) =>
                                        setError(err instanceof ApiError ? err.message : 'No se pudo abrir el PDF de la calificación.')
                                      )
                                    }
                                  >
                                    <Eye size={12} />
                                    Ver
                                  </button>
                                </div>
                              </td>
                              <td>
                                {item.id_pago !== null ? (
                                  formatearValor(item.valor_pago)
                                ) : (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="pp-input-valor"
                                    placeholder="$0"
                                    value={formatearValorEntrada(montos[item.id_evaluacion] ?? '')}
                                    onChange={(e) => handleCambiarMonto(item.id_evaluacion, e.target.value)}
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
                                {item.id_pago === null && (
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

                    <div className="pp-grupo-certificado">
                      <span className="pp-grupo-certificado-titulo">
                        Certificado de participación
                      </span>
                      <div className="pp-grupo-certificado-acciones">
                        {tieneCertificado && idPagoGrupo !== null ? (
                          <button type="button" className="pp-link-btn" onClick={() => handleDescargarCertificado(idPagoGrupo, grupo.nombre)}>
                            Ver certificado
                          </button>
                        ) : idPagoGrupo !== null ? (
                          <label className="pp-subir-comprobante">
                            <Upload size={13} />
                            {subiendoCertificado === idPagoGrupo ? 'Subiendo...' : 'Subir certificado'}
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              className="pp-input-oculto"
                              onChange={(e) => {
                                const archivo = e.target.files?.[0]
                                if (archivo) handleSubirCertificado(idPagoGrupo, archivo)
                              }}
                            />
                          </label>
                        ) : (
                          <span className="pp-grupo-nota">Registra al menos un pago para poder subir el certificado.</span>
                        )}

                        {agradecimientoEnviado ? (
                          <span className="pp-agradecimiento-enviado">
                            <CheckCircle2 size={14} />
                            Agradecimiento enviado
                          </span>
                        ) : (
                          idPagoGrupo !== null && (
                            <button
                              type="button"
                              className="pp-btn-agradecimiento"
                              disabled={enviandoAgradecimiento === idPagoGrupo || !tieneCertificado || !todosConPago}
                              title={
                                !tieneCertificado
                                  ? 'Primero carga el certificado de participación'
                                  : !todosConPago
                                    ? 'Registra el pago de todos los proyectos de esta convocatoria: el certificado los agrupa a todos'
                                    : undefined
                              }
                              onClick={() => handleEnviarAgradecimiento(idPagoGrupo)}
                            >
                              <Send size={13} />
                              {enviandoAgradecimiento === idPagoGrupo ? 'Enviando...' : 'Enviar agradecimiento'}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
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
              paresPaginados.visibles.map((par) => (
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

      <Paginacion pagina={paresPaginados.pagina} totalPaginas={paresPaginados.totalPaginas} onCambiar={setPaginaPares} />
    </div>
  )
}

export default PagosPares
