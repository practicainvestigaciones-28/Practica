import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api/seguimiento'
import type { ProyectoSeguimiento } from '../api/tipos'
import { formatoFecha } from '../lib/formato'
import { avancePeriodo, detalleNovedad, informeFinalSolicitudPendiente, periodoSolicitado, solicitudPendiente, totalesProductos } from '../lib/reglas'
import type { Ejecutar } from '../lib/useAccion'
import { Evidencias } from './Evidencias'
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

/** Solicitudes de informe: el investigador solicita cada informe de avance y el informe final, y el Administrador los
 * habilita o los rechaza (con observación obligatoria). */
export function BandejaSolicitudesAvance({ proyectos, soloPendientes, ejecutar, ocupado }: PropsBandeja) {
  interface FilaSolicitud {
    clave: string
    p: ProyectoSeguimiento
    informe: string
    ventana: string
    solicitada: string | null
    habilitada: string | null
    pendiente: boolean
    decidir: (decision: 'Habilitar' | 'Rechazar', obs: string) => void
  }
  const filas: FilaSolicitud[] = proyectos.flatMap((p) => [
    ...p.periodos
      .filter((pe) => (soloPendientes ? solicitudPendiente(pe) : periodoSolicitado(pe)))
      .map((pe) => ({
        clave: `${p.id_proyecto}-${pe.numero}`,
        p,
        informe: `Informe de avance · Periodo ${pe.numero}`,
        ventana: `${formatoFecha(pe.apertura)} – ${formatoFecha(pe.limite)}`,
        solicitada: pe.fecha_solicitud ?? null,
        habilitada: pe.fecha_habilitacion ?? null,
        pendiente: solicitudPendiente(pe),
        decidir: (decision: 'Habilitar' | 'Rechazar', obs: string) =>
          ejecutar(
            () => api.decidirSolicitudAvance(p.id_proyecto, pe.numero, decision, obs),
            decision === 'Habilitar' ? `Informe del periodo ${pe.numero} habilitado.` : 'Solicitud rechazada.'
          ),
      })),
    ...((soloPendientes ? informeFinalSolicitudPendiente(p) : !!p.informe_final.fecha_solicitud || !!p.informe_final.fecha_habilitacion)
      ? [
          {
            clave: `${p.id_proyecto}-final`,
            p,
            informe: 'Informe técnico final',
            ventana: '—',
            solicitada: p.informe_final.fecha_solicitud ?? null,
            habilitada: p.informe_final.fecha_habilitacion ?? null,
            pendiente: informeFinalSolicitudPendiente(p),
            decidir: (decision: 'Habilitar' | 'Rechazar', obs: string) =>
              ejecutar(
                () => api.decidirSolicitudInformeFinal(p.id_proyecto, decision, obs),
                decision === 'Habilitar' ? 'Informe final habilitado.' : 'Solicitud rechazada.'
              ),
          },
        ]
      : []),
  ])
  if (filas.length === 0) return <Vacio texto="No hay solicitudes de informe para mostrar." />
  return (
    <div className="seg-tabla-wrap">
      <table className="seg-tabla">
        <thead>
          <tr><th>Proyecto</th><th>Informe solicitado</th><th>Periodo del informe</th><th>Solicitud</th><th>Estado</th><th style={{ minWidth: 230 }}>Decisión</th></tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave}>
              <td><EnlaceProyecto p={f.p} /></td>
              <td><b>{f.informe}</b></td>
              <td>{f.ventana}</td>
              <td>{f.solicitada ? formatoFecha(f.solicitada) : '—'}</td>
              <td>{f.pendiente ? <Badge estado="Pendiente" /> : <Badge estado="Aprobada" />}</td>
              <td>
                {f.pendiente ? (
                  <Decision
                    ocupado={ocupado}
                    obligatoria={(etiqueta) => etiqueta === 'Rechazar'}
                    botones={[
                      { etiqueta: 'Habilitar', onClick: (obs) => f.decidir('Habilitar', obs) },
                      { etiqueta: 'Rechazar', variante: 'borde', onClick: (obs) => f.decidir('Rechazar', obs) },
                    ]}
                  />
                ) : (
                  `Habilitado${f.habilitada ? ` el ${formatoFecha(f.habilitada)}` : ''}`
                )}
              </td>
            </tr>
          ))}
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
          <tr><th>Proyecto</th><th className="c">Periodo</th><th>Fecha límite</th><th>Radicación</th><th className="c">% avance</th><th style={{ minWidth: 220 }}>Evidencias</th><th>Estado</th><th style={{ minWidth: 230 }}>Decisión</th></tr>
        </thead>
        <tbody>
          {filas.map(({ p, pe }) => (
            <tr key={`${p.id_proyecto}-${pe.numero}`}>
              <td><EnlaceProyecto p={p} /></td>
              <td className="c">{pe.numero}</td>
              <td>{formatoFecha(pe.limite)}</td>
              <td>{formatoFecha(pe.fecha_radicacion)}</td>
              <td className="c">{avancePeriodo(pe)} %</td>
              <td>
                {pe.detalle.every((d) => d.evidencias.length === 0)
                  ? '—'
                  : pe.detalle.map((d, i) =>
                      d.evidencias.length > 0 ? (
                        <div key={i} style={{ marginBottom: 6 }}>
                          <small><b>{p.metas[i]?.actividad ?? `Actividad ${i + 1}`}</b></small>
                          <Evidencias evidencias={d.evidencias} />
                        </div>
                      ) : null
                    )}
              </td>
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
