import { useEffect, useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { Eye, Lock, Minus, Plus } from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import * as api from '../api/seguimiento'
import type { DetalleAvance, Evidencia, PeriodoInforme } from '../api/tipos'
import { formatoFecha } from '../lib/formato'
import {
  MESES_POR_PERIODO,
  SEMANAS_POR_MES,
  SEMANAS_POR_PERIODO,
  anioPeriodo,
  duracionTotal,
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
  puedeFirmarFila,
  actividadEnPeriodo,
  mesInicialPeriodo,
} from '../lib/reglas'
import { Evidencias } from './Evidencias'
import { Aviso, Badge, CampoLectura, Decision, FilaRevisadoPor, FirmasSecuenciales } from './UI'
import type { PropsPestana } from './props'


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
            <button
              type="button"
              className="seg-btn seg-btn-sm seg-btn-borde"
              disabled={ocupado || p.estado !== 'Programado'}
              title={p.estado !== 'Programado' ? 'Este periodo ya tiene información registrada: no se regenera' : 'Recalcula las fechas de este periodo con la fecha de inicio y la duración del acta'}
              onClick={() => ejecutar(() => api.ajustarFechasPeriodo(idProyecto, p.numero, { restablecer: true }), `Periodo ${p.numero} regenerado: fechas recalculadas.`)}
            >
              Regenerar
            </button>
          </div>
        ) : (
          <span className="seg-ayuda">Informe aprobado</span>
        )}
      </td>
    </tr>
  )
}

const ALTO_MINIMO = 64
const ALTO_RECORTADO = 120

/** Cuadro de texto que crece con lo escrito; si pasa de unas líneas se recorta y un botón + / − en la esquina lo despliega. */
function TextoAutoajustable(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [expandido, setExpandido] = useState(false)
  const [largo, setLargo] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    // scrollHeight no incluye el borde: se suma para que el cuadro no quede más chico que su texto.
    const completo = el.scrollHeight + (el.offsetHeight - el.clientHeight)
    setLargo(completo > ALTO_RECORTADO)
    el.style.height = `${Math.max(ALTO_MINIMO, expandido || completo <= ALTO_RECORTADO ? completo : ALTO_RECORTADO)}px`
  }, [props.value, expandido])
  return (
    <div className="seg-texto-auto">
      <textarea ref={ref} rows={1} {...props} style={{ paddingRight: 26 }} />
      {largo && (
        <button
          type="button"
          className="seg-ver-mas"
          title={expandido ? 'Ver menos' : 'Ver más'}
          aria-label={expandido ? 'Ver menos' : 'Ver más'}
          onClick={() => setExpandido((v) => !v)}
        >
          {expandido ? <Minus size={12} /> : <Plus size={12} />}
        </button>
      )}
    </div>
  )
}

