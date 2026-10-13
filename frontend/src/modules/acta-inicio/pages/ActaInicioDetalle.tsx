import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Plus, Trash2 } from 'lucide-react'
import * as actaApi from '../api/actaInicio'
import {
  ETIQUETA_ESTADO_ACTA,
  bloqueosGeneracion,
  calcularFechaFin,
  camposContacto,
  clausulasPendientes,
  faltantesContacto,
  firmaCorrespondeA,
  formatoPesos,
  participanteDeFirma,
  requisitosDeFirmaCumplidos,
  siguienteFirma,
  sumaVigencias,
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
  const [ocupado, setOcupado] = useState(false)
  const [confirmarFirma, setConfirmarFirma] = useState(false)
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
  const [aceptadas, setAceptadas] = useState<Set<string>>(new Set())

  const cargar = useCallback(() => {
    setCargando(true)
    actaApi
      .obtenerActaInicio(id_proyecto)
      .then((a) => {
        setActa(a)
        setAceptadas(new Set())
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
  const bloqueos = bloqueosGeneracion(acta)

  const firmasOrdenadas = [...acta.firmas].sort((a, b) => a.orden_firma - b.orden_firma)
  const proxima = siguienteFirma(acta)
  const esUltimaFirma = firmasOrdenadas.filter((f) => !f.firmado).length === 1
  const esMiTurno = acta.estado === 'en firma' && !!proxima && firmaCorrespondeA(proxima, usuario?.id_usuario, roles, actaApi.MODO_PRUEBA)
  const puedoFirmar = esMiTurno && requisitosDeFirmaCumplidos(acta)

  // Participante por el que actúa la sesión. En modo prueba la cuenta de Investigador
  // actúa por el investigador que tiene el siguiente turno de firma.
  const propio = acta.participantes.find((p) => p.id_usuario === usuario?.id_usuario) ?? null
  const turnoInvestigador = firmasOrdenadas.find((f) => !f.firmado && f.rol_firmante !== 'Vicerrector') ?? null
  const actuaPorInvestigadores = actaApi.MODO_PRUEBA && (roles.includes('usuario') || esAdmin)
  const miParticipante = propio ?? (actuaPorInvestigadores ? participanteDeFirma(acta, turnoInvestigador) : null)
  const pendientes = miParticipante ? clausulasPendientes(acta, miParticipante.id_usuarioproyecto) : []
  const todasAceptadas = pendientes.length > 0 && pendientes.every((t) => aceptadas.has(t))

  const setVigencia = (i: number, cambio: Partial<actaApi.VigenciaActa>) =>
    setDatos((d) => ({ ...d, vigencias: d.vigencias.map((v, j) => (j === i ? { ...v, ...cambio } : v)) }))

  const descargar = (tipo: 'generado' | 'firmado') =>
    id_acta !== null &&
    ejecutar(() => actaApi.descargarActa(id_acta, tipo, `acta-inicio-${id_proyecto}${tipo === 'firmado' ? '-firmada' : ''}.pdf`), 'PDF del acta descargado.')

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
          {actaApi.MODO_PRUEBA && <span className="acta-modo-prueba">Modo prueba</span>}
        </div>
        {id_acta !== null && (
          <button type="button" className="acta-btn acta-btn-sec" disabled={ocupado} onClick={() => descargar('generado')}>
            <Download size={14} /> {enElaboracion ? 'Vista previa del acta (PDF)' : 'Descargar acta (PDF)'}
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
        <div className="acta-opciones">
          {actaApi.TIPOS_PROYECTO.map((tipo) => (
            <label key={tipo} className={`acta-opcion ${datos.tipo_proyecto === tipo ? 'acta-opcion-activa' : ''}`}>
              <input type="radio" name="tipo_proyecto" disabled={!editable} checked={datos.tipo_proyecto === tipo} onChange={() => setDatos({ ...datos, tipo_proyecto: tipo })} />
              {tipo}
            </label>
          ))}
        </div>
      </section>

      {/* Numeral 3 — HU-82, 83, 85 */}
      <section className="acta-card">
        <h3>3. Aprobación del proyecto</h3>
        <div className="acta-grid">
          <label>
            Acta No. *
            <input maxLength={30} disabled={!editable} value={datos.numero_acta_aprobacion} onChange={(e) => setDatos({ ...datos, numero_acta_aprobacion: e.target.value })} />
          </label>
          <label>
            Fecha del acta *
            <input type="date" max={new Date().toISOString().slice(0, 10)} disabled={!editable} value={datos.fecha_acta_aprobacion} onChange={(e) => setDatos({ ...datos, fecha_acta_aprobacion: e.target.value })} />
          </label>
          <label>
            Centro de costos *
            <input disabled={!editable} value={datos.centro_costos} onChange={(e) => setDatos({ ...datos, centro_costos: e.target.value })} />
          </label>
        </div>

        <h4>Financiación interna del proyecto</h4>
        <p className="acta-nota">Valor solicitado a UNICESMAG: {formatoPesos(acta.valor_solicitado_unicesmag)}. El costo de cada año debe sumar ese valor.</p>
        {datos.vigencias.map((v, i) => (
          <div key={i} className="acta-fila-vigencia">
            <span className="acta-nota">Costo</span>
            <input type="number" placeholder="Año" aria-label="Año" disabled={!editable} value={v.anio || ''} onChange={(e) => setVigencia(i, { anio: Number(e.target.value) })} />
            <input type="number" placeholder="Valor asignado" aria-label="Valor asignado" disabled={!editable} value={v.valor_asignado || ''} onChange={(e) => setVigencia(i, { valor_asignado: Number(e.target.value) })} />
            <span className="acta-nota">{formatoPesos(v.valor_asignado)}</span>
            {editable && (
              <button type="button" className="acta-icono" aria-label="Quitar año" onClick={() => setDatos((d) => ({ ...d, vigencias: d.vigencias.filter((_, j) => j !== i) }))}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {editable && (
          <button type="button" className="acta-link" onClick={() => setDatos((d) => ({ ...d, vigencias: [...d.vigencias, { anio: new Date().getFullYear() + d.vigencias.length, valor_asignado: 0 }] }))}>
            <Plus size={14} /> Agregar año
          </button>
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
              const puedeEditar = enElaboracion && (esAdmin || p.id_usuario === usuario?.id_usuario || (actaApi.MODO_PRUEBA && roles.includes('usuario')))
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
                      <button type="button" className="acta-btn" disabled={ocupado} onClick={() => ejecutar(() => actaApi.guardarContactoParticipante(id_proyecto, p.id_usuarioproyecto, c), `Datos de ${p.nombre} guardados.`)}>
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
              <button type="button" className="acta-btn" disabled={ocupado || bloqueos.length > 0} onClick={() => ejecutar(() => actaApi.generarActaInicio(id_acta), 'Acta generada y enviada a firma.')}>
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
              {propio ? 'Lee' : `Actúas como ${miParticipante.nombre} (${miParticipante.rol}). Lee`} y acepta cada numeral antes de firmar. Se guardará la
              fecha, la hora y la versión del texto ({VERSION_TEXTOS}).
            </p>
          ) : (
            <p className="acta-nota">Texto del acta según el formato {VERSION_TEXTOS}.</p>
          )}

          {CLAUSULAS.map((c) => {
            const porAceptar = !legalizada && pendientes.includes(c.tipo)
            return (
              <details key={c.tipo} className="acta-clausula-bloque" open={porAceptar}>
                <summary>{c.titulo}</summary>
                <div className="acta-clausula-texto">{c.parrafos.map((p) => <p key={p}>{p}</p>)}</div>
                {porAceptar && (
                  <label className="acta-clausula">
                    <input
                      type="checkbox"
                      checked={aceptadas.has(c.tipo)}
                      onChange={(e) => setAceptadas((prev) => { const n = new Set(prev); if (e.target.checked) n.add(c.tipo); else n.delete(c.tipo); return n })}
                    />
                    <span>He leído y acepto el numeral “{c.titulo}”.</span>
                  </label>
                )}
              </details>
            )
          })}
          <details className="acta-clausula-bloque">
            <summary>6. Solicitudes para asignación de rubros</summary>
            <table className="acta-tabla">
              <thead><tr><th>Concepto</th><th>Tiempo</th></tr></thead>
              <tbody>{RUBROS_ANTELACION.map(([concepto, tiempo]) => <tr key={concepto}><td>{concepto}</td><td>{tiempo}</td></tr>)}</tbody>
            </table>
          </details>
          <details className="acta-clausula-bloque">
            <summary>10. Consideraciones finales</summary>
            <div className="acta-clausula-texto">{CONSIDERACIONES_FINALES.map((p) => <p key={p}>{p}</p>)}</div>
          </details>

          {miParticipante && pendientes.length > 0 && !legalizada && (
            <button
              type="button"
              className="acta-btn"
              disabled={ocupado || !todasAceptadas}
              onClick={() => ejecutar(() => actaApi.aceptarCompromisos(id_acta, VERSION_TEXTOS, pendientes, miParticipante.id_usuarioproyecto), `Aceptación de ${miParticipante.nombre} registrada.`)}
            >
              Registrar aceptación
            </button>
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
                {f.nombre} — {f.rol_firmante}
                <small>{f.firmado && f.fecha_firma ? ` · firmó ${new Date(f.fecha_firma).toLocaleString('es-CO')}` : ' · pendiente'}</small>
              </li>
            ))}
          </ol>
          {esMiTurno && proxima && (
            <>
              {!puedoFirmar && (
                <p className="acta-nota">
                  {proxima.rol_firmante === 'Vicerrector'
                    ? 'Todos los participantes deben aceptar los compromisos antes de la firma del Vicerrector.'
                    : 'Primero registra la aceptación de los compromisos (numerales 5 a 10).'}
                </p>
              )}
              <button type="button" className="acta-btn" disabled={ocupado || !puedoFirmar} onClick={() => setConfirmarFirma(true)}>
                Firmar como {proxima.nombre}
              </button>
            </>
          )}
          {acta.estado === 'en firma' && proxima && !esMiTurno && (
            <p className="acta-nota">Siguiente firma: {proxima.nombre} ({proxima.rol_firmante}).</p>
          )}
        </section>
      )}

      {/* HU-90, 91: con la última firma el acta queda legalizada. */}
      {legalizada && id_acta !== null && (
        <section className="acta-card">
          <h3>Acta legalizada</h3>
          <p className="acta-ok">
            Legalizada el {acta.fecha_legalizacion ? new Date(acta.fecha_legalizacion).toLocaleDateString('es-CO') : '—'} · firmada
            electrónicamente por {acta.firmas.length} firmantes.
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

      {confirmarFirma && id_acta !== null && proxima && (
        <ConfirmModal
          mensaje={`Vas a firmar el acta de inicio como ${proxima.nombre}. Se registrará la fecha y la hora, y no podrás deshacerlo.`}
          onClose={() => setConfirmarFirma(false)}
          botonSecundario={{ label: 'Cancelar', onClick: () => setConfirmarFirma(false), variante: 'rojo' }}
          botonPrimario={{
            label: 'Firmar',
            variante: 'azul',
            onClick: () => {
              setConfirmarFirma(false)
              ejecutar(
                () => actaApi.firmarActaInicio(id_acta),
                esUltimaFirma ? 'Firma registrada. El acta quedó legalizada y el proyecto ya está en ejecución.' : 'Firma registrada.'
              )
            },
          }}
        />
      )}
    </div>
  )
}

export default ActaInicioDetalle
