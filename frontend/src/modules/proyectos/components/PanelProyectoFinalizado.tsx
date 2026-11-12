import { FileText, Loader2, Save } from 'lucide-react'
import CampoFecha from '../../../shared/components/common/CampoFecha'
import type { SeguimientoFinalizadoForm } from '../lib/seguimientoFinalizado'
import type { CategoriaProductoLocal } from '../lib/productosInvestigacion'
import './PanelProyectoFinalizado.css'

interface PanelProyectoFinalizadoProps {
  valor: SeguimientoFinalizadoForm
  onCambiar: (cambios: Partial<SeguimientoFinalizadoForm>) => void
  /** PDF anexados que se guardan como originales, para que se vea qué se va a conservar. */
  documentos: { etiqueta: string; nombre: string }[]
  /** Catálogo de productos y lo que se obtuvo de cada uno (por id del tipo de producto en el sistema). */
  categoriasProducto: CategoriaProductoLocal[]
  productosObtenidos: Record<number, number>
  onCambiarProductoObtenido: (idTipoProducto: number, cantidad: number) => void
  error: string
  guardando: boolean
  onGuardar: () => void
}

/**
 * Último paso de un proyecto finalizado (en lugar de las firmas): los datos de su acta de inicio, informe final y acta de
 * cierre, ya llenos con lo leído de los PDF, para revisarlos y corregirlos antes de guardar.
 */
function PanelProyectoFinalizado({
  valor,
  onCambiar,
  documentos,
  categoriasProducto,
  productosObtenidos,
  onCambiarProductoObtenido,
  error,
  guardando,
  onGuardar,
}: PanelProyectoFinalizadoProps) {
  const totalObtenidos = Object.values(productosObtenidos).reduce((a, n) => a + n, 0)
  const texto = (etiqueta: string, campo: keyof SeguimientoFinalizadoForm, ancho?: string) => (
    <label className="ppf-campo" style={ancho ? { maxWidth: ancho } : undefined}>
      <span>{etiqueta}</span>
      <input type="text" value={valor[campo]} onChange={(e) => onCambiar({ [campo]: e.target.value })} />
    </label>
  )
  const fecha = (etiqueta: string, campo: keyof SeguimientoFinalizadoForm) => (
    <label className="ppf-campo">
      <span>{etiqueta}</span>
      <CampoFecha value={valor[campo]} onChange={(v) => onCambiar({ [campo]: v })} />
    </label>
  )

  return (
    <div className="cp-section">
      <div className="cp-section-header">PROYECTO FINALIZADO</div>
      <p className="ppf-intro">
        Este proyecto se guarda ya terminado, sin firmas ni evaluación. Revisa los datos de su acta de inicio, su informe final y
        su acta de cierre (los que se leyeron de los PDF están llenos) y corrige lo que haga falta.
      </p>

      <h4 className="ppf-sub">Acta de inicio</h4>
      <div className="ppf-fila">
        {texto('Acta No.', 'numeroActa')}
        {fecha('Fecha del acta', 'fechaActa')}
        {texto('Centro de costos', 'centroCostos')}
      </div>
      <div className="ppf-fila">
        {fecha('Fecha de inicio *', 'fechaInicio')}
        {texto('Duración en meses *', 'duracionMeses', '160px')}
        {texto('Tipo de proyecto', 'tipoProyecto')}
      </div>

      <h4 className="ppf-sub">Informe final</h4>
      <div className="ppf-fila">{fecha('Fecha de entrega', 'fechaEntregaFinal')}</div>
      <label className="ppf-campo">
        <span>Resumen de la ejecución</span>
        <textarea rows={3} value={valor.resumenEjecucion} onChange={(e) => onCambiar({ resumenEjecucion: e.target.value })} />
      </label>
      <label className="ppf-campo">
        <span>Observaciones sobre los objetivos</span>
        <textarea rows={2} value={valor.observacionesObjetivos} onChange={(e) => onCambiar({ observacionesObjetivos: e.target.value })} />
      </label>

      <h4 className="ppf-sub">Acta de cierre</h4>
      <div className="ppf-fila">
        {fecha('Fecha de finalización', 'fechaFinalizacion')}
        {texto('Ciudad de la firma', 'ciudadFirma')}
        {fecha('Fecha del acta de cierre', 'fechaActaCierre')}
      </div>

      <h4 className="ppf-sub">Productos obtenidos</h4>
      <p className="ppf-intro">
        Escribe cuántos productos se obtuvieron de cada tipo (están en el acta de cierre y en el informe final). Deja vacío lo que no
        se obtuvo.{totalObtenidos > 0 ? ` Llevas ${totalObtenidos} en total.` : ''}
      </p>
      {categoriasProducto.map((cat) => {
        const tipos = cat.subcategorias.flatMap((sub) => sub.tipos.filter((t) => t.idReal !== null).map((t) => ({ sub: sub.nombre, tipo: t })))
        if (tipos.length === 0) return null
        const conDatos = tipos.filter(({ tipo }) => (productosObtenidos[tipo.idReal as number] ?? 0) > 0).length
        return (
          <details className="ppf-categoria" key={cat.id}>
            <summary>
              {cat.nombre}
              {conDatos > 0 && <span className="ppf-categoria-cuenta">{conDatos}</span>}
            </summary>
            <div className="ppf-productos">
              {tipos.map(({ sub, tipo }) => (
                <label className="ppf-producto" key={tipo.id}>
                  <span>
                    {sub !== tipo.nombre && <small>{sub}</small>}
                    {tipo.nombre}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    inputMode="numeric"
                    value={productosObtenidos[tipo.idReal as number] ?? ''}
                    onChange={(e) => {
                      const n = Math.max(0, Math.min(999, Math.floor(Number(e.target.value) || 0)))
                      onCambiarProductoObtenido(tipo.idReal as number, n)
                    }}
                  />
                </label>
              ))}
            </div>
          </details>
        )
      })}

      <h4 className="ppf-sub">Documentos originales que se guardan</h4>
      {documentos.length === 0 ? (
        <p className="ppf-intro">No se anexó ningún PDF.</p>
      ) : (
        <ul className="ppf-docs">
          {documentos.map((d) => (
            <li key={d.etiqueta}>
              <FileText size={14} />
              <strong>{d.etiqueta}:</strong> {d.nombre}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="cp-campo-error-msg">{error}</p>}

      <button type="button" className="cp-save-btn ppf-guardar" disabled={guardando} onClick={onGuardar}>
        {guardando ? <Loader2 size={16} className="cp-spin" /> : <Save size={16} />}
        {guardando ? 'Guardando proyecto finalizado...' : 'Guardar proyecto finalizado'}
      </button>
    </div>
  )
}

export default PanelProyectoFinalizado