function AvancesTab({ proyecto, roles, ejecutar, ocupado, bloqueado }: PropsPestana) {
  const esAdmin = roles.includes('administrador')
  const esInvestigador = roles.includes('usuario')
  const [numero, setNumero] = useState(() => periodoInicial(proyecto.periodos))
  const periodo = proyecto.periodos.find((p) => p.numero === numero) ?? proyecto.periodos[0]
  const [detalle, setDetalle] = useState<DetalleAvance[]>(() => periodo?.detalle ?? [])
  // Una sola observación para todo el informe.
  const [observacion, setObservacion] = useState(() => periodo?.observacion_general ?? '')
  const [confirmarRadicar, setConfirmarRadicar] = useState(false)

  // Al cambiar de periodo o recargar el proyecto se descarta el borrador local.
  useEffect(() => {
    setDetalle(periodo?.detalle ?? [])
    setObservacion(periodo?.observacion_general ?? '')
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
        Los periodos son semestrales y se calculan con la fecha de inicio y la duración del acta de inicio. Cada periodo se puede
        regenerar por separado (recalcula sus fechas) mientras no tenga información registrada.
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
      {!bloqueado && proyecto.periodos.length === 0 && (
        <div className="seg-acciones">
          <button
            type="button"
            className="seg-btn"
            disabled={ocupado}
            onClick={() => ejecutar(() => api.regenerarPeriodos(proyecto.id_proyecto), 'Periodos regenerados.')}
          >
            Generar periodos
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
  const sinGuardar = JSON.stringify(detalle) !== JSON.stringify(periodo.detalle) || observacion !== (periodo.observacion_general ?? '')
  const faltantes = camposFaltantes(borrador)
  // El informe se va sumando: primero lo cargado en los periodos anteriores, en orden, y al final el periodo que se diligencia.
  const periodosPrevios = proyecto.periodos.filter((x) => x.numero < periodo.numero).sort((a, b) => a.numero - b.numero)
  const hayFirmas = periodo.firmas.some((f) => f.firmado)
  // El informe solo se puede ver cuando ya se radicó (o ya fue aprobado).
  const informeListoParaVer = periodo.estado === 'Radicado' || periodo.estado === 'Aprobado'
  const { equipo } = proyecto

  const cambiar = (i: number, cambio: Partial<DetalleAvance>) =>
    setDetalle((prev) => prev.map((d, j) => (j === i ? { ...d, ...cambio } : d)))

  const alternarSemana = (i: number, semana: number) => cambiar(i, { semanas: detalle[i].semanas.map((v, s) => (s === semana ? !v : v)) })

  const tablaCronograma = (pe: PeriodoInforme, det: DetalleAvance[], editar: boolean) => (
  <div className="seg-tabla-wrap">
    <table className="seg-tabla seg-cronograma">
      {/* Anchos en porcentaje: todo el cronograma (incluidos los últimos meses y las evidencias) cabe a la vista. */}
      <colgroup>
        {['13%', '11%', '13%', '10%'].map((w, k) => <col key={k} style={{ width: w }} />)}
        {SEMANAS.map((s) => <col key={s} style={{ width: '1.6%' }} />)}
        <col style={{ width: '14%' }} />
      </colgroup>
      <thead>
        <tr>
          <th rowSpan={2}>Objetivos específicos</th>
          <th rowSpan={2}>Meta</th>
          <th rowSpan={2}>Actividades</th>
          <th rowSpan={2}>Responsable</th>
          <th colSpan={SEMANAS_POR_PERIODO} className="c">Período {pe.numero} Año {anioPeriodo(pe)}</th>
          <th rowSpan={2}>Evidencias</th>
        </tr>
        <tr>
          {MESES.map((m) => <th key={m} colSpan={SEMANAS_POR_MES} className="c seg-mes">Mes {mesInicialPeriodo(pe.numero) + m}</th>)}
        </tr>
      </thead>
      <tbody>
        {proyecto.metas.map((m, i) => {
          const d = det[i]
          if (!d || !actividadEnPeriodo(m, pe.numero)) return null
          return (
            <tr key={i}>
              {(['objetivo', 'meta', 'actividad', 'responsable'] as const).map((campo) => (
                <td key={campo}>
                  {editar ? (
                    <TextoAutoajustable
                      className="seg-celda-texto"
                      maxLength={1000}
                      aria-label={campo}
                      value={d[campo] ?? m[campo]}
                      onChange={(e) => cambiar(i, { [campo]: e.target.value })}
                    />
                  ) : (
                    d[campo] ?? m[campo]
                  )}
                </td>
              ))}
              {SEMANAS.map((s) => (
                <td key={s} className={`seg-semana ${s % SEMANAS_POR_MES === 0 ? 'seg-semana-mes' : ''}`}>
                  <button
                    type="button"
                    disabled={!editar}
                    aria-pressed={!!d.semanas[s]}
                    aria-label={`${d.actividad ?? m.actividad}: mes ${mesInicialPeriodo(pe.numero) + Math.floor(s / SEMANAS_POR_MES)}, semana ${(s % SEMANAS_POR_MES) + 1}`}
                    className={d.semanas[s] ? 'seg-semana-on' : ''}
                    onClick={() => alternarSemana(i, s)}
                  />
                </td>
              ))}
              <td>
                <Evidencias
                  evidencias={d.evidencias}
                  editable={editar}
                  onAgregar={(ev) => agregarEvidencia(i, ev)}
                  onQuitar={(k) => quitarEvidencia(i, k)}
                />
                {editar && d.semanas.some(Boolean) && d.evidencias.length === 0 && <small className="seg-error-campo">Evidencia obligatoria</small>}
              </td>
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

  const guardar = () => ejecutar(() => api.guardarAvance(proyecto.id_proyecto, periodo.numero, detalle, observacion), 'Informe guardado.')
  const descargar = async () => {
    const { verPdfAvance } = await import('../lib/pdfAvance')
    await verPdfAvance(proyecto, borrador)
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
        </div>
        {periodo.observacion_revision && (
          <Aviso tipo="error"><b>Devuelto por el Administrador:</b> {periodo.observacion_revision}</Aviso>
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

        {periodosPrevios.map((previo) => (
          <div key={previo.numero}>
            <h4>Cronograma del periodo {previo.numero}</h4>
            {tablaCronograma(previo, previo.detalle, false)}
            {previo.observacion_general && <p className="seg-ayuda"><b>Observaciones del periodo {previo.numero}:</b> {previo.observacion_general}</p>}
          </div>
        ))}

        <h4>Cronograma del periodo {periodo.numero}</h4>
        {editable && <p className="seg-ayuda">Marca las semanas en que se trabajó cada actividad (4 semanas por mes).</p>}
        {tablaCronograma(periodo, detalle, editable)}

        <h4>Observaciones del informe</h4>
        <TextoAutoajustable
          className="seg-celda-texto"
          maxLength={1000}
          disabled={!editable}
          value={observacion}
          placeholder="Observaciones generales del periodo (opcional)"
          style={{ width: '100%', minHeight: 80 }}
          onChange={(e) => setObservacion(e.target.value)}
        />

        <p className="seg-ayuda" style={{ marginTop: 10 }}>
          <b>Nota:</b> adjuntar las evidencias del avance de actividades según el cronograma.
        </p>
        {editable && faltantes.length > 0 && (
          <Aviso tipo="error">
            Para guardar el informe y enviarlo a revisión completa los campos de lo que realizaste:
            <ul>{faltantes.map((x) => <li key={x}>{x}</li>)}</ul>
          </Aviso>
        )}
        <div className="seg-acciones seg-acciones-izq">
          {editable && (
            <button type="button" className="seg-btn" disabled={ocupado || faltantes.length > 0 || (!sinGuardar && periodo.estado !== 'Programado')} onClick={guardar}>Guardar informe</button>
          )}
          <button
            type="button"
            className="seg-btn seg-btn-sec"
            disabled={ocupado || !informeListoParaVer}
            title={informeListoParaVer ? undefined : 'Disponible cuando el informe se haya radicado'}
            onClick={() => ejecutar(descargar, '')}
          >
            <Eye size={14} /> Ver informe
          </button>
        </div>

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
          puedeFirmar={(f) => puedeFirmarFila(f, roles)}
          textoConfirmacion="Vas a firmar el informe de avance. Después de firmar ya no se puede editar, salvo que se reabra."
          idProyecto={proyecto.id_proyecto}
          documento={`informe de avance ${periodo.numero}`}
          onFirmar={(i) => ejecutar(() => api.firmarAvance(proyecto.id_proyecto, periodo.numero, i), 'Firma registrada.')}
          onSolicitar={esInvestigador ? (i) => ejecutar(() => api.solicitarFirmaAvance(proyecto.id_proyecto, periodo.numero, i), 'Solicitud enviada al co-investigador: le llegó una notificación y un correo para iniciar sesión y firmar.') : undefined}
          extras={
            <FilaRevisadoPor
              revisado={periodo.revisado_por}
              radicado={periodo.estado === 'Radicado'}
              numero={periodo.firmas.length + 1}
              accion={
                esAdmin && !bloqueado && periodo.estado === 'Radicado' ? (
                  <Decision
                    ocupado={ocupado}
                    obligatoria={false}
                    sinObservacion
                    botones={[
                      { etiqueta: 'Aprobar', conRevisor: true, onClick: (obs, revisor) => ejecutar(() => api.revisarAvance(proyecto.id_proyecto, periodo.numero, 'Aprobado', obs, revisor), `Informe del periodo ${periodo.numero} aprobado.`) },
                    ]}
                  />
                ) : undefined
              }
            />
          }
        />

        {periodo.estado === 'Radicado' && (
          <Aviso tipo="ok">
            <b>Informe del periodo {periodo.numero} radicado.</b> Queda en revisión del Administrador: cuando lo apruebe firma como quien lo revisó y se
            agrega su sello al informe.
          </Aviso>
        )}

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
          mensaje={`¿Radicar el informe de avance del periodo ${periodo.numero}? Ya no podrás editarlo hasta que el Administrador lo revise.`}
          onClose={() => setConfirmarRadicar(false)}
          botonSecundario={{ label: 'Cancelar', onClick: () => setConfirmarRadicar(false), variante: 'rojo' }}
          botonPrimario={{
            label: 'Radicar',
            variante: 'azul',
            onClick: () => {
              setConfirmarRadicar(false)
              ejecutar(() => api.radicarAvance(proyecto.id_proyecto, periodo.numero), '')
            },
          }}
        />
      )}
    </>
  )
}

export default AvancesTab
