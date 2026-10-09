import { useEffect, useState } from 'react'
import { Upload, Check, X as XIcon, Download, Save, XCircle, SquarePen } from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import { useAuth } from '../../auth/context/AuthContext'
import * as usuariosApi from '../../usuarios/api/usuarios'
import * as pagosApi from '../api/pagos'
import { TIPOS_DOCUMENTO_COLOMBIA } from '../../proyectos/lib/ubicaciones'
import { ApiError } from '../../../shared/api/client'
import './InformacionPagos.css'

function esArchivoPdf(archivo: File): boolean {
  return archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf')
}

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

// Los documentos tributarios se suben de forma inmediata (no dependen del
// botón "Guardar información" del resto del formulario), así que este campo
// nunca se deshabilita por el modo edición de los datos personales/bancarios
// — exigir "Editar" primero aquí solo confundía al par evaluador, que veía el
// selector de archivo bloqueado y creía que la carga no funcionaba.
function CampoDocumento({ label, tieneArchivo, subiendo, onSeleccionar, onDescargar }: CampoDocumentoProps) {
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null)
  const [errorFormato, setErrorFormato] = useState('')
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
          accept=".pdf,application/pdf"
          className="pagos-doc-input-oculto"
          onChange={(e) => {
            const archivo = e.target.files?.[0] ?? null
            if (archivo && !esArchivoPdf(archivo)) {
              setErrorFormato('Solo se permiten archivos en formato PDF.')
              setArchivoPendiente(null)
              e.target.value = ''
              return
            }
            setErrorFormato('')
            setArchivoPendiente(archivo)
          }}
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
      {errorFormato && <p className="pagos-doc-error">{errorFormato}</p>}
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
  // La información empieza bloqueada: hay que pedir "Editar" antes de poder
  // cambiar cualquier campo (personal, bancario o los documentos tributarios).
  const [editando, setEditando] = useState(false)

  const [tipoDocumento, setTipoDocumento] = useState('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [telefono, setTelefono] = useState('')

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
        setDatosBancarios(datos)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la información de pagos.'))
      .finally(() => setCargando(false))
  }

  useEffect(cargarTodo, [usuario])

  const handleActivarEdicion = () => {
    setEditando(true)
    setError('')
  }

  const handleGuardarClick = () => {
    if (!telefono.trim()) {
      setError('El número de teléfono es obligatorio.')
      return
    }
    setModal('guardar')
  }

  const confirmarGuardar = () => {
    if (!usuario) return
    setModal(null)
    setGuardando(true)
    setError('')
    usuariosApi
      .guardarHojaVida(usuario.id_usuario, {
        tipo_documento: tipoDocumento || undefined,
        numero_documento: numeroDocumento || undefined,
        telefono: telefono || undefined,
      })
      .then(() => {
        cargarTodo()
        setEditando(false)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la información.'))
      .finally(() => setGuardando(false))
  }

  const confirmarCancelar = () => {
    setModal(null)
    cargarTodo()
    setEditando(false)
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
            <select value={tipoDocumento} disabled={!editando} onChange={(e) => setTipoDocumento(e.target.value)}>
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
              readOnly={!editando}
            />
          </div>
          <div className="pagos-campo">
            <label>Correo electrónico</label>
            <input type="text" value={usuario?.correo ?? ''} disabled />
          </div>
          <div className="pagos-campo">
            <label>Número de teléfono *</label>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ingresa número de teléfono"
              readOnly={!editando}
            />
          </div>
        </div>
        <p className="pagos-campo-ayuda">* Campo obligatorio.</p>

        <h3>2. Información tributaria</h3>
        <p className="pagos-campo-ayuda">
          No hace falta registrar banco, tipo ni número de cuenta: esa información ya queda evidenciada en la certificación bancaria que se carga abajo. Estos documentos se guardan de inmediato al confirmarlos, sin necesidad de presionar "Editar" ni "Guardar información".
        </p>
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
          {editando ? (
            <>
              <button type="button" className="pagos-btn-cancelar-form" onClick={() => setModal('cancelar')} disabled={guardando}>
                <XCircle size={16} />
                Cancelar
              </button>
              <button type="button" className="pagos-btn-guardar-form" onClick={handleGuardarClick} disabled={guardando}>
                <Save size={16} />
                {guardando ? 'Guardando...' : 'Guardar información'}
              </button>
            </>
          ) : (
            <button type="button" className="pagos-btn-guardar-form" onClick={handleActivarEdicion}>
              <SquarePen size={16} />
              Editar
            </button>
          )}
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
