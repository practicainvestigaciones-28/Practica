import { useState } from 'react'
import { Download, ExternalLink, Eye, File, FileImage, FileSpreadsheet, FileText, Link2, Plus, X } from 'lucide-react'
import { getRolesEfectivos } from '../../auth/lib/auth'
import type { Evidencia } from '../api/tipos'
import { descargarEvidencia, esEnlaceValido, etiquetaEvidencia, formatoTamano, guardarArchivoEvidencia, verEvidencia } from '../lib/archivos'

interface Props {
  evidencias: Evidencia[]
  /** Con `editable` el investigador agrega y quita evidencias; sin él solo se consultan y se descargan. */
  editable?: boolean
  onAgregar?: (ev: Evidencia) => void
  onQuitar?: (indice: number) => void
}

/** Icono y color según el tipo de archivo adjunto: PDF, imagen, hoja de cálculo, documento u otro. */
function iconoDeArchivo(nombre: string, mime: string) {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? ''
  if (mime === 'application/pdf' || ext === 'pdf') return <FileText size={18} className="seg-evid-icono seg-evid-pdf" aria-label="PDF" />
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return <FileImage size={18} className="seg-evid-icono seg-evid-img" aria-label="Imagen" />
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={18} className="seg-evid-icono seg-evid-xls" aria-label="Hoja de cálculo" />
  if (['doc', 'docx', 'ppt', 'pptx', 'odt', 'txt'].includes(ext)) return <FileText size={18} className="seg-evid-icono seg-evid-doc" aria-label="Documento" />
  return <File size={18} className="seg-evid-icono" aria-label="Archivo" />
}

/** Evidencias y soportes: cada uno es un archivo adjunto o un enlace. El investigador solo los sube (ve el nombre para
 * poder quitarlos); únicamente el Administrador puede abrirlos, verlos y descargarlos. */
export function Evidencias({ evidencias, editable = false, onAgregar, onQuitar }: Props) {
  const puedeAbrir = getRolesEfectivos().includes('administrador')
  const [error, setError] = useState('')
  const [pidiendoEnlace, setPidiendoEnlace] = useState(false)
  const [enlace, setEnlace] = useState('')

  const intentar = async (accion: () => Promise<void>) => {
    setError('')
    try {
      await accion()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la acción.')
    }
  }

  const adjuntar = (archivo: File | undefined) => {
    if (archivo) void intentar(async () => onAgregar?.(await guardarArchivoEvidencia(archivo)))
  }

  const agregarEnlace = () => {
    if (!esEnlaceValido(enlace)) {
      setError('Escribe un enlace válido que empiece por http:// o https://')
      return
    }
    setError('')
    onAgregar?.({ tipo: 'enlace', url: enlace.trim() })
    setEnlace('')
    setPidiendoEnlace(false)
  }

  return (
    <div className="seg-evidencias">
      {evidencias.map((ev, k) => (
        <div key={k} className="seg-evidencia">
          {ev.tipo === 'enlace' ? <Link2 size={18} className="seg-evid-icono seg-evid-enlace" aria-label="Enlace" /> : iconoDeArchivo(ev.nombre, ev.mime)}
          <span className="seg-evidencia-nombre" title={etiquetaEvidencia(ev)}>{etiquetaEvidencia(ev)}</span>
          {ev.tipo === 'archivo' && ev.tamano > 0 && <small>({formatoTamano(ev.tamano)})</small>}
          {ev.tipo === 'archivo' && !ev.id ? (
            <small title="Esta evidencia se registró antes de que se guardaran los archivos: solo quedó el nombre. El investigador puede quitarla y volver a adjuntarla.">(solo el nombre: el archivo no se guardó)</small>
          ) : !puedeAbrir ? null : ev.tipo === 'enlace' ? (
            <button type="button" className="seg-link" aria-label={`Abrir enlace ${ev.url}`} onClick={() => intentar(() => verEvidencia(ev))}>
              <ExternalLink size={12} /> Abrir
            </button>
          ) : (
            <>
              <button type="button" className="seg-link" aria-label={`Ver ${ev.nombre}`} onClick={() => intentar(() => verEvidencia(ev))}>
                <Eye size={12} /> Ver
              </button>
              <button type="button" className="seg-link" aria-label={`Descargar ${ev.nombre}`} onClick={() => intentar(() => descargarEvidencia(ev))}>
                <Download size={12} /> Descargar
              </button>
            </>
          )}
          {editable && (
            <button type="button" className="seg-icono" aria-label="Quitar evidencia" onClick={() => onQuitar?.(k)}>
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      {!editable && evidencias.length === 0 && '—'}
      {editable && (
        <div className="seg-evidencias-acciones">
          <label className="seg-adjuntar">
            <Plus size={12} /> Adjuntar archivo
            <input type="file" accept="*/*" onChange={(e) => { adjuntar(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {!pidiendoEnlace && (
            <button type="button" className="seg-link" onClick={() => setPidiendoEnlace(true)}>
              <Link2 size={12} /> Agregar enlace
            </button>
          )}
        </div>
      )}
      {editable && pidiendoEnlace && (
        <div className="seg-evidencia-enlace">
          <input
            type="url"
            placeholder="https://…"
            aria-label="Enlace de la evidencia"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarEnlace() } }}
          />
          <button type="button" className="seg-btn seg-btn-sm" onClick={agregarEnlace}>Agregar</button>
          <button type="button" className="seg-btn seg-btn-sm seg-btn-borde" onClick={() => { setPidiendoEnlace(false); setEnlace(''); setError('') }}>Cancelar</button>
        </div>
      )}
      {error && <span className="seg-error-campo">{error}</span>}
    </div>
  )
}
