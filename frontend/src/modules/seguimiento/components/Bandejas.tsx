import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api/seguimiento'
import type { ProyectoSeguimiento } from '../api/tipos'
import { formatoFecha, formatoPesos } from '../lib/formato'
import { avancePeriodo, detalleNovedad, totalesProductos } from '../lib/reglas'
import type { Ejecutar } from '../lib/useAccion'
import { Badge } from './UI'

interface PropsBandeja {
  proyectos: ProyectoSeguimiento[]
  soloPendientes: boolean
  ejecutar: Ejecutar
  ocupado: boolean
}

/** Observación obligatoria + botones de decisión, reutilizado en todas las bandejas. */
function Decision({
  ocupado,
  obligatoria,
  botones,
}: {
  ocupado: boolean
  /** Si es una función, decide por botón si la observación es obligatoria. */
  obligatoria: boolean | ((etiqueta: string) => boolean)
  botones: { etiqueta: string; variante?: 'borde' | 'rojo'; onClick: (observacion: string) => void }[]
}) {
  const [observacion, setObservacion] = useState('')
  const requiere = (etiqueta: string) => (typeof obligatoria === 'function' ? obligatoria(etiqueta) : obligatoria)
  return (
    <>
      <textarea placeholder="Observación" value={observacion} onChange={(e) => setObservacion(e.target.value)} />
      <div className="seg-botones-fila">
        {botones.map((b) => (
          <button
            key={b.etiqueta}
            type="button"
            className={`seg-btn seg-btn-sm ${b.variante ? `seg-btn-${b.variante}` : ''}`}
            disabled={ocupado || (requiere(b.etiqueta) && !observacion.trim())}
            onClick={() => b.onClick(observacion)}
          >
            {b.etiqueta}
          </button>
        ))}
      </div>
    </>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <p className="seg-vacio">{texto}</p>
}

function EnlaceProyecto({ p }: { p: ProyectoSeguimiento }) {
  const navigate = useNavigate()
  return (
    <button type="button" className="seg-link" style={{ textAlign: 'left' }} onClick={() => navigate(`/seguimiento/${p.id_proyecto}`)}>
      {p.titulo}
    </button>
  )
}

/** M-02: solicitudes de rubro. La observación es obligatoria para cualquier decisión. */
export function BandejaRubros({ proyectos, soloPendientes, ejecutar, ocupado }: PropsBandeja) {
  const filas = proyectos.flatMap((p) => p.solicitudes.map((s) => ({ p, s }))).filter(({ s }) => !soloPendientes || s.estado === 'Pendiente')
  if (filas.length === 0) return <Vacio texto="No hay solicitudes de rubro para mostrar." />
  return (
    <div className="seg-tabla-wrap">
      <table className="seg-tabla">
        <thead>
          <tr><th>Proyecto</th><th>Concepto</th><th>Valor</th><th>Fecha requerida</th><th>Vigencia</th><th>Estado</th><th style={{ minWidth: 230 }}>Decisión</th></tr>
        </thead>
        <tbody>
          {filas.map(({ p, s }) => {
            const v = p.vigencias.find((x) => x.anio === s.anio)
            return (
              <tr key={`${p.id_proyecto}-${s.id}`}>
                <td><EnlaceProyecto p={p} /><br /><small>CC {p.centro_costos}</small></td>
                <td>{s.concepto}<br /><small>{s.descripcion}</small></td>
                <td>{formatoPesos(s.valor)}<br /><small>Disponible {formatoPesos(v ? v.asignado - v.ejecutado : 0)}</small></td>
                <td>{formatoFecha(s.fecha_requerida)}<br /><small>Solicitada {formatoFecha(s.fecha_solicitud)}</small></td>
                <td>{s.anio}</td>
                <td><Badge estado={s.estado} /></td>
                <td>
                  {s.estado === 'Pendiente' ? (
                    <Decision
                      ocupado={ocupado}
                      obligatoria
                      botones={(['Aprobada', 'Devuelta', 'Rechazada'] as const).map((estado) => ({
                        etiqueta: estado === 'Aprobada' ? 'Aprobar' : estado === 'Devuelta' ? 'Devolver' : 'Rechazar',
                        variante: estado === 'Devuelta' ? 'borde' : estado === 'Rechazada' ? 'rojo' : undefined,
                        onClick: (obs: string) =>
                          ejecutar(() => api.decidirSolicitudRubro(p.id_proyecto, s.id, estado, obs), `Solicitud ${estado.toLowerCase()}.`),
                      }))}
                    />
                  ) : (
                    s.observacion || '—'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** M-03: informes de avance radicados. La observación solo es obligatoria para devolver. */
export function BandejaAvances({ proyectos, soloPendientes, ejecutar, ocupado }: PropsBandeja) {
  const filas = proyectos
    .flatMap((p) => p.periodos.map((pe) => ({ p, pe })))
    .filter(({ pe }) => (soloPendientes ? pe.estado === 'Radicado' : pe.estado !== 'Programado'))
  if (filas.length === 0) return <Vacio texto="No hay informes de avance para revisar." />
  return (
    <div className="seg-tabla-wrap">
      <table className="seg-tabla">
        <thead>
          <tr><th>Proyecto</th><th className="c">Periodo</th><th>Fecha límite</th><th>Radicación</th><th className="c">% avance</th><th>Estado</th><th style={{ minWidth: 230 }}>Decisión</th></tr>
        </thead>
        <tbody>
          {filas.map(({ p, pe }) => (
            <tr key={`${p.id_proyecto}-${pe.numero}`}>
              <td><EnlaceProyecto p={p} /></td>
              <td className="c">{pe.numero}</td>
              <td>{formatoFecha(pe.limite)}</td>
              <td>{formatoFecha(pe.fecha_radicacion)}</td>
              <td className="c">{avancePeriodo(pe)} %</td>
              <td><Badge estado={pe.estado} /></td>
              <td>
                {pe.estado === 'Radicado' ? (
                  <Decision
                    ocupado={ocupado}
                    obligatoria={(etiqueta) => etiqueta === 'Devolver'}
                    botones={[
                      { etiqueta: 'Aprobar', onClick: (obs) => ejecutar(() => api.revisarAvance(p.id_proyecto, pe.numero, 'Aprobado', obs), `Informe del periodo ${pe.numero} aprobado.`) },
                      { etiqueta: 'Devolver', variante: 'borde', onClick: (obs) => ejecutar(() => api.revisarAvance(p.id_proyecto, pe.numero, 'Devuelto', obs), 'Informe devuelto con observaciones.') },
                    ]}
                  />
                ) : (
                  pe.observacion_revision || '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** M-05: novedades. Una prórroga aprobada amplía la duración y reprograma periodos. */
export function BandejaNovedades({ proyectos, soloPendientes, ejecutar, ocupado }: PropsBandeja) {
  const filas = proyectos.flatMap((p) => p.novedades.map((n) => ({ p, n }))).filter(({ n }) => !soloPendientes || n.estado === 'Pendiente')
  if (filas.length === 0) return <Vacio texto="No hay novedades para mostrar." />
  return (
    <div className="seg-tabla-wrap">
      <table className="seg-tabla">
        <thead>
          <tr><th>Proyecto</th><th>Tipo</th><th>Fecha</th><th>Detalle</th><th>Justificación</th><th>Estado</th><th style={{ minWidth: 230 }}>Decisión</th></tr>
        </thead>
        <tbody>
          {filas.map(({ p, n }) => (
            <tr key={`${p.id_proyecto}-${n.id}`}>
              <td><EnlaceProyecto p={p} /></td>
              <td><b>{n.tipo}</b></td>
              <td>{formatoFecha(n.fecha)}</td>
              <td>{detalleNovedad(n)}<br /><small>Soporte: {n.soporte}</small></td>
              <td>{n.justificacion}</td>
              <td><Badge estado={n.estado} /></td>
              <td>
                {n.estado === 'Pendiente' ? (
                  <Decision
                    ocupado={ocupado}
                    obligatoria
                    botones={[
                      { etiqueta: 'Aprobar', onClick: (obs) => ejecutar(() => api.decidirNovedad(p.id_proyecto, n.id, 'Aprobada', obs), `Novedad aprobada: ${n.tipo}.`) },
                      { etiqueta: 'Rechazar', variante: 'rojo', onClick: (obs) => ejecutar(() => api.decidirNovedad(p.id_proyecto, n.id, 'Rechazada', obs), `Novedad rechazada: ${n.tipo}.`) },
                    ]}
                  />
                ) : (
                  n.observacion || '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** M-06: informes técnicos finales radicados. Devolver borra las firmas. */
export function BandejaInformesFinales({ proyectos, soloPendientes, ejecutar, ocupado }: PropsBandeja) {
  const filas = proyectos.filter((p) => (soloPendientes ? p.informe_final.estado === 'Radicado' : p.informe_final.estado !== 'Borrador'))
  if (filas.length === 0) return <Vacio texto="No hay informes finales para revisar." />
  return (
    <div className="seg-tabla-wrap">
      <table className="seg-tabla">
        <thead>
          <tr><th>Proyecto</th><th className="c">Objetivos cumplidos</th><th className="c">Productos</th><th className="c">Cumplimiento</th><th>Estado</th><th style={{ minWidth: 230 }}>Decisión</th></tr>
        </thead>
        <tbody>
          {filas.map((p) => {
            const f = p.informe_final
            const t = totalesProductos(p)
            return (
              <tr key={p.id_proyecto}>
                <td><EnlaceProyecto p={p} /></td>
                <td className="c">{f.objetivos.filter((o) => o.cumplido).length} / {f.objetivos.length}</td>
                <td className="c">{t.obtenido} / {t.proyectado}</td>
                <td className="c">{t.porcentaje} %</td>
                <td><Badge estado={f.estado} /></td>
                <td>
                  {f.estado === 'Radicado' ? (
                    <Decision
                      ocupado={ocupado}
                      obligatoria={(etiqueta) => etiqueta === 'Devolver'}
                      botones={[
                        { etiqueta: 'Aprobar', onClick: (obs) => ejecutar(() => api.revisarInformeFinal(p.id_proyecto, 'Aprobado', obs), 'Informe final aprobado. El cierre queda habilitado por este requisito.') },
                        { etiqueta: 'Devolver', variante: 'borde', onClick: (obs) => ejecutar(() => api.revisarInformeFinal(p.id_proyecto, 'Devuelto', obs), 'Informe final devuelto. Las firmas se reiniciaron.') },
                      ]}
                    />
                  ) : (
                    f.observacion_devolucion || '—'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
