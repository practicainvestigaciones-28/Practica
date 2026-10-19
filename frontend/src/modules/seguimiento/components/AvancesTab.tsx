import { useEffect, useState } from 'react'
import { Download, Lock } from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import * as api from '../api/seguimiento'
import type { DetalleAvance, EstadoActividad, Evidencia, PeriodoInforme } from '../api/tipos'
import { formatoFecha } from '../lib/formato'
import {
  MESES_POR_PERIODO,
  SEMANAS_POR_MES,
  SEMANAS_POR_PERIODO,
  anioPeriodo,
  avancePeriodo,
  duracionTotal,
  anteriorAprobado,
  detalleDesde,
  estadoPorPorcentaje,
  faltaPorHacer,
  camposFaltantes,
  faltanEvidencias,
  fechaFin,
  mensajeBloqueoPeriodo,
  periodoAbierto,
  periodoBloqueadoPorOrden,
  periodoEditable,
  periodoHabilitado,
  periodoSolicitado,
  solicitudPendiente,
  puedeFirmarComo,
  siguienteFirma,
} from '../lib/reglas'
import { Evidencias } from './Evidencias'
import { Aviso, Badge, CampoLectura, FirmasSecuenciales } from './UI'
import type { PropsPestana } from './props'

const ESTADOS_ACTIVIDAD: EstadoActividad[] = ['No iniciada', 'En ejecución', 'Cumplida', 'Aplazada']
const MESES = Array.from({ length: MESES_POR_PERIODO }, (_, i) => i)
const SEMANAS = Array.from({ length: SEMANAS_POR_PERIODO }, (_, i) => i)

/** Periodo que se abre por defecto: el primero que aún no está aprobado. */
const periodoInicial = (periodos: PeriodoInforme[]) => {
  const i = periodos.findIndex((p) => p.estado !== 'Aprobado')
  return periodos[i < 0 ? 0 : i]?.numero ?? 1
}

const lista = (nombres: string[]) => (nombres.length > 0 ? nombres.join(', ') : '—')

/** M-03: programación de periodos (Administrador) e informe de avance del
 * Investigador, con la estructura del formato INV-IC-FR-018. */
