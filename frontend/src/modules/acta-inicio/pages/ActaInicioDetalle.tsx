import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Plus, Trash2 } from 'lucide-react'
import * as actaApi from '../api/actaInicio'
import {
  ETIQUETA_ESTADO_ACTA,
  bloqueosGeneracion,
  calcularFechaFin,
  camposContacto,
  aniosDeEjecucion,
  clausulasPendientes,
  faltantesContacto,
  esFirmaDeInvestigador,
  esFirmaOpcional,
  firmaDeCuenta,
  formatoPesos,
  requisitosDeFirma,
  sumaVigencias,
  textoAperturaActa,
  validarDatosActa,
} from '../lib/actaInicio'
import { CLAUSULAS, CONSIDERACIONES_FINALES, RUBROS_ANTELACION, VERSION_TEXTOS } from '../lib/textosLegales'
import { useAuth } from '../../auth/context/AuthContext'
import { getRolesEfectivos } from '../../auth/lib/auth'
import { ApiError } from '../../../shared/api/client'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import './ActaInicio.css'

const fechaInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')
const fechaLegible = (iso: string) => iso.split('-').reverse().join('/')

/** Acta de inicio y compromisos, en el mismo orden de numerales del formato INV-IC-FR-017 v5. */
function ActaInicioDetalle() {
  const { id } = useParams()
  const id_proyecto = Number(id)
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const roles = getRolesEfectivos()
  const esAdmin = roles.includes('administrador')

  const [acta, setActa] = useState<actaApi.ActaInicioDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  // Resultado de guardar los datos de un participante: se muestra junto a la tabla, no arriba de la página.
  const [resultadoContacto, setResultadoContacto] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmarFirma, setConfirmarFirma] = useState(false)
  const [confirmarPorTodos, setConfirmarPorTodos] = useState(false)
  const [confirmarComoVicerrector, setConfirmarComoVicerrector] = useState(false)
  const [confirmarReinicio, setConfirmarReinicio] = useState(false)
  const [confirmarReabrir, setConfirmarReabrir] = useState(false)

  const [datos, setDatos] = useState<actaApi.DatosActaInicio>({
    tipo_proyecto: '',
    numero_acta_aprobacion: '',
    fecha_acta_aprobacion: '',
    centro_costos: '',
    fecha_inicio: '',
    duracion_meses: 0,
    vigencias: [],
  })
  const [contactos, setContactos] = useState<Record<number, actaApi.DatosContacto>>({})
  // El Vicerrector solo firma (no tiene cuenta): su enlace llega al correo que se indique aquí.
  const [vicerrector, setVicerrector] = useState({ nombre: '', correo: '' })

  const cargar = useCallback(() => {
    setCargando(true)
    actaApi
      .obtenerActaInicio(id_proyecto)
      .then((a) => {
        setActa(a)
        setVicerrector((v) => ({
          nombre: v.nombre || (a.vicerrector_sugerido?.nombre ?? 'Vicerrector de Investigación y Extensión'),
          correo: v.correo || (a.vicerrector_correo ?? a.vicerrector_sugerido?.correo ?? ''),
        }))
        setDatos({
          tipo_proyecto: a.tipo_proyecto ?? '',
          numero_acta_aprobacion: a.numero_acta_aprobacion ?? '',
          fecha_acta_aprobacion: fechaInput(a.fecha_acta_aprobacion),
          centro_costos: a.centro_costos ?? '',
          fecha_inicio: fechaInput(a.fecha_inicio),
          duracion_meses: a.duracion_meses ?? 0,
          vigencias: a.vigencias,
        })
        setContactos(
          Object.fromEntries(
            a.participantes.map((p) => [
              p.id_usuarioproyecto,
              { identificacion: p.identificacion, telefono: p.telefono, correo: p.correo, programa_academico: p.programa_academico, institucion: p.institucion },
            ])
          )
        )
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el acta de inicio.'))
      .finally(() => setCargando(false))
  }, [id_proyecto])

  useEffect(() => {
    cargar()
  }, [cargar])

  const ejecutar = async (accion: () => Promise<unknown>, mensajeOk: string) => {
    setOcupado(true)
    setError('')
    setAviso('')
    try {
      await accion()
      setAviso(mensajeOk)
      cargar()
    } catch (err) {
      const detalle = err instanceof ApiError && err.faltantes?.length ? ` ${err.faltantes.join(' ')}` : ''
      setError((err instanceof ApiError ? err.message : 'No se pudo completar la acción.') + detalle)
    } finally {
      setOcupado(false)
    }
  }

  const guardarContacto = async (p: actaApi.ParticipanteActa, c: actaApi.DatosContacto) => {
    setOcupado(true)
    setError('')
    setAviso('')
    setResultadoContacto(null)
    try {
      await actaApi.guardarContactoParticipante(id_proyecto, p.id_usuarioproyecto, c)
      setResultadoContacto({ tipo: 'ok', texto: `Datos de ${p.nombre} guardados.` })
      cargar()
    } catch (err) {
      const detalle = err instanceof ApiError && err.faltantes?.length ? ` ${err.faltantes.join(' ')}` : ''
      setResultadoContacto({ tipo: 'error', texto: (err instanceof ApiError ? err.message : 'No se pudieron guardar los datos.') + detalle })
    } finally {
      setOcupado(false)
    }
  }

  const cambiarContacto = (id_usuarioproyecto: number, clave: keyof actaApi.DatosContacto, valor: string) =>
    setContactos((prev) => ({ ...prev, [id_usuarioproyecto]: { ...prev[id_usuarioproyecto], [clave]: valor } }))

  const erroresDatos = useMemo(() => (acta ? validarDatosActa(datos, acta.valor_solicitado_unicesmag) : []), [datos, acta])

  if (cargando && !acta) return <p className="acta-vacio">Cargando acta de inicio...</p>
  if (!acta) return <p className="acta-error">{error || 'No se encontró el proyecto.'}</p>

  const id_acta = acta.id_acta_inicio
  const legalizada = acta.estado === 'legalizada'
  // Después de generar el PDF los datos quedan congelados: lo firmado debe coincidir con lo guardado.
  const enElaboracion = acta.estado === 'en elaboracion'
  const editable = esAdmin && enElaboracion
  const fechaFin = calcularFechaFin(datos.fecha_inicio, datos.duracion_meses)
  const sumaCuadra = sumaVigencias(datos.vigencias) === acta.valor_solicitado_unicesmag
  // Los años de la financiación son los de la ejecución: de la fecha de inicio a la de fin.
  const aniosPermitidos = aniosDeEjecucion(datos.fecha_inicio, datos.duracion_meses)
  const aniosUsados = new Set(datos.vigencias.map((v) => v.anio))
  const aniosLibres = aniosPermitidos.filter((a) => !aniosUsados.has(a))
  const bloqueos = bloqueosGeneracion(acta)
  const correoViceValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vicerrector.correo.trim())

  const firmasOrdenadas = [...acta.firmas].sort((a, b) => a.orden_firma - b.orden_firma)
  // El acta se legaliza con la última firma obligatoria: la de los co-investigadores es opcional.
  const esUltimaFirma = firmasOrdenadas.filter((f) => !f.firmado && !esFirmaOpcional(f)).length === 1
  // La firma que esta cuenta puede dar ahora: cada investigador firma cuando haya aceptado sus numerales.
  const miFirma = firmaDeCuenta(acta, usuario?.id_usuario, roles)
  const esMiTurno = !!miFirma
  const puedoFirmar = requisitosDeFirma(acta, miFirma)
  // Aceptación del grupo: todos los participantes tienen los cuatro numerales aceptados.
  const grupoAcepto = acta.participantes.length > 0 && acta.participantes.every((p) => clausulasPendientes(acta, p.id_usuarioproyecto).length === 0)

  // Participante por el que actúa la sesión: el que corresponde a su propio usuario.
  const miParticipante = acta.participantes.find((p) => p.id_usuario === usuario?.id_usuario) ?? null
  const pendientes = miParticipante ? clausulasPendientes(acta, miParticipante.id_usuarioproyecto) : []
  // Modo de pruebas (lo activa el backend): un investigador firma por todos y el Administrador por el Vicerrector.
  const modoPrueba = !!acta.modo_prueba_firmas && acta.estado === 'en firma'
  const investigadoresSinFirmar = firmasOrdenadas.filter((f) => !f.firmado && esFirmaDeInvestigador(f))
  const vicerrectorSinFirmar = firmasOrdenadas.find((f) => !f.firmado && f.rol_firmante === 'Vicerrector')
  const puedoFirmarPorTodos = modoPrueba && !!miParticipante && grupoAcepto && investigadoresSinFirmar.length > 0
  const puedoFirmarComoVicerrector = modoPrueba && esAdmin && grupoAcepto && !!vicerrectorSinFirmar && !investigadoresSinFirmar.some((f) => f.rol_firmante === 'investigador principal')

  const setVigencia = (i: number, cambio: Partial<actaApi.VigenciaActa>) =>
    setDatos((d) => ({ ...d, vigencias: d.vigencias.map((v, j) => (j === i ? { ...v, ...cambio } : v)) }))

  const descargar = (tipo: 'generado' | 'firmado') =>
    id_acta !== null &&
    ejecutar(() => actaApi.descargarActa(id_proyecto, tipo, `acta-inicio-${id_proyecto}${tipo === 'firmado' ? '-firmada' : ''}.pdf`), 'PDF del acta descargado.')

  return (
    <div className="acta-page">
      <div className="acta-card acta-header">
        <button type="button" className="acta-link" onClick={() => navigate('/acta-inicio')}>
          <ArrowLeft size={14} /> Volver
        </button>
        <h2>Acta de inicio y compromisos — {acta.titulo}</h2>
        <div className="acta-acciones acta-centrado">
          <span className={`acta-badge acta-badge-${acta.estado.replace(' ', '-')}`}>{ETIQUETA_ESTADO_ACTA[acta.estado]}</span>
          <span className="acta-nota">Formato {VERSION_TEXTOS} · {acta.convocatoria}</span>
        </div>
        {!legalizada && (
          <p className="acta-nota">El PDF del acta se genera cuando todos los firmantes hayan firmado.</p>
        )}
        {esAdmin && acta.modo_prueba_firmas && id_acta !== null && (
          <button type="button" className="acta-btn acta-btn-sec" disabled={ocupado} onClick={() => setConfirmarReinicio(true)}>
            Reiniciar acta
          </button>
        )}
      </div>

      {error && <p className="acta-error">{error}</p>}
      {aviso && <p className="acta-ok acta-aviso-ok">{aviso}</p>}

      {/* Por qué los campos están (o no) habilitados: evita quedarse sin saber cómo continuar. */}
      {enElaboracion && esAdmin && (
        <p className="acta-info">
          <b>Acta en elaboración.</b> Diligencia la fecha de inicio y la duración, el tipo de proyecto (numeral 2) y la aprobación (numeral 3), guarda, completa
          los datos de los participantes (numeral 4) y genera el acta.
        </p>
      )}
      {enElaboracion && !esAdmin && (
        <p className="acta-info">
          <b>Acta en elaboración.</b> Los numerales 1 a 3 los diligencia el Administrador; entra con ese rol para ingresarlos. Con tu rol puedes completar los
          datos de contacto de los participantes (numeral 4).
        </p>
      )}
      {acta.estado === 'en firma' && (
        <div className="acta-info">
          <b>Acta generada y en firma.</b> Sus datos quedaron congelados para que lo firmado coincida con lo guardado; por eso los campos no se pueden editar.
          {esAdmin && id_acta !== null && (
            <div>
              <button type="button" className="acta-btn acta-btn-sec" disabled={ocupado} onClick={() => setConfirmarReabrir(true)}>
                Volver a elaboración para corregir datos
              </button>
            </div>
          )}
        </div>
      )}
      {legalizada && <p className="acta-info"><b>Acta legalizada.</b> Es de solo lectura: el proyecto ya está en ejecución y continúa en Seguimiento.</p>}

      {/* Texto de apertura: presenta el proyecto del acta (también va en el PDF). */}
      <section className="acta-card acta-apertura">
        {textoAperturaActa(acta).map((p) => <p key={p}>{p}</p>)}
      </section>

      {/* Numeral 1 — HU-84 */}
      <section className="acta-card">
        <h3>1. Información general del proyecto de investigación</h3>
        <dl className="acta-ficha">
          <dt>Título del proyecto</dt>
          <dd>{acta.titulo}</dd>
          <dt>Objetivo general</dt>
          <dd>{acta.objetivo_general}</dd>
          <dt>Objetivos específicos</dt>
          <dd>
            <ol>{acta.objetivos_especificos.map((o) => <li key={o}>{o}</li>)}</ol>
          </dd>
          {acta.programas && acta.programas.length > 0 && (
            <>
              <dt>Programa(s) académico(s)</dt>
              <dd>{acta.programas.join(', ')}</dd>
            </>
          )}
        </dl>
        <div className="acta-tabla-wrap">
          <table className="acta-tabla">
            <thead>
              <tr><th>Grupo de investigación</th><th>IES / Entidad</th></tr>
            </thead>
            <tbody>
              {acta.grupos.map((g) => (
                <tr key={`${g.grupo}-${g.entidad}`}><td>{g.grupo}</td><td>{g.entidad}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="acta-nota">Esta información viene de la formulación aprobada y es de solo lectura.</p>

        <h4>Duración del proyecto</h4>
        <div className="acta-grid">
          <label>
            Fecha de inicio *
            <input type="date" disabled={!editable} value={datos.fecha_inicio} onChange={(e) => setDatos({ ...datos, fecha_inicio: e.target.value })} />
          </label>
          <label>
            Duración (meses) *
            <input type="number" min={1} disabled={!editable} value={datos.duracion_meses || ''} onChange={(e) => setDatos({ ...datos, duracion_meses: Number(e.target.value) })} />
          </label>
          <label>
            Fecha de finalización (calculada)
            <input disabled value={fechaFin ? fechaLegible(fechaFin) : ''} />
          </label>
        </div>
      </section>

      {/* Numeral 2 */}
      <section className="acta-card">
        <h3>2. Tipo de proyecto</h3>
        {acta.tipo_proyecto ? (
          <>
            <p><b>{acta.tipo_proyecto}</b></p>
            <p className="acta-nota">Este dato viene de la aprobación del proyecto y no se modifica desde el acta.</p>
          </>
        ) : (
          <>
            <p className="acta-nota">La modalidad del proyecto no corresponde a ninguno de los tipos del formato: selecciónalo.</p>
            <div className="acta-opciones">
              {actaApi.TIPOS_PROYECTO.map((tipo) => (
                <label key={tipo} className={`acta-opcion ${datos.tipo_proyecto === tipo ? 'acta-opcion-activa' : ''}`}>
                  <input type="radio" name="tipo_proyecto" disabled={!editable} checked={datos.tipo_proyecto === tipo} onChange={() => setDatos({ ...datos, tipo_proyecto: tipo })} />
                  {tipo}
                </label>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Numeral 3 — HU-82, 83, 85 */}
      <section className="acta-card">
        <h3>3. Aprobación del proyecto</h3>
        <div className="acta-grid">
          <label>
            Acta No. *
            <input inputMode="numeric" maxLength={30} disabled={!editable} value={datos.numero_acta_aprobacion} onChange={(e) => setDatos({ ...datos, numero_acta_aprobacion: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label>
            Fecha del acta *
            <input type="date" max={new Date().toISOString().slice(0, 10)} disabled={!editable} value={datos.fecha_acta_aprobacion} onChange={(e) => setDatos({ ...datos, fecha_acta_aprobacion: e.target.value })} />
          </label>
          <label>
            Centro de costos *
            <input inputMode="numeric" maxLength={20} disabled={!editable} value={datos.centro_costos} onChange={(e) => setDatos({ ...datos, centro_costos: e.target.value.replace(/\D/g, '') })} />
          </label>
        </div>

        <h4>Financiación interna del proyecto</h4>
        <p className="acta-nota">Valor solicitado a UNICESMAG: {formatoPesos(acta.valor_solicitado_unicesmag)}. El costo de cada año debe sumar ese valor.</p>
        {datos.vigencias.map((v, i) => (
          <div key={i} className="acta-fila-vigencia">
            <span className="acta-nota">Costo</span>
            <select aria-label="Año" disabled={!editable} value={v.anio || ''} onChange={(e) => setVigencia(i, { anio: Number(e.target.value) })}>
              {!aniosPermitidos.includes(v.anio) && <option value={v.anio || ''}>{v.anio || 'Año'}</option>}
              {aniosPermitidos.filter((a) => a === v.anio || !aniosUsados.has(a)).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <input type="number" placeholder="Valor asignado" aria-label="Valor asignado" disabled={!editable} value={v.valor_asignado || ''} onChange={(e) => setVigencia(i, { valor_asignado: Number(e.target.value) })} />
            <span className="acta-nota">{formatoPesos(v.valor_asignado)}</span>
            {editable && (
              <button type="button" className="acta-icono" aria-label="Quitar año" onClick={() => setDatos((d) => ({ ...d, vigencias: d.vigencias.filter((_, j) => j !== i) }))}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {editable && aniosLibres.length > 0 && (
          <button type="button" className="acta-link" onClick={() => setDatos((d) => ({ ...d, vigencias: [...d.vigencias, { anio: aniosLibres[0], valor_asignado: 0 }] }))}>
            <Plus size={14} /> Agregar año
          </button>
        )}
        {editable && aniosPermitidos.length === 0 && (
          <p className="acta-nota">Indica la fecha de inicio y la duración para elegir los años de la financiación.</p>
        )}
        {editable && aniosPermitidos.length > 0 && aniosLibres.length === 0 && (
          <p className="acta-nota">
            Ya registraste todos los años de la ejecución ({aniosPermitidos[0]}
            {aniosPermitidos.length > 1 ? `–${aniosPermitidos[aniosPermitidos.length - 1]}` : ''}).
          </p>
        )}
        {datos.vigencias.length > 0 && (
          <p className={sumaCuadra ? 'acta-ok' : 'acta-nota'}>
            Suma: {formatoPesos(sumaVigencias(datos.vigencias))}
            {sumaCuadra ? ' · coincide con el valor solicitado' : ` · diferencia de ${formatoPesos(Math.abs(sumaVigencias(datos.vigencias) - acta.valor_solicitado_unicesmag))}`}
          </p>
        )}

        {editable && (
          <>
            {erroresDatos.length > 0 && <ul className="acta-lista-error">{erroresDatos.map((e) => <li key={e}>{e}</li>)}</ul>}
            <button type="button" className="acta-btn" disabled={ocupado || erroresDatos.length > 0} onClick={() => ejecutar(() => actaApi.guardarDatosActa(id_proyecto, datos), 'Datos del acta guardados (numerales 1 a 3).')}>
              Guardar datos de los numerales 1 a 3
            </button>
          </>
        )}
      </section>

      {/* Numeral 4 — HU-86 */}
      <section className="acta-card acta-tabla-wrap">
        <h3>4. Información general de los participantes</h3>
        <table className="acta-tabla">
          <thead>
            <tr>
              <th>Participante</th>
              {camposContacto().map((c) => <th key={c.clave}>{c.etiqueta}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {acta.participantes.map((p) => {
              const puedeEditar = enElaboracion && (esAdmin || p.id_usuario === usuario?.id_usuario)
              const c = contactos[p.id_usuarioproyecto]
              return (
                <tr key={p.id_usuarioproyecto}>
                  <td>{p.nombre}<br /><small>{p.rol}</small></td>
                  {camposContacto().map(({ clave }) => (
                    <td key={clave}>
                      <input disabled={!puedeEditar} value={c?.[clave] ?? ''} onChange={(e) => cambiarContacto(p.id_usuarioproyecto, clave, e.target.value)} />
                    </td>
                  ))}
                  <td>
                    {puedeEditar && (
                      <button type="button" className="acta-btn" disabled={ocupado} onClick={() => guardarContacto(p, c)}>
                        Guardar
                      </button>
                    )}
                    {faltantesContacto(p).length > 0 && <small className="acta-nota"> Incompleto</small>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {resultadoContacto && (
          <p role="status" className={resultadoContacto.tipo === 'ok' ? 'acta-ok acta-aviso-ok' : 'acta-error'} style={{ marginTop: 10 }}>
            {resultadoContacto.texto}
          </p>
        )}
      </section>

      {/* HU-87 */}
      {esAdmin && enElaboracion && (
        <section className="acta-card">
          <h3>Generar el acta y enviarla a firma</h3>
          {id_acta === null ? (
            <p className="acta-nota">Primero guarda los datos de los numerales 1 a 3.</p>
          ) : (
            <>
              {bloqueos.length > 0 ? (
                <ul className="acta-lista-error">{bloqueos.map((b) => <li key={b}>{b}</li>)}</ul>
              ) : (
                <p className="acta-nota">Al generarla, los datos quedan congelados y los participantes pueden aceptar los compromisos y firmar.</p>
              )}
              <h4>Firma del Vicerrector</h4>
              <p className="acta-nota">
                El Vicerrector solo firma: no necesita cuenta. Cuando todos los investigadores hayan firmado, recibe un enlace personal en el
                correo que indiques y firma con un click.
              </p>
              <div className="acta-grid">
                <label>
                  Nombre del Vicerrector
                  <input value={vicerrector.nombre} onChange={(e) => setVicerrector({ ...vicerrector, nombre: e.target.value })} />
                </label>
                <label>
                  Correo del Vicerrector *
                  <input type="email" placeholder="vicerrector@unicesmag.edu.co" value={vicerrector.correo} onChange={(e) => setVicerrector({ ...vicerrector, correo: e.target.value })} />
                </label>
              </div>
              {!correoViceValido && <p className="acta-nota">Escribe un correo válido para el Vicerrector.</p>}
              <button
                type="button"
                className="acta-btn"
                disabled={ocupado || bloqueos.length > 0 || !correoViceValido}
                onClick={() => ejecutar(() => actaApi.generarActaInicio(id_acta, vicerrector), 'Acta generada y enviada a firma.')}
              >
                Generar acta INV-IC-FR-017
              </button>
            </>
          )}
        </section>
      )}

      {/* Numerales 5 a 10 — HU-92 */}
      {!enElaboracion && id_acta !== null && (
        <section className="acta-card">
          <h3>5 a 10. Compromisos y cláusulas del acta</h3>
          {miParticipante && pendientes.length > 0 && !legalizada ? (
            <p className="acta-nota">
              Lee y acepta cada numeral por separado, uno por uno. La aceptación es del grupo: lo que aceptes queda aceptado
              para todos los investigadores del acta, y nadie tiene que repetirlo. Cuando los cuatro numerales estén aceptados,
              cada investigador recibe en su correo su enlace personal de firma. De cada aceptación se guarda la fecha, la hora
              y la versión del texto ({VERSION_TEXTOS}).
            </p>
          ) : (
            <>
              <p className="acta-nota">Texto del acta según el formato {VERSION_TEXTOS}.</p>
              {!miParticipante && !legalizada && acta.estado === 'en firma' && (
                <p className="acta-info">
                  Esta cuenta no figura entre los investigadores del acta, por eso no puede aceptar los numerales ni firmar. Lo hace cada
                  investigador con su propia cuenta: {acta.participantes.map((p) => p.nombre).join(', ')}.
                </p>
              )}
            </>
          )}

          {CLAUSULAS.map((c) => {
            const porAceptar = !legalizada && pendientes.includes(c.tipo)
            const aceptadaEl = miParticipante
              ? acta.compromisos.find((x) => x.id_usuarioproyecto === miParticipante.id_usuarioproyecto && x.tipo_clausula === c.tipo && x.aceptado)?.fecha_aceptacion
              : null
            return (
              <Fragment key={c.tipo}>
              <details className="acta-clausula-bloque" open={porAceptar}>
                <summary>{c.titulo}</summary>
                <div className="acta-clausula-texto">{c.parrafos.map((p) => <p key={p}>{p}</p>)}</div>
                {porAceptar && miParticipante && (
                  <div className="acta-clausula">
                    <button
                      type="button"
                      className="acta-btn"
                      disabled={ocupado}
                      onClick={() => ejecutar(() => actaApi.aceptarCompromisos(id_acta, VERSION_TEXTOS, [c.tipo]), `Aceptaste el numeral “${c.titulo}”.`)}
                    >
                      He leído y acepto este numeral
                    </button>
                  </div>
                )}
                {!porAceptar && aceptadaEl && (
                  <p className="acta-ok">Aceptado el {new Date(aceptadaEl).toLocaleString('es-CO')}.</p>
                )}
              </details>
              {c.tipo === 'compromisos' && (
                <details className="acta-clausula-bloque">
                  <summary>6. Solicitudes para asignación de rubros</summary>
                  <table className="acta-tabla">
                    <thead><tr><th>Concepto</th><th>Tiempo</th></tr></thead>
                    <tbody>{RUBROS_ANTELACION.map(([concepto, tiempo]) => <tr key={concepto}><td>{concepto}</td><td>{tiempo}</td></tr>)}</tbody>
                  </table>
                </details>
              )}
              </Fragment>
            )
          })}
          <details className="acta-clausula-bloque">
            <summary>10. Consideraciones finales</summary>
            <div className="acta-clausula-texto">{CONSIDERACIONES_FINALES.map((p) => <p key={p}>{p}</p>)}</div>
          </details>

          {miParticipante && !legalizada && (
            <p className={pendientes.length === 0 ? 'acta-ok' : 'acta-nota'}>
              {pendientes.length === 0
                ? 'Los cuatro numerales están aceptados por el grupo. Cada investigador firma con el enlace personal que le llegó a su correo (un click), o con el botón de la sección Firmas.'
                : `${CLAUSULAS.length - pendientes.length} de ${CLAUSULAS.length} numerales aceptados. Faltan: ${CLAUSULAS.filter((c) => pendientes.includes(c.tipo)).map((c) => c.titulo).join('; ')}.`}
            </p>
          )}

          <h4>Aceptación por participante</h4>
          <ul className="acta-firmas">
            {acta.participantes.map((p) => {
              const faltan = clausulasPendientes(acta, p.id_usuarioproyecto).length
              return (
                <li key={p.id_usuarioproyecto} className={faltan === 0 ? 'firmada' : ''}>
                  {p.nombre} — {p.rol}
                  <small>{faltan === 0 ? ' · aceptó los cuatro numerales' : ` · ${CLAUSULAS.length - faltan} de ${CLAUSULAS.length} numerales aceptados`}</small>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* HU-88, 89 */}
      {acta.firmas.length > 0 && id_acta !== null && (
        <section className="acta-card">
          <h3>Firmas</h3>
          <ol className="acta-firmas">
            {firmasOrdenadas.map((f) => (
              <li key={f.id_firma} className={f.firmado ? 'firmada' : ''}>
                {f.nombre} — {f.rol_firmante}{esFirmaOpcional(f) ? ' (opcional)' : ''}
                <small>{f.firmado && f.fecha_firma ? ` · firmó ${new Date(f.fecha_firma).toLocaleString('es-CO')}` : ' · pendiente'}</small>
              </li>
            ))}
          </ol>
          {modoPrueba && (
            <p className="acta-info">
              <b>Modo de pruebas de firmas.</b> Mientras el correo no esté configurado, un investigador del acta puede firmar por todos los
              investigadores y el Administrador firma como Vicerrector. Las firmas quedan registradas igual que las reales.
            </p>
          )}
          {puedoFirmarPorTodos && (
            <div>
              <button type="button" className="acta-btn" disabled={ocupado} onClick={() => setConfirmarPorTodos(true)}>
                Firmar por todos los investigadores (modo pruebas)
              </button>
            </div>
          )}
          {puedoFirmarComoVicerrector && (
            <div>
              <button type="button" className="acta-btn" disabled={ocupado} onClick={() => setConfirmarComoVicerrector(true)}>
                Firmar como Vicerrector (modo pruebas)
              </button>
            </div>
          )}
          {esAdmin && acta.estado === 'en firma' && firmasOrdenadas.some((f) => f.rol_firmante === 'Vicerrector' && !f.firmado) && (
            <div>
              <p className="acta-nota">
                Vicerrector: {acta.vicerrector_correo ? `su enlace llega a ${acta.vicerrector_correo}.` : 'todavía no tiene correo: sin él no recibe su enlace de firma.'}
              </p>
              <div className="acta-grid">
                <label>
                  Nombre del Vicerrector
                  <input value={vicerrector.nombre} onChange={(e) => setVicerrector({ ...vicerrector, nombre: e.target.value })} />
                </label>
                <label>
                  Correo del Vicerrector
                  <input type="email" placeholder="vicerrector@unicesmag.edu.co" value={vicerrector.correo} onChange={(e) => setVicerrector({ ...vicerrector, correo: e.target.value })} />
                </label>
              </div>
              <button
                type="button"
                className="acta-btn acta-btn-sec"
                disabled={ocupado || !correoViceValido}
                onClick={() => ejecutar(() => actaApi.actualizarVicerrector(id_acta, vicerrector), 'Correo del Vicerrector guardado.')}
              >
                Guardar correo del Vicerrector
              </button>
            </div>
          )}
          {esAdmin && acta.estado === 'en firma' && grupoAcepto && firmasOrdenadas.some((f) => !f.firmado) && (
            <div>
              <p className="acta-nota">
                Los enlaces de firma salieron al correo de cada investigador (el del Vicerrector, cuando todos hayan firmado). Si alguien no
                lo recibió o ya venció, puedes reenviarlo.
              </p>
              <button
                type="button"
                className="acta-btn acta-btn-sec"
                disabled={ocupado}
                onClick={() => ejecutar(() => actaApi.reenviarEnlacesFirma(id_acta), 'Enlaces de firma reenviados.')}
              >
                Reenviar enlaces de firma
              </button>
            </div>
          )}
          {esMiTurno && miFirma && (
            <>
              {!puedoFirmar && (
                <p className="acta-nota">
                  {miFirma.rol_firmante === 'Vicerrector'
                    ? 'Todos los participantes deben aceptar los compromisos antes de la firma del Vicerrector.'
                    : 'Primero deben aceptarse los numerales 5, 7, 8 y 9: cualquier investigador del acta los acepta por el grupo.'}
                </p>
              )}
              <button type="button" className="acta-btn" disabled={ocupado || !puedoFirmar} onClick={() => setConfirmarFirma(true)}>
                {miFirma.rol_firmante === 'Administrador' ? 'Firmar como quien elabora el acta' : `Firmar como ${miFirma.nombre}`}
              </button>
            </>
          )}
          {acta.estado === 'en firma' && !esMiTurno && (
            <p className="acta-nota">
              {firmasOrdenadas.some((f) => f.firmado && f.id_usuario === usuario?.id_usuario && esFirmaDeInvestigador(f)) ? 'Ya firmaste. ' : ''}
              Firmas pendientes: {firmasOrdenadas.filter((f) => !f.firmado).map((f) => f.nombre).join(', ')}.
              {' '}El investigador principal firma con el enlace personal de su correo (la firma de los co-investigadores es opcional); después firma el Vicerrector y, por último, el Administrador (elaborado por).
            </p>
          )}
        </section>
      )}

      {/* HU-90, 91: con la última firma el acta queda legalizada. */}
      {legalizada && id_acta !== null && (
        <section className="acta-card">
          <h3>Acta legalizada</h3>
          <p className="acta-ok">
            Legalizada el {acta.fecha_legalizacion ? new Date(acta.fecha_legalizacion).toLocaleDateString('es-CO') : '—'} · firmada
            electrónicamente por {acta.firmas.filter((f) => f.firmado).length} firmantes.
          </p>
          <div className="acta-acciones">
            <button type="button" className="acta-btn acta-btn-sec" disabled={ocupado} onClick={() => descargar('firmado')}>
              <Download size={14} /> Descargar acta firmada
            </button>
            <button type="button" className="acta-btn" onClick={() => navigate(`/seguimiento/${id_proyecto}`)}>
              Ir al seguimiento del proyecto
            </button>
          </div>
        </section>
      )}

      {confirmarReabrir && id_acta !== null && (
        <ConfirmModal
          mensaje="¿Volver el acta a elaboración? Se borran las firmas y las aceptaciones registradas, y habrá que generarla de nuevo."
          onClose={() => setConfirmarReabrir(false)}
          botonSecundario={{ label: 'Cancelar', onClick: () => setConfirmarReabrir(false), variante: 'azul' }}
          botonPrimario={{
            label: 'Volver a elaboración',
            variante: 'rojo',
            onClick: () => {
              setConfirmarReabrir(false)
              ejecutar(() => actaApi.reabrirActaInicio(id_acta), 'El acta volvió a elaboración: ya puedes editar sus datos.')
            },
          }}
        />
      )}

      {confirmarReinicio && id_acta !== null && (
        <ConfirmModal
          mensaje={`Vas a reiniciar el acta de inicio de este proyecto: se borran los datos diligenciados, las aceptaciones y las firmas${legalizada ? ' (el acta ya está legalizada)' : ''}, y el proyecto vuelve a "Sin iniciar". No se puede deshacer.`}
          onClose={() => setConfirmarReinicio(false)}
          botonSecundario={{ label: 'Cancelar', onClick: () => setConfirmarReinicio(false), variante: 'rojo' }}
          botonPrimario={{
            label: 'Reiniciar acta',
            variante: 'azul',
            onClick: () => {
              setConfirmarReinicio(false)
              ejecutar(() => actaApi.reiniciarActaInicio(id_acta), 'Acta reiniciada: puedes diligenciarla de nuevo.')
            },
          }}
        />
      )}

      {confirmarPorTodos && id_acta !== null && (
        <ConfirmModal
          mensaje={`Modo de pruebas: vas a firmar el acta de inicio por ${investigadoresSinFirmar.length} investigador(es): ${investigadoresSinFirmar.map((f) => f.nombre).join(', ')}. Quedará registrada la fecha y la hora, y no podrás deshacerlo.`}
          onClose={() => setConfirmarPorTodos(false)}
          botonSecundario={{ label: 'Cancelar', onClick: () => setConfirmarPorTodos(false), variante: 'rojo' }}
          botonPrimario={{
            label: 'Firmar por todos',
            variante: 'azul',
            onClick: () => {
              setConfirmarPorTodos(false)
              ejecutar(() => actaApi.firmarActaInicio(id_acta, true), 'Firmas de los investigadores registradas.')
            },
          }}
        />
      )}

      {confirmarComoVicerrector && id_acta !== null && vicerrectorSinFirmar && (
        <ConfirmModal
          mensaje={`Modo de pruebas: vas a firmar el acta de inicio como ${vicerrectorSinFirmar.nombre}. Con esta firma el acta queda legalizada y no podrás deshacerlo.`}
          onClose={() => setConfirmarComoVicerrector(false)}
          botonSecundario={{ label: 'Cancelar', onClick: () => setConfirmarComoVicerrector(false), variante: 'rojo' }}
          botonPrimario={{
            label: 'Firmar',
            variante: 'azul',
            onClick: () => {
              setConfirmarComoVicerrector(false)
              ejecutar(() => actaApi.firmarActaInicio(id_acta), 'Firma del Vicerrector registrada. Falta la firma del Administrador, quien elaboró el acta.')
            },
          }}
        />
      )}

      {confirmarFirma && id_acta !== null && miFirma && (
        <ConfirmModal
          mensaje={`Vas a firmar el acta de inicio como ${miFirma.rol_firmante === 'Administrador' ? `quien la elaboró (${miFirma.nombre})` : miFirma.nombre}. Se registrará la fecha y la hora, y no podrás deshacerlo.`}
          onClose={() => setConfirmarFirma(false)}
          botonSecundario={{ label: 'Cancelar', onClick: () => setConfirmarFirma(false), variante: 'rojo' }}
          botonPrimario={{
            label: 'Firmar',
            variante: 'azul',
            onClick: () => {
              setConfirmarFirma(false)
              ejecutar(
                () => actaApi.firmarActaInicio(id_acta),
                esUltimaFirma && !esFirmaOpcional(miFirma) ? 'Firma registrada. El acta quedó legalizada y el proyecto ya está en ejecución.' : 'Firma registrada.'
              )
            },
          }}
        />
      )}
    </div>
  )
}

export default ActaInicioDetalle
