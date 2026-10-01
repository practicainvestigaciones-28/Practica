import { useEffect, useState } from 'react'
import { Upload, Check, X as XIcon, Download, Save, XCircle } from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import { useAuth } from '../../auth/context/AuthContext'
import * as usuariosApi from '../../usuarios/api/usuarios'
import * as pagosApi from '../api/pagos'
import { TIPOS_DOCUMENTO_COLOMBIA } from '../../proyectos/lib/ubicaciones'
import { ApiError } from '../../../shared/api/client'
import './InformacionPagos.css'

const TIPOS_CUENTA = [
  { value: 'ahorros', label: 'Ahorros' },
  { value: 'corriente', label: 'Corriente' },
]

const DOCUMENTOS: { tipo: pagosApi.TipoDocumentoPago; label: string }[] = [
  { tipo: 'rut', label: 'RUT actualizado' },
  { tipo: 'certificacion_bancaria', label: 'Certificación bancaria' },
  { tipo: 'cedula', label: 'Copia de cédula de ciudadanía' },
]

interface CampoDocumentoProps {
  label: string
  tieneArchivo: boolean
  subiendo: boolean
  onSeleccionar: (archivo: File) => void
  onDescargar: () => void
}

function CampoDocumento({ label, tieneArchivo, subiendo, onSeleccionar, onDescargar }: CampoDocumentoProps) {
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null)
  const inputId = `pagos-doc-${label.replace(/\s+/g, '-')}`

  return (
    <div className="pagos-doc-field">
      <label>{label}</label>
      <div className="pagos-doc-box">
        <label htmlFor={inputId} className="pagos-doc-selector">
          <Upload size={14} />
          <span>{archivoPendiente?.name ?? (tieneArchivo ? 'Archivo cargado' : 'Selecciona el archivo...')}</span>
        </label>
        <input
          id={inputId}
          type="file"
          className="pagos-doc-input-oculto"
          onChange={(e) => setArchivoPendiente(e.target.files?.[0] ?? null)}
        />

        {archivoPendiente ? (
          <>
            <button
              type="button"
              className="pagos-doc-btn pagos-doc-btn-confirmar"
              aria-label="Subir archivo"
              disabled={subiendo}
              onClick={() => {
                onSeleccionar(archivoPendiente)
                setArchivoPendiente(null)
              }}
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              className="pagos-doc-btn pagos-doc-btn-cancelar"
              aria-label="Quitar selección"
              onClick={() => setArchivoPendiente(null)}
            >
              <XIcon size={14} />
            </button>
          </>
        ) : (
          tieneArchivo && (
            <button type="button" className="pagos-doc-btn pagos-doc-btn-ver" aria-label="Descargar archivo" onClick={onDescargar}>
              <Download size={14} />
            </button>
          )
        )}
      </div>
    </div>
  )
}

