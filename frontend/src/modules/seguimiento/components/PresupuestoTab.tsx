import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import * as api from '../api/seguimiento'
import type { ConceptoRubro } from '../api/tipos'
import { formatoFecha, formatoPesos, hoyISO } from '../lib/formato'
import { totalAsignado, totalEjecutado, validarSolicitudRubro, type DatosSolicitudRubro } from '../lib/reglas'
import { Aviso, Badge, Kpi } from './UI'
import type { PropsPestana } from './props'

const solicitudVacia = (): DatosSolicitudRubro => ({ id_concepto: 0, anio: 0, valor: 0, fecha_requerida: '', descripcion: '' })

/** M-02: presupuesto por vigencia y solicitudes de rubro del investigador. */
function PresupuestoTab({ proyecto, roles, ejecutar, ocupado, bloqueado }: PropsPestana) {
  const [conceptos, setConceptos] = useState<ConceptoRubro[]>([])
  const [formAbierto, setFormAbierto] = useState(false)
  const [datos, setDatos] = useState<DatosSolicitudRubro>(solicitudVacia)
  const puedeSolicitar = roles.includes('usuario') && !bloqueado

  useEffect(() => {
    api.listarConceptosRubro().then((lista) => setConceptos(lista.filter((c) => c.activo)))
  }, [])

  const asignado = totalAsignado(proyecto)
  const ejecutado = totalEjecutado(proyecto)
  const vigenciasConSaldo = proyecto.vigencias.filter((v) => v.asignado - v.ejecutado > 0)
  const concepto = conceptos.find((c) => c.id === datos.id_concepto)
  const errores = useMemo(() => validarSolicitudRubro(proyecto, concepto, datos, hoyISO()), [proyecto, concepto, datos])

  const abrirFormulario = () => {
    setDatos({ ...solicitudVacia(), id_concepto: conceptos[0]?.id ?? 0, anio: vigenciasConSaldo[0]?.anio ?? 0 })
    setFormAbierto(true)
  }

  const enviar = async () => {
    const ok = await ejecutar(() => api.crearSolicitudRubro(proyecto.id_proyecto, datos), 'Solicitud enviada a la Vicerrectoría.')
    if (ok) setFormAbierto(false)
  }

  return (
    <section className="seg-card">
      <div className="seg-kpis">
        <Kpi etiqueta="Asignado" valor={formatoPesos(asignado)} />
        <Kpi etiqueta="Ejecutado" valor={formatoPesos(ejecutado)} />
        <Kpi etiqueta="Disponible" valor={formatoPesos(asignado - ejecutado)} />
        <Kpi etiqueta="Centro de costos" valor={proyecto.centro_costos || '—'} />
      </div>

      <h3>Detalle por vigencia</h3>
      <div className="seg-tabla-wrap">
        <table className="seg-tabla">
          <thead>
            <tr><th>Vigencia</th><th>Asignado</th><th>Ejecutado</th><th>Disponible</th><th className="c">% ejecución</th></tr>
          </thead>
          <tbody>
            {proyecto.vigencias.map((v) => (
              <tr key={v.anio}>
                <td>{v.anio}</td>
                <td>{formatoPesos(v.asignado)}</td>
                <td>{formatoPesos(v.ejecutado)}</td>
                <td>{formatoPesos(v.asignado - v.ejecutado)}</td>
                <td className="c">{v.asignado ? Math.round((v.ejecutado / v.asignado) * 100) : 0} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Solicitudes de rubro</h3>
      {proyecto.solicitudes.length === 0 ? (
        <p className="seg-vacio">Aún no hay solicitudes registradas.</p>
      ) : (
        <div className="seg-tabla-wrap">
          <table className="seg-tabla">
            <thead>
              <tr><th>Concepto</th><th>Valor</th><th>Fecha requerida</th><th>Vigencia</th><th>Estado</th><th>Observación de la VIE</th></tr>
            </thead>
            <tbody>
              {proyecto.solicitudes.map((s) => (
                <tr key={s.id}>
                  <td>{s.concepto}<br /><small>{s.descripcion}</small></td>
                  <td>{formatoPesos(s.valor)}</td>
                  <td>{formatoFecha(s.fecha_requerida)}</td>
                  <td>{s.anio}</td>
                  <td><Badge estado={s.estado} /></td>
                  <td>{s.observacion || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {puedeSolicitar && !formAbierto && (
        <div className="seg-acciones seg-acciones-izq">
          <button type="button" className="seg-btn" onClick={abrirFormulario} disabled={vigenciasConSaldo.length === 0}>
            <Plus size={14} /> Solicitar rubro
          </button>
        </div>
      )}

      {puedeSolicitar && formAbierto && (
        <>
          <h3>Nueva solicitud de asignación de rubro</h3>
          <div className="seg-grid">
            <label className="seg-campo">
              Concepto de rubro *
              <select value={datos.id_concepto} onChange={(e) => setDatos({ ...datos, id_concepto: Number(e.target.value) })}>
                {conceptos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {concepto && <span className="seg-ayuda">Antelación mínima: {concepto.antelacion_valor} {concepto.antelacion_unidad}</span>}
            </label>
            <label className="seg-campo">
              Vigencia *
              <select value={datos.anio} onChange={(e) => setDatos({ ...datos, anio: Number(e.target.value) })}>
                {vigenciasConSaldo.map((v) => (
                  <option key={v.anio} value={v.anio}>{v.anio} · disponible {formatoPesos(v.asignado - v.ejecutado)}</option>
                ))}
              </select>
            </label>
            <label className="seg-campo">
              Valor solicitado *
              <input type="number" min={1} value={datos.valor || ''} onChange={(e) => setDatos({ ...datos, valor: Number(e.target.value) })} />
              {datos.valor > 0 && errores.valor && <span className="seg-error-campo">{errores.valor}</span>}
            </label>
            <label className="seg-campo">
              Fecha requerida *
              <input type="date" value={datos.fecha_requerida} onChange={(e) => setDatos({ ...datos, fecha_requerida: e.target.value })} />
              {datos.fecha_requerida && errores.fecha_requerida && <span className="seg-error-campo">{errores.fecha_requerida}</span>}
            </label>
            <label className="seg-campo seg-campo-ancho">
              Descripción de la solicitud *
              <textarea maxLength={500} value={datos.descripcion} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} />
              <span className="seg-ayuda">{datos.descripcion.length} / 500 caracteres</span>
            </label>
          </div>
          <div className="seg-acciones">
            <button type="button" className="seg-btn seg-btn-borde" onClick={() => setFormAbierto(false)}>Cancelar</button>
            <button type="button" className="seg-btn" disabled={ocupado || Object.keys(errores).length > 0} onClick={enviar}>
              Enviar solicitud
            </button>
          </div>
        </>
      )}

      {puedeSolicitar && vigenciasConSaldo.length === 0 && (
        <Aviso tipo="info">No hay vigencias con saldo disponible para nuevas solicitudes.</Aviso>
      )}
    </section>
  )
}

export default PresupuestoTab
