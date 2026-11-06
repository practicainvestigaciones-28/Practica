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
  siguienteFirma,
  camposFaltantes,
  faltanEvidencias,
  fechaFin,
  mensajeBloqueoPeriodo,
  periodoAbierto,
  periodoBloqueadoPorOrden,
  periodoEditable,
  periodoHabilitado,
  periodoSolicitado,
  puedeFirmarComo,
} from '../lib/reglas'
import { Evidencias } from './Evidencias'
import { Aviso, Badge, CampoLectura, FilaRevisadoPor, FirmasSecuenciales } from './UI'
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
/** Fechas de un periodo: el Administrador las ajusta hasta que el informe se aprueba. */
function FilaFechasPeriodo({
  p,
  idProyecto,
  ocupado,
  bloqueado,
  ejecutar,
}: {
  p: PeriodoInforme
  idProyecto: number
  ocupado: boolean
  bloqueado: boolean
  ejecutar: PropsPestana['ejecutar']
}) {
  const [apertura, setApertura] = useState(p.apertura)
  const [limite, setLimite] = useState(p.limite)
  const editable = !bloqueado && p.estado !== 'Aprobado'
  const cambio = apertura !== p.apertura || limite !== p.limite
  const valido = !!apertura && !!limite && apertura < limite
  return (
    <tr>
      <td><b>Periodo {p.numero}</b></td>
      <td><input type="date" aria-label={`Apertura del periodo ${p.numero}`} disabled={!editable} value={apertura} onChange={(e) => setApertura(e.target.value)} /></td>
      <td><input type="date" aria-label={`Límite del periodo ${p.numero}`} disabled={!editable} value={limite} onChange={(e) => setLimite(e.target.value)} /></td>
      <td>
        {p.estado}
        {p.fechas_ajustadas && <span className="seg-ayuda"> · fechas ajustadas</span>}
      </td>
      <td>
        {editable ? (
          <div className="seg-acciones" style={{ margin: 0 }}>
            <button type="button" className="seg-btn seg-btn-sm" disabled={ocupado || !cambio || !valido} onClick={() => ejecutar(() => api.ajustarFechasPeriodo(idProyecto, p.numero, { apertura, limite }), `Fechas del periodo ${p.numero} guardadas.`)}>
              Guardar fechas
            </button>
            {p.fechas_ajustadas && (
              <button type="button" className="seg-btn seg-btn-sm seg-btn-borde" disabled={ocupado} onClick={() => ejecutar(() => api.ajustarFechasPeriodo(idProyecto, p.numero, { restablecer: true }), `Fechas del periodo ${p.numero} restablecidas.`)}>
                Restablecer
              </button>
            )}
          </div>
        ) : (
          <span className="seg-ayuda">Informe aprobado</span>
        )}
      </td>
    </tr>
  )
}

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
        conserva el contenido de los periodos que ya tienen avance registrado y las fechas que ajustes a mano.
      </p>
      <div className="seg-tabla-wrap">
        <table className="seg-tabla">
          <thead>
            <tr><th>Periodo</th><th>Apertura</th><th>Límite</th><th>Estado</th><th style={{ minWidth: 190 }}>Acción</th></tr>
          </thead>
          <tbody>
            {proyecto.periodos.map((p) => (
              <FilaFechasPeriodo key={`${p.numero}-${p.apertura}-${p.limite}`} p={p} idProyecto={proyecto.id_proyecto} ocupado={ocupado} bloqueado={bloqueado} ejecutar={ejecutar} />
            ))}
          </tbody>
        </table>
      </div>
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
  // El Administrador solicita cada informe al investigador: queda habilitado y al investigador le llega una notificación y un correo.
  const solicitar = (n: number) =>
    ejecutar(() => api.solicitarAvance(proyecto.id_proyecto, n), `Informe del periodo ${n} solicitado al investigador: le llegó una notificación y un correo.`)
  const borrador: PeriodoInforme = { ...periodo, detalle }
  const sinGuardar = JSON.stringify(detalle) !== JSON.stringify(detalleInicial(periodo))
  const faltantes = camposFaltantes(borrador)
  const periodoAnterior = proyecto.periodos.find((x) => x.numero === periodo.numero - 1)
  const hayFirmas = periodo.firmas.some((f) => f.firmado)
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
              ) : !periodoSolicitado(p) && esAdmin && !bloqueado ? (
                <button type="button" className="seg-btn seg-btn-sm" disabled={ocupado} onClick={() => { setNumero(p.numero); solicitar(p.numero) }}>
                  Solicitar al investigador
                </button>
              ) : (
                <button type="button" className={`seg-btn seg-btn-sm ${p.numero === periodo.numero ? '' : 'seg-btn-borde'}`} onClick={() => setNumero(p.numero)}>
                  {editable && p.numero === periodo.numero ? 'Diligenciando' : periodoEditable(p) && esInvestigador ? 'Diligenciar' : 'Consultar'}
                </button>
              )}
              {!espera && !periodoSolicitado(p) && <span className="seg-ayuda">Sin solicitar</span>}
              {p.estado === 'Programado' && p.fecha_solicitud && <span className="seg-ayuda">Solicitado al investigador el {formatoFecha(p.fecha_solicitud)}</span>}
            </div>
          )
        })}
      </div>
    </section>
  )

  // Sin solicitar, el informe no se muestra ni se diligencia: el Administrador lo solicita al investigador.
  if (!habilitado && !esperaAnterior) {
    return (
      <>
        {programacion}
        {tarjetas}
        <section className="seg-card">
          <h3>Informe de avance · Periodo {periodo.numero}</h3>
          <Aviso tipo="info">
            {esAdmin
              ? `Aún no has solicitado el informe de avance del periodo ${periodo.numero} al investigador. Al solicitarlo le llega una notificación y un correo, y desde ahí puede diligenciarlo.`
              : `El Administrador aún no ha solicitado el informe de avance del periodo ${periodo.numero}. Cuando lo solicite te llegará una notificación y un correo, y podrás diligenciarlo.`}
          </Aviso>
          {esAdmin && !bloqueado && (
            <div className="seg-acciones">
              <button type="button" className="seg-btn" disabled={ocupado} onClick={() => solicitar(periodo.numero)}>
                Solicitar informe de avance al investigador
              </button>
            </div>
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
        {periodo.revisado_por && (
          <Aviso tipo="ok"><b>Revisado por {periodo.revisado_por.nombre}</b> · {formatoFecha(periodo.revisado_por.fecha)}</Aviso>
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
        <p className="seg-ayuda">
          Firman el investigador principal y los co-investigadores, en ese orden, y todas las firmas son obligatorias para radicar el informe.
          Al aprobarlo, el Administrador firma como quien lo revisó.
        </p>
        <FirmasSecuenciales
          firmas={periodo.firmas}
          habilitado={abierto && periodo.estado !== 'Programado' && !sinGuardar && !faltanEvidencias(periodo)}
          puedeFirmar={(f) => puedeFirmarComo(f.rol, roles)}
          textoConfirmacion="Vas a firmar el informe de avance. Después de firmar ya no se puede editar, salvo que se reabra."
          idProyecto={proyecto.id_proyecto}
          documento={`informe de avance ${periodo.numero}`}
          onFirmar={(i) => ejecutar(() => api.firmarAvance(proyecto.id_proyecto, periodo.numero, i), 'Firma registrada.')}
          extras={<FilaRevisadoPor revisado={periodo.revisado_por} radicado={periodo.estado === 'Radicado'} numero={periodo.firmas.length + 1} />}
        />

        {esInvestigador && abierto && hayFirmas && (
          <div className="seg-acciones">
            <button type="button" className="seg-btn seg-btn-borde" disabled={ocupado} onClick={() => ejecutar(() => api.reabrirAvance(proyecto.id_proyecto, periodo.numero), 'Informe reabierto: las firmas se borraron.')}>
              Volver a editar (borra las firmas)
            </button>
            <button type="button" className="seg-btn" disabled={ocupado || siguienteFirma(periodo.firmas) !== -1} onClick={() => setConfirmarRadicar(true)}>
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
