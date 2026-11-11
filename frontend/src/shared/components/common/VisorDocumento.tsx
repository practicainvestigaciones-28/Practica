import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, Loader2, X } from 'lucide-react'
import { EVENTO_ABRIR_VISOR, type DetalleVisor } from '../../lib/visorDocumento'
import { descargarBlobComoArchivo } from '../../api/client'
import './VisorDocumento.css'

/** Dibuja cada página del PDF en un canvas (con pdf.js, que se carga solo al abrir el primer PDF). */
async function dibujarPaginas(blob: Blob, contenedor: HTMLDivElement, cancelado: () => boolean): Promise<void> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const documento = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  const ancho = Math.max(320, contenedor.clientWidth - 32)
  const nitidez = Math.min(window.devicePixelRatio || 1, 2)

  for (let n = 1; n <= documento.numPages; n++) {
    if (cancelado()) break
    const pagina = await documento.getPage(n)
    const base = pagina.getViewport({ scale: 1 })
    const viewport = pagina.getViewport({ scale: (ancho / base.width) * nitidez })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = `${ancho}px`
    canvas.className = 'vd-pagina'
    contenedor.appendChild(canvas)
    await pagina.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
  }
  await documento.destroy()
}

/** Ventana con el documento abierto: PDF (todas sus páginas) o imagen; cualquier otro tipo se descarga. */
function VisorDocumento() {
  const [doc, setDoc] = useState<DetalleVisor | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [urlImagen, setUrlImagen] = useState('')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [descargandoExtra, setDescargandoExtra] = useState(false)

  useEffect(() => {
    const alAbrir = (e: Event) => setDoc((e as CustomEvent<DetalleVisor>).detail)
    window.addEventListener(EVENTO_ABRIR_VISOR, alAbrir)
    return () => window.removeEventListener(EVENTO_ABRIR_VISOR, alAbrir)
  }, [])

  useEffect(() => {
    if (!doc) return
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setDoc(null)
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [doc])

  useEffect(() => {
    if (!doc) return
    setError('')
    setUrlImagen('')
    setMenuAbierto(false)
    const esPdf = doc.blob.type === 'application/pdf' || /\.pdf$/i.test(doc.nombre)
    const esImagen = doc.blob.type.startsWith('image/')

    if (esImagen) {
      const url = URL.createObjectURL(doc.blob)
      setUrlImagen(url)
      return () => URL.revokeObjectURL(url)
    }
    if (!esPdf) {
      // Word, Excel y demás no se pueden mostrar aquí: se descargan.
      descargarBlobComoArchivo(doc.blob, doc.nombre)
      setDoc(null)
      return
    }

    let cancelado = false
    setCargando(true)
    const contenedor = contenedorRef.current
    if (contenedor) contenedor.innerHTML = ''
    dibujarPaginas(doc.blob, contenedor as HTMLDivElement, () => cancelado)
      .catch(() => !cancelado && setError('No se pudo mostrar el documento. Puedes descargarlo con el botón de arriba.'))
      .finally(() => !cancelado && setCargando(false))
    return () => {
      cancelado = true
    }
  }, [doc])

  if (!doc) return null

  return (
    <div className="vd-overlay" role="dialog" aria-modal="true" aria-label={`Documento ${doc.nombre}`} onClick={() => setDoc(null)}>
      <div className="vd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="vd-barra">
          <span className="vd-nombre" title={doc.nombre}>
            {doc.nombre}
          </span>
          <div className="vd-descarga">
            <button
              type="button"
              className="vd-boton"
              disabled={descargandoExtra}
              onClick={() => (doc.descargasAdicionales?.length ? setMenuAbierto((v) => !v) : descargarBlobComoArchivo(doc.blob, doc.nombre))}
            >
              <Download size={14} />
              {descargandoExtra ? 'Generando...' : 'Descargar'}
              {doc.descargasAdicionales?.length ? <ChevronDown size={13} /> : null}
            </button>
            {menuAbierto && doc.descargasAdicionales?.length ? (
              <div className="vd-menu">
                <button
                  type="button"
                  onClick={() => {
                    setMenuAbierto(false)
                    descargarBlobComoArchivo(doc.blob, doc.nombre)
                  }}
                >
                  PDF (.pdf)
                </button>
                {doc.descargasAdicionales.map((d) => (
                  <button
                    type="button"
                    key={d.etiqueta}
                    onClick={() => {
                      setMenuAbierto(false)
                      setDescargandoExtra(true)
                      Promise.resolve(d.accion()).finally(() => setDescargandoExtra(false))
                    }}
                  >
                    {d.etiqueta}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" className="vd-cerrar" onClick={() => setDoc(null)} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="vd-contenido">
          {urlImagen ? <img src={urlImagen} alt={doc.nombre} className="vd-imagen" /> : <div ref={contenedorRef} className="vd-paginas" />}
          {cargando && (
            <p className="vd-estado">
              <Loader2 size={16} className="vd-girando" /> Abriendo el documento...
            </p>
          )}
          {error && <p className="vd-error">{error}</p>}
        </div>
      </div>
    </div>
  )
}

export default VisorDocumento