function AvancesTab({ proyecto, roles, ejecutar, ocupado, bloqueado }: PropsPestana) {
  const esAdmin = roles.includes('administrador')
  const esInvestigador = roles.includes('usuario')
  const [numero, setNumero] = useState(() => periodoInicial(proyecto.periodos))
  const periodo = proyecto.periodos.find((p) => p.numero === numero) ?? proyecto.periodos[0]
  // Un periodo sin trabajo continúa desde lo que quedó hecho en el anterior (ya aprobado).
  const detalleInicial = (pe: PeriodoInforme | undefined): DetalleAvance[] => {
    if (!pe) return []
    const anterior = anteriorAprobado(proyecto.periodos, pe.numero)
    const sinArrastre = pe.estado === 'Programado' && pe.detalle.every((d) => d.previo === undefined)
    return anterior && sinArrastre ? detalleDesde(anterior, pe.detalle.length || proyecto.metas.length) : (pe.detalle ?? [])
  }
  const [detalle, setDetalle] = useState<DetalleAvance[]>(() => detalleInicial(periodo))
  const [confirmarRadicar, setConfirmarRadicar] = useState(false)
  const [obsSolicitud, setObsSolicitud] = useState('')

  // Al cambiar de periodo o recargar el proyecto se descarta el borrador local.
  useEffect(() => {
    setDetalle(detalleInicial(periodo))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo])

  const programacion = esAdmin && (
    <section className="seg-card">
      <h3>Programación de periodos de informe</h3>
      <div className="seg-grid">
        <CampoLectura etiqueta="Fecha de inicio" valor={formatoFecha(proyecto.fecha_inicio)} />
        <CampoLectura etiqueta="Duración total (meses)" valor={duracionTotal(proyecto)} />
        <CampoLectura etiqueta="Fecha de finalización" valor={formatoFecha(fechaFin(proyecto))} />
        <CampoLectura etiqueta="Periodos generados" valor={proyecto.periodos.length} />
      </div>
      <p className="seg-ayuda">
        Los periodos son semestrales y se calculan con la fecha de inicio y la duración del acta de inicio. Regenerar
        conserva el contenido de los periodos que ya tienen avance registrado.
      </p>
      {!bloqueado && (
        <div className="seg-acciones">
          <button type="button" className="seg-btn" disabled={ocupado} onClick={() => ejecutar(() => api.regenerarPeriodos(proyecto.id_proyecto), 'Periodos regenerados.')}>
            Regenerar periodos
          </button>
        </div>
      )}
    </section>
  )

  if (!periodo) {
    return (
      <>
        {programacion}
        <section className="seg-card">
          <Aviso tipo="error">Aún no hay periodos programados para este proyecto.</Aviso>
        </section>
      </>
    )
  }

  const abierto = periodoAbierto(periodo) && !bloqueado
  // Los informes se habilitan en orden: este periodo espera la aprobación del anterior.
  const esperaAnterior = periodoBloqueadoPorOrden(proyecto.periodos, periodo.numero)
  const habilitado = periodoHabilitado(periodo)
  const editable = esInvestigador && !bloqueado && !esperaAnterior && habilitado && periodoEditable(periodo)
  const solicitar = (n: number) =>
    ejecutar(() => api.solicitarAvance(proyecto.id_proyecto, n), `Solicitud del informe del periodo ${n} enviada. El Administrador debe habilitarlo para que puedas diligenciarlo.`)
  const decidir = (decision: 'Habilitar' | 'Rechazar') =>
    ejecutar(
      () => api.decidirSolicitudAvance(proyecto.id_proyecto, periodo.numero, decision, obsSolicitud),
      decision === 'Habilitar' ? `Informe del periodo ${periodo.numero} habilitado.` : 'Solicitud rechazada.'
    ).then(() => setObsSolicitud(''))
  const borrador: PeriodoInforme = { ...periodo, detalle }
  const sinGuardar = JSON.stringify(detalle) !== JSON.stringify(detalleInicial(periodo))
  const faltantes = camposFaltantes(borrador)
  const periodoAnterior = proyecto.periodos.find((x) => x.numero === periodo.numero - 1)
  const hayFirmas = periodo.firmas.some((f) => f.firmado)
  const firmasCompletas = siguienteFirma(periodo.firmas) === -1
  const { equipo } = proyecto

  const cambiar = (i: number, cambio: Partial<DetalleAvance>) =>
    setDetalle((prev) =>
      prev.map((d, j) => {
        if (j !== i) return d
        const nuevo = { ...d, ...cambio }
        if (cambio.porcentaje !== undefined) {
          // No se puede bajar del avance con que cerró el periodo anterior.
          nuevo.porcentaje = Math.max(d.previo ?? 0, Math.min(100, Math.round(cambio.porcentaje) || 0))
          if (nuevo.estado !== 'Aplazada') nuevo.estado = estadoPorPorcentaje(nuevo.porcentaje)
        }
        return nuevo
      })
    )

  const alternarSemana = (i: number, semana: number) => cambiar(i, { semanas: detalle[i].semanas.map((v, s) => (s === semana ? !v : v)) })

  const tablaCronograma = (pe: PeriodoInforme, det: DetalleAvance[], editar: boolean) => (
  <div className="seg-tabla-wrap">
    <table className="seg-tabla seg-cronograma">
      <thead>
        <tr>
          <th rowSpan={2}>Objetivos específicos</th>
          <th rowSpan={2}>Meta</th>
          <th rowSpan={2}>Actividades</th>
          <th rowSpan={2}>Responsable</th>
          <th colSpan={SEMANAS_POR_PERIODO} className="c">Período {pe.numero} Año {anioPeriodo(pe)}</th>
        </tr>
        <tr>
          {MESES.map((m) => <th key={m} colSpan={SEMANAS_POR_MES} className="c seg-mes">Mes {m + 1}</th>)}
        </tr>
      </thead>
      <tbody>
        {proyecto.metas.map((m, i) => {
          const d = det[i]
          if (!d) return null
          return (
            <tr key={i}>
              <td>{m.objetivo}</td>
              <td>{m.meta}</td>
              <td>{m.actividad}</td>
              <td>{m.responsable}</td>
              {SEMANAS.map((s) => (
                <td key={s} className={`seg-semana ${s % SEMANAS_POR_MES === 0 ? 'seg-semana-mes' : ''}`}>
                  <button
                    type="button"
                    disabled={!editar}
                    aria-pressed={!!d.semanas[s]}
                    aria-label={`${m.actividad}: mes ${Math.floor(s / SEMANAS_POR_MES) + 1}, semana ${(s % SEMANAS_POR_MES) + 1}`}
                    className={d.semanas[s] ? 'seg-semana-on' : ''}
                    onClick={() => alternarSemana(i, s)}
                  />
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
  )

  const agregarEvidencia = (i: number, ev: Evidencia) =>
    setDetalle((prev) => prev.map((d, j) => (j === i ? { ...d, evidencias: [...d.evidencias, ev] } : d)))
  const quitarEvidencia = (i: number, k: number) =>
    setDetalle((prev) => prev.map((d, j) => (j === i ? { ...d, evidencias: d.evidencias.filter((_, x) => x !== k) } : d)))

  const guardar = () => ejecutar(() => api.guardarAvance(proyecto.id_proyecto, periodo.numero, detalle), 'Informe guardado.')
  const descargar = async () => {
    const { descargarPdfAvance } = await import('../lib/pdfAvance')
    await descargarPdfAvance(proyecto, borrador)
  }

  const tarjetas = (
    <section className="seg-card">
      <h3>Periodos de informe</h3>
      <div className="seg-periodos">
        {proyecto.periodos.map((p) => {
          const espera = periodoBloqueadoPorOrden(proyecto.periodos, p.numero)
          return (
            <div key={p.numero} className={`seg-periodo ${p.numero === periodo.numero ? 'seg-periodo-activo' : ''} ${espera ? 'seg-periodo-bloqueado' : ''}`}>
              <span className="seg-periodo-titulo">Periodo {p.numero}</span>
              <span className="seg-ayuda">{formatoFecha(p.apertura)} – {formatoFecha(p.limite)}</span>
              <Badge estado={p.estado} />
              <div className="seg-barra"><i style={{ width: `${avancePeriodo(p)}%` }} /></div>
              <span className="seg-ayuda">{avancePeriodo(p)} % de avance</span>
              {espera ? (
                <>
                  <span className="seg-ayuda seg-bloqueo-texto"><Lock size={11} /> {mensajeBloqueoPeriodo(p.numero)}</span>
                  <button type="button" className="seg-btn seg-btn-sm seg-btn-borde" disabled>
                    Bloqueado
                  </button>
                </>
              ) : !periodoSolicitado(p) && esInvestigador && !bloqueado ? (
                <button type="button" className="seg-btn seg-btn-sm" disabled={ocupado} onClick={() => { setNumero(p.numero); solicitar(p.numero) }}>
                  Solicitar informe
                </button>
              ) : solicitudPendiente(p) ? (
                <button type="button" className={`seg-btn seg-btn-sm ${p.numero === periodo.numero ? '' : 'seg-btn-borde'}`} onClick={() => setNumero(p.numero)}>
                  {esAdmin ? 'Revisar solicitud' : 'Consultar'}
                </button>
              ) : (
                <button type="button" className={`seg-btn seg-btn-sm ${p.numero === periodo.numero ? '' : 'seg-btn-borde'}`} onClick={() => setNumero(p.numero)}>
                  {editable && p.numero === periodo.numero ? 'Diligenciando' : periodoEditable(p) && esInvestigador ? 'Diligenciar' : 'Consultar'}
                </button>
              )}
              {!espera && !periodoSolicitado(p) && <span className="seg-ayuda">Sin solicitar</span>}
              {solicitudPendiente(p) && <span className="seg-ayuda">Solicitado el {formatoFecha(p.fecha_solicitud ?? null)} · en espera del Administrador</span>}
              {p.estado === 'Programado' && p.fecha_habilitacion && <span className="seg-ayuda">Habilitado el {formatoFecha(p.fecha_habilitacion)}</span>}
            </div>
          )
        })}
      </div>
    </section>
  )

  // Sin habilitar, el informe no se muestra ni se diligencia: el investigador lo solicita y el Administrador lo habilita.
  if (!habilitado && !esperaAnterior) {
    const pendiente = solicitudPendiente(periodo)
    return (
      <>
        {programacion}
        {tarjetas}
        <section className="seg-card">
          <h3>Informe de avance · Periodo {periodo.numero}</h3>
          {periodo.observacion_solicitud && (
            <Aviso tipo="error"><b>Solicitud rechazada por el Administrador:</b> {periodo.observacion_solicitud}</Aviso>
          )}
          {!pendiente && (
            <Aviso tipo="info">
              {esInvestigador && !bloqueado
                ? `El informe de avance del periodo ${periodo.numero} aún no se ha solicitado. Solicítalo: el Administrador lo habilita y entonces puedes diligenciarlo.`
                : `El investigador aún no ha solicitado el informe de avance del periodo ${periodo.numero}.`}
            </Aviso>
          )}
          {pendiente && (
            <Aviso tipo="info">
              {esAdmin
                ? `El investigador solicitó el informe de avance del periodo ${periodo.numero} el ${formatoFecha(periodo.fecha_solicitud ?? null)}. Habilítalo para que pueda diligenciarlo.`
                : `Tu solicitud del informe del periodo ${periodo.numero} se envió el ${formatoFecha(periodo.fecha_solicitud ?? null)}. Cuando el Administrador la habilite podrás diligenciarlo.`}
            </Aviso>
          )}
          {!pendiente && esInvestigador && !bloqueado && (
            <div className="seg-acciones">
              <button type="button" className="seg-btn" disabled={ocupado} onClick={() => solicitar(periodo.numero)}>
                Solicitar informe de avance
              </button>
            </div>
          )}
          {pendiente && esAdmin && !bloqueado && (
            <>
              <textarea placeholder="Observación (obligatoria para rechazar)" value={obsSolicitud} onChange={(e) => setObsSolicitud(e.target.value)} />
              <div className="seg-acciones">
                <button type="button" className="seg-btn" disabled={ocupado} onClick={() => decidir('Habilitar')}>
                  Habilitar informe
                </button>
                <button type="button" className="seg-btn seg-btn-borde" disabled={ocupado || !obsSolicitud.trim()} onClick={() => decidir('Rechazar')}>
                  Rechazar solicitud
                </button>
              </div>
            </>
          )}
        </section>
      </>
    )
  }

  return (
    <>
      {programacion}

      {tarjetas}

      <section className="seg-card">
        <div className="seg-filtros">
          <div className="seg-header-fila">
            <h3 style={{ margin: 0 }}>Informe de avance · INV-IC-FR-018 · Periodo {periodo.numero}</h3>
            <Badge estado={periodo.estado} />
          </div>
          <button type="button" className="seg-btn seg-btn-sec" disabled={ocupado} onClick={() => ejecutar(descargar, 'PDF del informe descargado.')}>
            <Download size={14} /> Descargar informe (PDF)
          </button>
        </div>
        {periodo.observacion_revision && (
          <Aviso tipo="error"><b>Devuelto por la Vicerrectoría:</b> {periodo.observacion_revision}</Aviso>
        )}

        {/* Ficha del formato: viene del proyecto y del acta de inicio, solo lectura. */}
        <dl className="seg-ficha">
          <dt>Título de la investigación</dt>
          <dd title={proyecto.titulo}><span className="seg-ficha-titulo">{proyecto.titulo}</span></dd>
          <dt>Programa académico / Departamento</dt>
          <dd>{proyecto.programa_academico || '—'}</dd>
          <dt>Duración del proyecto</dt>
          <dd>{duracionTotal(proyecto)} meses</dd>
          <dt>Convocatoria</dt>
          <dd>{proyecto.convocatoria}</dd>
        </dl>
        <h4>Equipo investigador</h4>
        <dl className="seg-ficha">
          <dt>Investigador principal</dt>
          <dd>{proyecto.investigador_principal}</dd>
          <dt>Co-investigadores internos</dt>
          <dd>{lista(equipo.co_investigadores_internos)}</dd>
          <dt>Co-investigadores externos</dt>
          <dd>{lista(equipo.co_investigadores_externos)}</dd>
          <dt>Auxiliar de investigación</dt>
          <dd>{lista(equipo.auxiliares)}</dd>
          <dt>Asistente de investigación</dt>
          <dd>{lista(equipo.asistentes)}</dd>
        </dl>

        {periodoAnterior && (
          <>
            <h4>Lo que se hizo y lo que sigue · Periodo {periodoAnterior.numero}</h4>
            <p className="seg-ayuda">
              {periodoAnterior.estado === 'Aprobado'
                ? 'Este informe continúa desde el avance aprobado del periodo anterior.'
                : `El periodo ${periodoAnterior.numero} aún no está aprobado.`}
            </p>
            <div className="seg-tabla-wrap">
              <table className="seg-tabla">
                <thead>
                  <tr><th>Actividad</th><th>Estado</th><th className="c">Avance logrado</th><th className="c">Falta por hacer</th><th>Observación del periodo anterior</th></tr>
                </thead>
                <tbody>
                  {proyecto.metas.map((m, i) => {
                    const d = periodoAnterior.detalle[i]
                    if (!d) return null
                    return (
                      <tr key={i}>
                        <td>{m.actividad}</td>
                        <td>{d.estado}</td>
                        <td className="c">{d.porcentaje} %</td>
                        <td className="c">{faltaPorHacer(d.porcentaje)} %</td>
                        <td>{d.observacion || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <h4>Semanas trabajadas · Periodo {periodoAnterior.numero}</h4>
            {tablaCronograma(periodoAnterior, periodoAnterior.detalle, false)}
          </>
        )}

        <h4>Cronograma del periodo</h4>
        {editable && <p className="seg-ayuda">Marca las semanas en que se trabajó cada actividad (4 semanas por mes).</p>}
        {tablaCronograma(periodo, detalle, editable)}

        <h4>Avance y evidencias por actividad</h4>
        <div className="seg-tabla-wrap">
          <table className="seg-tabla seg-tabla-avance">
            <thead>
              <tr><th>Actividad</th><th>Estado</th><th className="c">% de avance</th><th>Observación</th><th>Evidencias</th></tr>
            </thead>
            <tbody>
              {proyecto.metas.map((m, i) => {
                const d = detalle[i]
                if (!d) return null
                return (
                  <tr key={i}>
                    <td>
                      {m.actividad}<br /><small>{m.responsable}</small>
                      {(d.previo ?? 0) > 0 && (
                        <><br /><small className="seg-ayuda">Venía en {d.previo} % · falta {faltaPorHacer(d.porcentaje)} %</small></>
                      )}
                    </td>
                    <td>
                      <select disabled={!editable} value={d.estado} onChange={(e) => cambiar(i, { estado: e.target.value as EstadoActividad })}>
                        {ESTADOS_ACTIVIDAD.map((x) => <option key={x}>{x}</option>)}
                      </select>
                    </td>
                    <td className="c">
                      <input type="number" min={d.previo ?? 0} max={100} style={{ width: 80 }} disabled={!editable || (d.previo ?? 0) >= 100} value={d.porcentaje} onChange={(e) => cambiar(i, { porcentaje: Number(e.target.value) })} />
                    </td>
                    <td>
                      <textarea maxLength={300} disabled={!editable} value={d.observacion} onChange={(e) => cambiar(i, { observacion: e.target.value })} />
                    </td>
                    <td>
                      <Evidencias evidencias={d.evidencias} editable={editable} onAgregar={(ev) => agregarEvidencia(i, ev)} onQuitar={(k) => quitarEvidencia(i, k)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="seg-ayuda" style={{ marginTop: 10 }}>
          <b>Nota:</b> adjuntar las evidencias del avance de actividades según el cronograma. · <b>Avance ponderado del periodo: {avancePeriodo(borrador)} %</b>
        </p>
        {editable && faltantes.length > 0 && (
          <Aviso tipo="error">
            Para guardar el informe y enviarlo a revisión completa los campos de lo que realizaste:
            <ul>{faltantes.map((x) => <li key={x}>{x}</li>)}</ul>
          </Aviso>
        )}
        {editable && (
          <div className="seg-acciones">
            <button type="button" className="seg-btn" disabled={ocupado || faltantes.length > 0 || (!sinGuardar && periodo.estado !== 'Programado')} onClick={guardar}>Guardar informe</button>
          </div>
        )}

        <h4>Firmas del informe</h4>
        {abierto && periodo.estado === 'Programado' && <p className="seg-ayuda">Guarda el informe para habilitar las firmas.</p>}
        {abierto && sinGuardar && periodo.estado !== 'Programado' && <Aviso tipo="info">Tienes cambios sin guardar. Guárdalos antes de firmar: se firma lo que está guardado.</Aviso>}
        <FirmasSecuenciales
          firmas={periodo.firmas}
          habilitado={abierto && periodo.estado !== 'Programado' && !sinGuardar && !faltanEvidencias(periodo)}
          puedeFirmar={(f) => puedeFirmarComo(f.rol, roles)}
          textoConfirmacion="Vas a firmar el informe de avance. Después de firmar ya no se puede editar, salvo que se reabra."
          onFirmar={(i) => ejecutar(() => api.firmarAvance(proyecto.id_proyecto, periodo.numero, i), 'Firma registrada.')}
        />

        {esInvestigador && abierto && hayFirmas && (
          <div className="seg-acciones">
            <button type="button" className="seg-btn seg-btn-borde" disabled={ocupado} onClick={() => ejecutar(() => api.reabrirAvance(proyecto.id_proyecto, periodo.numero), 'Informe reabierto: las firmas se borraron.')}>
              Volver a editar (borra las firmas)
            </button>
            <button type="button" className="seg-btn" disabled={ocupado || !firmasCompletas} onClick={() => setConfirmarRadicar(true)}>
              Radicar informe
            </button>
          </div>
        )}
      </section>

      {confirmarRadicar && (
        <ConfirmModal
          mensaje={`¿Radicar el informe de avance del periodo ${periodo.numero}? Ya no podrás editarlo hasta que la Vicerrectoría lo revise.`}
          onClose={() => setConfirmarRadicar(false)}
          botonSecundario={{ label: 'Cancelar', onClick: () => setConfirmarRadicar(false), variante: 'rojo' }}
          botonPrimario={{
            label: 'Radicar',
            variante: 'azul',
            onClick: () => {
              setConfirmarRadicar(false)
              ejecutar(() => api.radicarAvance(proyecto.id_proyecto, periodo.numero), `Informe del periodo ${periodo.numero} radicado. Queda en revisión de la Vicerrectoría.`)
            },
          }}
        />
      )}
    </>
  )
}

export default AvancesTab
