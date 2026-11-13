import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Eye } from 'lucide-react'
import * as actaApi from '../api/actaInicio'
import {
  ETIQUETA_ESTADO_ACTA,
  bloqueosGeneracion,
  calcularFechaFin,
  camposContacto,
  faltantesContacto,
  esFirmaDeInvestigador,
  firmaDeCuenta,
  formatoPesos,
  textoAperturaActa,
  valorAprobado,
  vigenciaUnica,
  sumaVigencias,
  validarDatosActa,
} from '../lib/actaInicio'
import { VERSION_TEXTOS } from '../lib/textosLegales'
import EditorTextosActa from './EditorTextosActa'
import CompromisosActa from './CompromisosActa'
import { useAuth } from '../../auth/context/AuthContext'
import { getRolesEfectivos } from '../../auth/lib/auth'
import { ApiError } from '../../../shared/api/client'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import CampoFecha from '../../../shared/components/common/CampoFecha'
import { useCambios } from '../../../shared/realtime/RealtimeContext'
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
  // Resultado de la última acción: se muestra debajo del botón que la originó (zona), no arriba de la página.
  const [mensaje, setMensaje] = useState<{ zona: string; tipo: 'ok' | 'error'; texto: string } | null>(null)
  // Resultado de guardar los datos de un participante: se muestra junto a la tabla, no arriba de la página.
  const [resultadoContacto, setResultadoContacto] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmarFirma, setConfirmarFirma] = useState(false)
  // Código de verificación de la firma de un investigador: llega a su correo personal (o al registrado si no tiene).
  const [codigoEnviado, setCodigoEnviado] = useState(false)
  const [codigo, setCodigo] = useState('')
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

  // Último `datos`/`contactos` tal como vinieron del servidor — para que un
  // aviso de tiempo real pueda distinguir "nadie tocó nada, es seguro
  // refrescar" de "la persona ya está editando estos campos" y en ese
  // segundo caso NO pisarle lo que está escribiendo.
  const datosOriginalesRef = useRef<actaApi.DatosActaInicio | null>(null)
  const contactosOriginalesRef = useRef<Record<number, actaApi.DatosContacto> | null>(null)

  const cargar = useCallback(() => {
    setCargando(true)
    actaApi
      .obtenerActaInicio(id_proyecto)
      .then((a) => {
        setActa(a)
        const nuevosDatos: actaApi.DatosActaInicio = {
          tipo_proyecto: a.tipo_proyecto ?? '',
          numero_acta_aprobacion: a.numero_acta_aprobacion ?? '',
          fecha_acta_aprobacion: fechaInput(a.fecha_acta_aprobacion),
          centro_costos: a.centro_costos ?? '',
          fecha_inicio: fechaInput(a.fecha_inicio),
          duracion_meses: a.duracion_meses ?? 0,
          // Financiación aprobada por la Vicerrectoría: la ya registrada o, si no hay, la solicitada en la formulación.
          vigencias: vigenciaUnica(fechaInput(a.fecha_inicio), valorAprobado(a)),
        }
        const nuevosContactos = Object.fromEntries(
          a.participantes.map((p) => [
            p.id_usuarioproyecto,
            { identificacion: p.identificacion, telefono: p.telefono, correo: p.correo, correo_personal: p.correo_personal, programa_academico: p.programa_academico, institucion: p.institucion },
          ])
        )
        setDatos(nuevosDatos)
        setContactos(nuevosContactos)
        datosOriginalesRef.current = nuevosDatos
        contactosOriginalesRef.current = nuevosContactos
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el acta de inicio.'))
      .finally(() => setCargando(false))
  }, [id_proyecto])

  useEffect(() => {
    cargar()
  }, [cargar])

  useCambios('acta-inicio', (payload) => {
    if (payload.id_proyecto !== undefined && payload.id_proyecto !== id_proyecto) return
    // Si ya modificó algún campo del formulario sin guardar, no se le pisa:
    // se queda con lo que está escribiendo hasta que guarde o recargue a mano.
    const sinEditar =
      JSON.stringify(datos) === JSON.stringify(datosOriginalesRef.current) &&
      JSON.stringify(contactos) === JSON.stringify(contactosOriginalesRef.current)
    if (sinEditar) cargar()
  })

  const ejecutar = async (accion: () => Promise<unknown>, mensajeOk: string, zona: string) => {
    setOcupado(true)
    setError('')
    setMensaje(null)
    try {
      await accion()
      setMensaje({ zona, tipo: 'ok', texto: mensajeOk })
      cargar()
    } catch (err) {
      const detalle = err instanceof ApiError && err.faltantes?.length ? ` ${err.faltantes.join(' ')}` : ''
      setMensaje({ zona, tipo: 'error', texto: (err instanceof ApiError ? err.message : 'No se pudo completar la acción.') + detalle })
    } finally {
      setOcupado(false)
    }
  }

  const guardarContacto = async (p: actaApi.ParticipanteActa, c: actaApi.DatosContacto) => {
    setOcupado(true)
    setError('')
    setMensaje(null)
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
  // Al guardar los numerales 1 a 3 quedan bloqueados (se liberan si el Administrador reabre el acta).
  const puedeDiligenciarDatos = esAdmin && enElaboracion
  const editable = puedeDiligenciarDatos && !acta.datos_guardados
  const fechaFin = calcularFechaFin(datos.fecha_inicio, datos.duracion_meses)
  const bloqueos = bloqueosGeneracion(acta)


  const firmasOrdenadas = [...acta.firmas].sort((a, b) => a.orden_firma - b.orden_firma)
  const esUltimaFirma = firmasOrdenadas.filter((f) => !f.firmado).length === 1
  // La firma que esta cuenta puede dar ahora (en su turno).
  const miFirma = firmaDeCuenta(acta, usuario?.id_usuario, roles)
  const esMiTurno = !!miFirma

  const mensajeEn = (zona: string) =>
    mensaje?.zona === zona && mensaje.texto ? (
      <p role="status" className={mensaje.tipo === 'ok' ? 'acta-ok acta-aviso-ok' : 'acta-error'} style={{ marginTop: 10 }}>
        {mensaje.texto}
      </p>
    ) : null

  const verActaFirmada = () =>
    id_acta !== null &&
    ejecutar(() => actaApi.verActa(id_proyecto, `acta-inicio-${id_proyecto}-firmada.pdf`), '', 'legalizada')

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
      </div>

      {error && <p className="acta-error">{error}</p>}

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
      {mensajeEn('estado')}
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
            <CampoFecha disabled={!editable} value={datos.fecha_inicio} onChange={(valor) => setDatos({ ...datos, fecha_inicio: valor })} />
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
            <CampoFecha max={new Date().toLocaleDateString('en-CA')} disabled={!editable} value={datos.fecha_acta_aprobacion} onChange={(valor) => setDatos({ ...datos, fecha_acta_aprobacion: valor })} />
          </label>
          <label>
            Centro de costos *
            <input inputMode="numeric" maxLength={20} disabled={!editable} value={datos.centro_costos} onChange={(e) => setDatos({ ...datos, centro_costos: e.target.value.replace(/\D/g, '') })} />
          </label>
        </div>

        <h4>Financiación del proyecto</h4>
        <dl className="acta-ficha">
          <dt>Valor solicitado a UNICESMAG</dt>
          <dd>{formatoPesos(acta.valor_solicitado_unicesmag)} <small>(según la formulación)</small></dd>
          <dt>Valor aprobado</dt>
          <dd>
            {editable ? (
              <label className="acta-campo-valor">
                <input
                  inputMode="numeric"
                  aria-label="Valor aprobado"
                  value={sumaVigencias(datos.vigencias) ? String(sumaVigencias(datos.vigencias)) : ''}
                  onChange={(e) => setDatos({ ...datos, vigencias: vigenciaUnica(datos.fecha_inicio, Number(e.target.value.replace(/\D/g, '')) || 0) })}
                />
              </label>
            ) : null}
            <b>{formatoPesos(editable ? sumaVigencias(datos.vigencias) : valorAprobado(acta))}</b>
          </dd>
        </dl>
        <p className="acta-nota">
          El valor aprobado puede ser distinto del solicitado; se registra como un solo valor total, sin diligenciarlo año por año.
          {valorAprobado(acta) !== acta.valor_solicitado_unicesmag && !editable ? ' El valor aprobado difiere del solicitado.' : ''}
        </p>

        {puedeDiligenciarDatos && (
          <>
            {editable && erroresDatos.length > 0 && <ul className="acta-lista-error">{erroresDatos.map((e) => <li key={e}>{e}</li>)}</ul>}
            <button type="button" className="acta-btn" disabled={ocupado || !editable || erroresDatos.length > 0} onClick={() => ejecutar(() => actaApi.guardarDatosActa(id_proyecto, { ...datos, vigencias: vigenciaUnica(datos.fecha_inicio, sumaVigencias(datos.vigencias)) }), 'Datos del acta guardados (numerales 1 a 3).', 'datos')}>
              {acta.datos_guardados ? 'Datos de los numerales 1 a 3 guardados' : 'Guardar datos de los numerales 1 a 3'}
            </button>
            {mensajeEn('datos')}
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
              {camposContacto().map((c) => <th key={c.clave}>{c.etiqueta.charAt(0).toUpperCase() + c.etiqueta.slice(1)}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {acta.participantes.map((p) => {
              const tienePermiso = enElaboracion && (esAdmin || p.id_usuario === usuario?.id_usuario)
              // Al guardar, la fila de ese participante queda bloqueada (solo se libera si el Administrador reabre el acta).
              const puedeEditar = tienePermiso && !p.contacto_guardado
              // Con cuenta, el correo personal es el de la hoja de vida (cada investigador lo registra en su Perfil); solo se
              // diligencia aquí para quien no tiene cuenta, y el Administrador puede hacerlo aunque el acta ya esté generada.
              const puedeEditarCorreoPersonal = p.id_usuario <= 0 && (puedeEditar || esAdmin)
              const c = contactos[p.id_usuarioproyecto]
              return (
                <tr key={p.id_usuarioproyecto}>
                  <td>{p.nombre}<br /><small>{p.rol}</small></td>
                  {camposContacto().map(({ clave }) => (
                    <td key={clave}>
                      {clave === 'institucion' || clave === 'programa_academico' ? (
                        // Nombres largos (p. ej. "Corporación Universitaria Minuto de Dios - UNIMINUTO"): se ven en varios renglones.
                        <textarea
                          className="acta-contacto-multilinea"
                          rows={Math.max(1, Math.ceil(String(c?.[clave] ?? '').length / 24))}
                          disabled={!puedeEditar}
                          value={c?.[clave] ?? ''}
                          onChange={(e) => cambiarContacto(p.id_usuarioproyecto, clave, e.target.value.replace(/\n/g, ' '))}
                        />
                      ) : (
                        <input
                          disabled={!puedeEditar}
                          value={c?.[clave] ?? ''} onChange={(e) => cambiarContacto(p.id_usuarioproyecto, clave, e.target.value)} />
                      )}
                    </td>
                  ))}
                  <td>
                    {/* Una vez guardados los datos del participante, el botón desaparece: ya no hay nada que guardar. */}
                    {(tienePermiso || puedeEditarCorreoPersonal) && (!p.contacto_guardado || puedeEditarCorreoPersonal) && (
                      <button type="button" className="acta-btn" disabled={ocupado} onClick={() => guardarContacto(p, c)}>
                        Guardar
                      </button>
                    )}
                    {p.contacto_guardado && !puedeEditarCorreoPersonal && <small className="acta-ok">Guardado</small>}
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

      {/* El Administrador edita los textos de los numerales 5 a 10 antes de generar el acta */}
      {esAdmin && enElaboracion && (
        <EditorTextosActa acta={acta} ocupado={ocupado} ejecutar={ejecutar} mensaje={mensajeEn('textos')} />
      )}

      {/* HU-87 — al final, después de los textos de los numerales 5 a 10 (hasta las consideraciones finales) */}
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
                <p className="acta-nota">Al generarla, los datos quedan congelados y cada investigador recibe un correo y una notificación para entrar al sistema y firmar.</p>
              )}
              <h4>Firma del Vicerrector</h4>
              {acta.vicerrector ? (
                <p className="acta-nota">
                  Firma {acta.vicerrector.nombre}, el usuario con rol Vicerrector. Cuando todos los investigadores hayan firmado, le llega
                  una notificación y un correo, al que tiene registrado en su perfil{acta.vicerrector.correo_enmascarado ? ` (${acta.vicerrector.correo_enmascarado})` : ''}.
                </p>
              ) : (
                <p className="acta-error">No hay un usuario con rol Vicerrector: créalo en Usuarios para que reciba el enlace de firma.</p>
              )}
              <button
                type="button"
                className="acta-btn"
                disabled={ocupado || bloqueos.length > 0 || !acta.vicerrector}
                onClick={() => ejecutar(() => actaApi.generarActaInicio(id_acta), 'Acta generada y enviada a firma.', 'firmas')}
              >
                Generar acta INV-IC-FR-017
              </button>
            </>
          )}
        </section>
      )}

      {/* Numerales 5 a 10 — los escribe el Administrador; no hay una aceptación aparte: la firma del acta es la conformidad. */}
      {!enElaboracion && id_acta !== null && (
        <section className="acta-card">
          <h3>5 a 10. Compromisos y cláusulas del acta</h3>
          <p className="acta-nota">Texto del acta según el formato {VERSION_TEXTOS}. Con su firma, cada investigador manifiesta su conformidad con todos los numerales.</p>

          <CompromisosActa textos={acta.textos} />
        </section>
      )}

      {/* HU-88, 89 */}
      {acta.firmas.length > 0 && id_acta !== null && (
        <section className="acta-card">
          <h3>Firmas</h3>
          <ol className="acta-firmas-lista">
            {firmasOrdenadas.map((f, i) => (
              <li key={f.id_firma} className={`acta-firma-card${f.firmado ? ' acta-firma-card-ok' : ''}`}>
                <span className="acta-firma-num" aria-hidden="true">{f.firmado ? <Check size={14} /> : i + 1}</span>
                <div className="acta-firma-info">
                  <strong className="acta-firma-nombre">{f.nombre}</strong>
                  <span className="acta-firma-rol">{f.rol_firmante}</span>
                </div>
                <span className="acta-firma-estado">
                  {f.firmado && f.fecha_firma ? `Firmó · ${new Date(f.fecha_firma).toLocaleString('es-CO')}` : 'Pendiente de firma'}
                </span>
              </li>
            ))}
          </ol>
          {esAdmin && acta.estado === 'en firma' && acta.vicerrector && firmasOrdenadas.some((f) => f.rol_firmante === 'Vicerrector' && !f.firmado) && (
            <p className="acta-nota">
              Vicerrector: {acta.vicerrector.nombre}. Le llega un correo, al registrado en su perfil, para que entre al sistema y firme
              {acta.vicerrector.correo_enmascarado ? ` (${acta.vicerrector.correo_enmascarado})` : ''}.
            </p>
          )}
          {esAdmin && acta.estado === 'en firma' && firmasOrdenadas.some((f) => !f.firmado) && (
            <div>
              <p className="acta-nota">
                El aviso de firma salió al correo personal de cada investigador (el del Vicerrector, cuando todos hayan firmado): cada uno entra al
                sistema con su cuenta y firma. Si alguien no lo recibió, puedes reenviarlo.
              </p>
              <button
                type="button"
                className="acta-btn acta-btn-sec"
                disabled={ocupado}
                onClick={() => ejecutar(() => actaApi.reenviarEnlacesFirma(id_acta), 'Aviso de firma reenviado.', 'firmas')}
              >
                Reenviar aviso de firma
              </button>
            </div>
          )}
          {esMiTurno && miFirma && (
            <>
              {miFirma.requiere_codigo ? (
                <div className="acta-codigo-bloque">
                  <p className="acta-nota">
                    {miFirma.correo_personal_enmascarado
                      ? `Para firmar te enviamos un código de verificación de 6 dígitos a tu correo personal (${miFirma.correo_personal_enmascarado}).`
                      : 'Para firmar necesitas tener tu correo personal registrado en tu hoja de vida. Regístralo en tu Perfil y vuelve a esta página.'}
                  </p>
                  <button
                    type="button"
                    className="acta-btn acta-btn-sec"
                    disabled={ocupado || !miFirma.correo_personal_enmascarado}
                    onClick={() => {
                      setCodigo('')
                      ejecutar(
                        async () => {
                          const r = await actaApi.solicitarCodigoFirma(id_acta)
                          setCodigoEnviado(true)
                          return r
                        },
                        'Te enviamos el código a tu correo. Vence en 10 minutos.',
                        'firmas'
                      )
                    }}
                  >
                    {codigoEnviado ? 'Reenviar código' : 'Enviar código a mi correo'}
                  </button>
                  {!miFirma.correo_personal_enmascarado && (
                    <button type="button" className="acta-btn" onClick={() => navigate('/perfil')}>
                      Ir a mi Perfil
                    </button>
                  )}
                  {codigoEnviado && (
                    <div className="acta-codigo">
                      <label>
                        Código de verificación
                        <input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="000000"
                          aria-label="Código de verificación"
                          value={codigo}
                          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        />
                      </label>
                      <button type="button" className="acta-btn" disabled={ocupado || codigo.length !== 6} onClick={() => setConfirmarFirma(true)}>
                        Firmar como {miFirma.nombre}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button type="button" className="acta-btn" disabled={ocupado} onClick={() => setConfirmarFirma(true)}>
                  {miFirma.rol_firmante === 'Administrador' ? 'Firmar como quien elabora el acta' : `Firmar como ${miFirma.nombre}`}
                </button>
              )}
            </>
          )}
          {acta.estado === 'en firma' && !esMiTurno && (
            <p className="acta-nota">
              {firmasOrdenadas.some((f) => f.firmado && f.id_usuario === usuario?.id_usuario && esFirmaDeInvestigador(f)) ? 'Ya firmaste. ' : ''}
              Firmas pendientes: {firmasOrdenadas.filter((f) => !f.firmado).map((f) => f.nombre).join(', ')}.
              {' '}Cada investigador, principal y co-investigadores, firma entrando al sistema con su cuenta; después firma el Vicerrector y, por último, el Administrador (elaborado por).
            </p>
          )}
          {mensajeEn('firmas')}
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
            <button type="button" className="acta-btn acta-btn-sec" disabled={ocupado} onClick={verActaFirmada}>
              <Eye size={14} /> Ver acta firmada
            </button>
            <button type="button" className="acta-btn" onClick={() => navigate(`/seguimiento/${id_proyecto}`)}>
              Ir al seguimiento del proyecto
            </button>
          </div>
          {mensajeEn('legalizada')}
        </section>
      )}

      {confirmarReabrir && id_acta !== null && (
        <ConfirmModal
          mensaje="¿Volver el acta a elaboración? Se borran las firmas registradas y habrá que generarla de nuevo."
          onClose={() => setConfirmarReabrir(false)}
          botonSecundario={{ label: 'Cancelar', onClick: () => setConfirmarReabrir(false), variante: 'azul' }}
          botonPrimario={{
            label: 'Volver a elaboración',
            variante: 'rojo',
            onClick: () => {
              setConfirmarReabrir(false)
              ejecutar(() => actaApi.reabrirActaInicio(id_acta), 'El acta volvió a elaboración: ya puedes editar sus datos.', 'estado')
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
                async () => {
                  await actaApi.firmarActaInicio(id_acta, miFirma.requiere_codigo ? codigo : undefined)
                  setCodigo('')
                  setCodigoEnviado(false)
                },
                esUltimaFirma ? 'Firma registrada. El acta quedó legalizada y el proyecto ya está en ejecución.' : 'Firma registrada.',
                'firmas'
              )
            },
          }}
        />
      )}
    </div>
  )
}

export default ActaInicioDetalle