function InformacionPagos() {
  const { usuario } = useAuth()

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<'guardar' | 'cancelar' | null>(null)
  const [subiendoTipo, setSubiendoTipo] = useState<pagosApi.TipoDocumentoPago | null>(null)

  const [tipoDocumento, setTipoDocumento] = useState('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [telefono, setTelefono] = useState('')

  const [banco, setBanco] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState('ahorros')
  const [numeroCuenta, setNumeroCuenta] = useState('')

  const [datosBancarios, setDatosBancarios] = useState<pagosApi.DatosBancarios | null>(null)

  const cargarTodo = () => {
    if (!usuario) return
    setCargando(true)
    setError('')
    Promise.all([
      usuariosApi.obtenerHojaVida(usuario.id_usuario).catch(() => null),
      pagosApi.obtenerMisDatosBancarios(),
    ])
      .then(([hv, { datos }]) => {
        setTipoDocumento(hv?.tipo_documento ?? '')
        setNumeroDocumento(hv?.numero_documento ?? usuario.cedula ?? '')
        setTelefono(hv?.telefono ?? '')
        setBanco(datos?.banco ?? '')
        setTipoCuenta(datos?.tipo_cuenta ?? 'ahorros')
        setNumeroCuenta(datos?.numero_cuenta ?? '')
        setDatosBancarios(datos)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la información de pagos.'))
      .finally(() => setCargando(false))
  }

  useEffect(cargarTodo, [usuario])

  const confirmarGuardar = () => {
    if (!usuario) return
    setModal(null)
    setGuardando(true)
    setError('')
    Promise.all([
      usuariosApi.guardarHojaVida(usuario.id_usuario, {
        tipo_documento: tipoDocumento || undefined,
        numero_documento: numeroDocumento || undefined,
        telefono: telefono || undefined,
      }),
      pagosApi.guardarMisDatosBancarios({
        banco: banco || undefined,
        tipo_cuenta: tipoCuenta || undefined,
        numero_cuenta: numeroCuenta || undefined,
      }),
    ])
      .then(() => cargarTodo())
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la información.'))
      .finally(() => setGuardando(false))
  }

  const confirmarCancelar = () => {
    setModal(null)
    cargarTodo()
  }

  const subirDocumento = (tipo: pagosApi.TipoDocumentoPago, archivo: File) => {
    setSubiendoTipo(tipo)
    setError('')
    pagosApi
      .subirMiDocumentoPago(tipo, archivo)
      .then(({ datos }) => setDatosBancarios(datos))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo subir el documento.'))
      .finally(() => setSubiendoTipo(null))
  }

  const descargarDocumento = (tipo: pagosApi.TipoDocumentoPago, label: string) => {
    pagosApi.descargarMiDocumentoPago(tipo, label).catch(() => setError('No se pudo descargar el documento.'))
  }

  const tieneArchivo = (tipo: pagosApi.TipoDocumentoPago): boolean => {
    if (!datosBancarios) return false
    if (tipo === 'rut') return Boolean(datosBancarios.rut_path)
    if (tipo === 'certificacion_bancaria') return Boolean(datosBancarios.certificacion_bancaria_path)
    return Boolean(datosBancarios.cedula_path)
  }

  if (cargando) {
    return (
      <div className="pagos-page">
        <p className="pagos-empty">Cargando información de pagos...</p>
      </div>
    )
  }

  return (
    <div className="pagos-page">
      <div className="pagos-header-card">
        <h2>Información de pago - par evaluador</h2>
        <p>Registre la información para el proceso de pago de evaluaciones realizadas.</p>
      </div>

      {error && <p className="pagos-error">{error}</p>}

      <div className="pagos-form-card">
        <h3>1. Información personal</h3>
        <div className="pagos-campos-grid">
          <div className="pagos-campo">
            <label>Nombre Completo</label>
            <input type="text" value={usuario ? `${usuario.nombre} ${usuario.apellido}` : ''} disabled />
          </div>
          <div className="pagos-campo">
            <label>Tipo de Documento</label>
            <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
              <option value="">Selecciona un tipo de documento</option>
              {TIPOS_DOCUMENTO_COLOMBIA.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="pagos-campo">
            <label>Número de documento</label>
            <input
              type="text"
              value={numeroDocumento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              placeholder="Ingresa el número de documento"
            />
          </div>
          <div className="pagos-campo">
            <label>Correo electrónico</label>
            <input type="text" value={usuario?.correo ?? ''} disabled />
          </div>
          <div className="pagos-campo">
            <label>Número de teléfono</label>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ingresa número de teléfono"
            />
          </div>
        </div>

        <h3>2. Información tributaria</h3>
        <div className="pagos-campos-grid">
          <div className="pagos-campo">
            <label>Banco</label>
            <input type="text" value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Nombre del banco" />
          </div>
          <div className="pagos-campo">
            <label>Tipo de cuenta</label>
            <select value={tipoCuenta} onChange={(e) => setTipoCuenta(e.target.value)}>
              {TIPOS_CUENTA.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="pagos-campo">
            <label>No. Cuenta</label>
            <input type="text" value={numeroCuenta} onChange={(e) => setNumeroCuenta(e.target.value)} placeholder="Número de cuenta" />
          </div>
        </div>

        <div className="pagos-docs-grid">
          {DOCUMENTOS.map((d) => (
            <CampoDocumento
              key={d.tipo}
              label={d.label}
              tieneArchivo={tieneArchivo(d.tipo)}
              subiendo={subiendoTipo === d.tipo}
              onSeleccionar={(archivo) => subirDocumento(d.tipo, archivo)}
              onDescargar={() => descargarDocumento(d.tipo, d.label)}
            />
          ))}
        </div>

        <div className="pagos-acciones-form">
          <button type="button" className="pagos-btn-cancelar-form" onClick={() => setModal('cancelar')} disabled={guardando}>
            <XCircle size={16} />
            Cancelar
          </button>
          <button type="button" className="pagos-btn-guardar-form" onClick={() => setModal('guardar')} disabled={guardando}>
            <Save size={16} />
            {guardando ? 'Guardando...' : 'Guardar información'}
          </button>
        </div>
      </div>

      {modal === 'guardar' && (
        <ConfirmModal
          mensaje="¿Desea guardar la información?"
          botonSecundario={{ label: 'No', onClick: () => setModal(null), variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: confirmarGuardar, variante: 'rojo' }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'cancelar' && (
        <ConfirmModal
          mensaje="¿Desea cancelar el proceso?"
          botonSecundario={{ label: 'No', onClick: () => setModal(null), variante: 'azul' }}
          botonPrimario={{ label: 'Sí', onClick: confirmarCancelar, variante: 'rojo' }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

export default InformacionPagos
