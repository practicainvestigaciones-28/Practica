import { useEffect, useMemo, useState } from 'react'
import { Download, Lock, Plus, Trash2 } from 'lucide-react'
import * as api from '../api/seguimiento'
import { contarPalabras, getLimite } from '../../proyectos/lib/limitesTexto'
import { Evidencias } from './Evidencias'
import type { ApoyoInforme, Evidencia, InfoGeneralInforme, PersonaInforme, ProductoComprometido, ProyectoSeguimiento } from '../api/tipos'
import { formatoFecha, formatoPesos } from '../lib/formato'
import {
  avancesSinAprobar,
  duracionTotal,
  fechaFin,
  cantidadSoportes,
  faltantesProducto,
  informeFinalBloqueadoPorAvances,
  informeFinalSolicitudPendiente,
  informeFinalSinHabilitar,
  informeListoParaFirmar,
  mensajeBloqueoInformeFinal,
  puedeFirmarComo,
  semaforoCumplimiento,
  siguienteFirma,
  soportesFaltantes,
  totalAsignado,
  totalesProductos,
} from '../lib/reglas'
import { CATEGORIAS_RESULTADOS } from '../lib/resultados'
import { Aviso, Badge, CampoLectura, FilaRevisadoPor, FirmasSecuenciales, Kpi, Pestanas } from './UI'
import type { PropsPestana } from './props'

type Seccion = 'general' | 'objetivos' | 'resultados' | 'adquisiciones' | 'apoyos' | 'firmas'

// Mismo orden de numerales del formato INV-IC-FR-019.
const SECCIONES: { valor: Seccion; etiqueta: string }[] = [
  { valor: 'general', etiqueta: '1. Información general' },
  { valor: 'objetivos', etiqueta: '2-3. Resumen y objetivos' },
  { valor: 'resultados', etiqueta: '4. Resultados' },
  { valor: 'adquisiciones', etiqueta: '5-6. Adquisiciones' },
  { valor: 'apoyos', etiqueta: '7. Auxiliares y asistentes' },
  { valor: 'firmas', etiqueta: 'Firmas' },
]

interface Columna {
  titulo: string
  tipo?: 'date'
}

/** El texto no puede pasar del tope de palabras: al pegar un texto largo se recorta a las primeras palabras. */
function limitarPalabras(nuevo: string, actual: string, max: number): string {
  const palabras = contarPalabras(nuevo)
  if (palabras <= max || palabras <= contarPalabras(actual)) return nuevo
  return nuevo.trim().split(/\s+/).slice(0, max).join(' ')
}

const COL_EQUIPOS: Columna[] = [{ titulo: 'Equipo / Software / Licencia' }, { titulo: 'Fecha de adquisición', tipo: 'date' }, { titulo: 'Estado' }, { titulo: 'Código inventario' }, { titulo: 'Observaciones' }]
const COL_MATERIALES: Columna[] = [{ titulo: 'Nombre del material' }, { titulo: 'Fecha de adquisición', tipo: 'date' }, { titulo: 'ISBN / ISSN' }, { titulo: 'Código inventario' }, { titulo: 'Observaciones' }]

function TablaDinamica({
  columnas,
  filas,
  editable,
  onCambiar,
  textoAgregar,
}: {
  columnas: Columna[]
  filas: string[][]
  editable: boolean
  onCambiar: (filas: string[][]) => void
  textoAgregar: string
}) {
  return (
    <>
      <div className="seg-tabla-wrap">
        <table className="seg-tabla">
          <thead>
            <tr>
              {columnas.map((c) => <th key={c.titulo}>{c.titulo}</th>)}
              {editable && <th />}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={columnas.length + 1} className="seg-vacio">Sin registros.</td></tr>
            )}
            {filas.map((fila, i) => (
              <tr key={i}>
                {columnas.map((c, j) => (
                  <td key={c.titulo}>
                    <input
                      type={c.tipo ?? 'text'}
                      disabled={!editable}
                      value={fila[j] ?? ''}
                      onChange={(e) => onCambiar(filas.map((f, x) => (x === i ? f.map((v, y) => (y === j ? e.target.value : v)) : f)))}
                    />
                  </td>
                ))}
                {editable && (
                  <td className="c">
                    <button type="button" className="seg-icono" aria-label="Quitar fila" onClick={() => onCambiar(filas.filter((_, x) => x !== i))}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <button type="button" className="seg-link" onClick={() => onCambiar([...filas, columnas.map(() => '')])}>
          <Plus size={14} /> {textoAgregar}
        </button>
      )}
    </>
  )
}

/** Bloque de un investigador en el numeral 1: nombre, grupo, programa, correo y teléfono. */
function CamposPersona({
  titulo,
  persona,
  editable,
  nombreFijo,
  onCambiar,
}: {
  titulo: string
  persona: PersonaInforme
  editable: boolean
  /** El investigador principal viene del proyecto: su nombre no se edita aquí. */
  nombreFijo?: boolean
  onCambiar: (p: PersonaInforme) => void
}) {
  const campo = (etiqueta: string, clave: keyof PersonaInforme, bloqueado = false, tipo = 'text') => (
    <label className="seg-campo">
      {etiqueta}
      <input type={tipo} disabled={!editable || bloqueado} value={persona[clave]} onChange={(e) => onCambiar({ ...persona, [clave]: e.target.value })} />
    </label>
  )
  return (
    <>
      <h4>{titulo}</h4>
      <div className="seg-grid">
        {campo('Nombre', 'nombre', nombreFijo)}
        {campo('Grupo de investigación', 'grupo')}
        {campo('Programa académico', 'programa')}
        {campo('Correo electrónico', 'correo', false, 'email')}
        {campo('Teléfono', 'telefono', false, 'tel')}
      </div>
    </>
  )
}

const borradorDe = (p: ProyectoSeguimiento) => {
  const { info, resumen, objetivos, observaciones_objetivos, equipos, materiales, actividades_apoyos, evidencias_apoyos } = p.informe_final
  return { info, resumen, objetivos, observaciones_objetivos, equipos, materiales, actividades_apoyos, evidencias_apoyos, productos: p.productos }
}

/** M-06: informe técnico final con los numerales del formato INV-IC-FR-019. Lo diligencia
 * el Investigador, lo firman Investigador, Co-investigadores y Líder del grupo, y lo revisa la VIE. */
function InformeFinalTab({ proyecto, roles, ejecutar, ocupado, bloqueado }: PropsPestana) {
  const [seccion, setSeccion] = useState<Seccion>('general')
  const [borrador, setBorrador] = useState(() => borradorDe(proyecto))
  const f = proyecto.informe_final

  useEffect(() => {
    setBorrador(borradorDe(proyecto))
  }, [proyecto])

  const abierto = f.estado === 'Borrador' || f.estado === 'Devuelto'
  const editable = roles.includes('usuario') && !bloqueado && abierto && !f.firmas.some((x) => x.firmado)
  const sinGuardar = useMemo(() => JSON.stringify(borrador) !== JSON.stringify(borradorDe(proyecto)), [borrador, proyecto])
  const vistaPrevia: ProyectoSeguimiento = { ...proyecto, productos: borrador.productos, informe_final: { ...f, ...borrador } }
  const totales = totalesProductos(vistaPrevia)
  const semaforo = semaforoCumplimiento(totales.porcentaje)
  const faltan = informeListoParaFirmar(proyecto)
  const maxPalabrasResumen = getLimite('resumen')
  const [obsSolicitud, setObsSolicitud] = useState('')
  const firmasCompletas = siguienteFirma(f.firmas) === -1
  const { info } = borrador
  const interna = totalAsignado(proyecto)

  const setInfo = (cambio: Partial<InfoGeneralInforme>) => setBorrador((b) => ({ ...b, info: { ...b.info, ...cambio } }))
  const agregarSoporte = (nombre: string, ev: Evidencia) =>
    setBorrador((b) => ({ ...b, productos: b.productos.map((x) => (x.nombre === nombre ? { ...x, soportes: [...x.soportes, ev] } : x)) }))
  const quitarSoporte = (nombre: string, k: number) =>
    setBorrador((b) => ({ ...b, productos: b.productos.map((x) => (x.nombre === nombre ? { ...x, soportes: x.soportes.filter((_, n) => n !== k) } : x)) }))
  const setApoyo = (i: number, cambio: Partial<ApoyoInforme>) => setInfo({ apoyos: info.apoyos.map((a, j) => (j === i ? { ...a, ...cambio } : a)) })
  const setProducto = (nombre: string, cambio: Partial<ProductoComprometido>) =>
    setBorrador((b) => ({ ...b, productos: b.productos.map((x) => (x.nombre === nombre ? { ...x, ...cambio } : x)) }))
  const setObjetivo = (i: number, cambio: Partial<(typeof borrador.objetivos)[number]>) =>
    setBorrador((b) => ({ ...b, objetivos: b.objetivos.map((x, j) => (j === i ? { ...x, ...cambio } : x)) }))

  // En pantalla solo se diligencian los conceptos que el proyecto comprometió (proyectado mayor
  // que cero); una categoría sin ninguno no se muestra.
  const categorias = CATEGORIAS_RESULTADOS.map((cat) => ({
    ...cat,
    conceptos: cat.conceptos.filter((concepto) => (proyecto.productos.find((x) => x.nombre === concepto)?.proyectado ?? 0) > 0),
  })).filter((cat) => cat.conceptos.length > 0)

  const guardar = () => ejecutar(() => api.guardarInformeFinal(proyecto.id_proyecto, borrador), 'Informe técnico final guardado.')
  const descargar = async () => {
    const { descargarPdfInformeFinal } = await import('../lib/pdfInformeFinal')
    await descargarPdfInformeFinal(vistaPrevia)
  }

  // Se habilita cuando todos los informes de avance están aprobados.
  if (informeFinalBloqueadoPorAvances(proyecto)) {
    const pendientes = avancesSinAprobar(proyecto)
    return (
      <section className="seg-card">
        <h3 style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Lock size={16} /> Informe técnico final · INV-IC-FR-019
        </h3>
        <Aviso tipo="info">{mensajeBloqueoInformeFinal(proyecto)}</Aviso>
        {pendientes.length > 0 && (
          <>
            <h4>Informes de avance por aprobar</h4>
            <ul className="seg-lista">
              {pendientes.map((pe) => (
                <li key={pe.numero}>
                  Periodo {pe.numero} · {formatoFecha(pe.apertura)} – {formatoFecha(pe.limite)} <Badge estado={pe.estado} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    )
  }

  // Con los avances aprobados, el investigador solicita el informe final y el Administrador lo habilita.
  if (informeFinalSinHabilitar(proyecto)) {
    const pendiente = informeFinalSolicitudPendiente(proyecto)
    const esAdmin = roles.includes('administrador')
    const esInvestigador = roles.includes('usuario')
    const decidir = (decision: 'Habilitar' | 'Rechazar') =>
      ejecutar(
        () => api.decidirSolicitudInformeFinal(proyecto.id_proyecto, decision, obsSolicitud),
        decision === 'Habilitar' ? 'Informe final habilitado.' : 'Solicitud rechazada.'
      ).then(() => setObsSolicitud(''))
    return (
      <section className="seg-card">
        <h3 style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Lock size={16} /> Informe técnico final · INV-IC-FR-019
        </h3>
        {f.observacion_solicitud && <Aviso tipo="error"><b>Solicitud rechazada por el Administrador:</b> {f.observacion_solicitud}</Aviso>}
        {!pendiente && (
          <Aviso tipo="info">
            {esInvestigador && !bloqueado
              ? 'Ya están aprobados todos los informes de avance. Solicita el informe final: el Administrador lo habilita y entonces puedes diligenciarlo.'
              : 'El investigador aún no ha solicitado el informe final.'}
          </Aviso>
        )}
        {pendiente && (
          <Aviso tipo="info">
            {esAdmin
              ? `El investigador solicitó el informe final el ${formatoFecha(f.fecha_solicitud ?? null)}. Habilítalo para que pueda diligenciarlo.`
              : `Tu solicitud del informe final se envió el ${formatoFecha(f.fecha_solicitud ?? null)}. Cuando el Administrador la habilite podrás diligenciarlo.`}
          </Aviso>
        )}
        {!pendiente && esInvestigador && !bloqueado && (
          <div className="seg-acciones">
            <button type="button" className="seg-btn" disabled={ocupado} onClick={() => ejecutar(() => api.solicitarInformeFinal(proyecto.id_proyecto), 'Solicitud del informe final enviada. El Administrador debe habilitarlo para que puedas diligenciarlo.')}>
              Solicitar informe final
            </button>
          </div>
        )}
        {pendiente && esAdmin && !bloqueado && (
          <>
            <textarea placeholder="Observación (obligatoria para rechazar)" value={obsSolicitud} onChange={(e) => setObsSolicitud(e.target.value)} />
            <div className="seg-acciones">
              <button type="button" className="seg-btn" disabled={ocupado} onClick={() => decidir('Habilitar')}>Habilitar informe final</button>
              <button type="button" className="seg-btn seg-btn-borde" disabled={ocupado || !obsSolicitud.trim()} onClick={() => decidir('Rechazar')}>Rechazar solicitud</button>
            </div>
          </>
        )}
      </section>
    )
  }

  return (
    <section className="seg-card">
      <div className="seg-filtros" style={{ marginBottom: 12 }}>
        <div className="seg-header-fila">
          <h3 style={{ margin: 0 }}>Informe técnico final · INV-IC-FR-019</h3>
          <Badge estado={f.estado} />
          {f.fecha_entrega && <span className="seg-ayuda">Entregado el {formatoFecha(f.fecha_entrega)}</span>}
        </div>
        <button type="button" className="seg-btn seg-btn-sec" disabled={ocupado} onClick={() => ejecutar(descargar, 'PDF del informe descargado.')}>
          <Download size={14} /> Descargar informe (PDF)
        </button>
      </div>
      {f.revisado_por && (
        <Aviso tipo="ok"><b>Revisado por {f.revisado_por.nombre}</b> · {formatoFecha(f.revisado_por.fecha)}</Aviso>
      )}
      {f.estado === 'Devuelto' && f.observacion_devolucion && (
        <Aviso tipo="error"><b>Devuelto por la Vicerrectoría:</b> {f.observacion_devolucion}</Aviso>
      )}

      <Pestanas opciones={SECCIONES} activa={seccion} onCambiar={setSeccion} />

      {seccion === 'general' && (
        <>
          <h4>Proyecto</h4>
          <div className="seg-grid">
            <CampoLectura etiqueta="Título del proyecto" valor={proyecto.titulo} />
            <CampoLectura etiqueta="Convocatoria" valor={proyecto.convocatoria} />
            <CampoLectura etiqueta="Centro de costos" valor={proyecto.centro_costos} />
            <CampoLectura etiqueta="Grupo de investigación" valor={proyecto.grupo} />
            <CampoLectura etiqueta="Programa académico" valor={proyecto.programa_academico} />
            <CampoLectura etiqueta="Modalidad" valor={proyecto.modalidad} />
            <CampoLectura etiqueta="Fecha de inicio" valor={formatoFecha(proyecto.fecha_inicio)} />
            <CampoLectura etiqueta="Fecha de finalización" valor={formatoFecha(fechaFin(proyecto))} />
            <CampoLectura etiqueta="Duración" valor={`${duracionTotal(proyecto)} meses`} />
            <label className="seg-campo">
              Área de conocimiento a la que aplica *
              <input disabled={!editable} value={info.area_conocimiento} onChange={(e) => setInfo({ area_conocimiento: e.target.value })} />
            </label>
          </div>

          <CamposPersona titulo="Investigador principal" persona={info.investigador_principal} editable={editable} nombreFijo onCambiar={(investigador_principal) => setInfo({ investigador_principal })} />
          <CamposPersona titulo="Co-investigador interno" persona={info.co_investigador_interno} editable={editable} onCambiar={(co_investigador_interno) => setInfo({ co_investigador_interno })} />
          <CamposPersona titulo="Co-investigador externo" persona={info.co_investigador_externo} editable={editable} onCambiar={(co_investigador_externo) => setInfo({ co_investigador_externo })} />

          <h4>Auxiliares o asistentes de investigación</h4>
          <div className="seg-tabla-wrap">
            <table className="seg-tabla">
              <thead>
                <tr><th>Nombres y apellidos</th><th>Tipo</th><th>Código estudiantil</th><th>Correo electrónico</th>{editable && <th />}</tr>
              </thead>
              <tbody>
                {info.apoyos.length === 0 && <tr><td colSpan={5} className="seg-vacio">Sin auxiliares ni asistentes registrados.</td></tr>}
                {info.apoyos.map((a, i) => (
                  <tr key={i}>
                    <td><input disabled={!editable} value={a.nombre} onChange={(e) => setApoyo(i, { nombre: e.target.value })} /></td>
                    <td>
                      <select disabled={!editable} value={a.tipo} onChange={(e) => setApoyo(i, { tipo: e.target.value as ApoyoInforme['tipo'] })}>
                        <option>Auxiliar</option>
                        <option>Asistente</option>
                      </select>
                    </td>
                    <td><input disabled={!editable} value={a.codigo_estudiantil} onChange={(e) => setApoyo(i, { codigo_estudiantil: e.target.value })} /></td>
                    <td><input type="email" disabled={!editable} value={a.correo} onChange={(e) => setApoyo(i, { correo: e.target.value })} /></td>
                    {editable && (
                      <td className="c">
                        <button type="button" className="seg-icono" aria-label="Quitar" onClick={() => setInfo({ apoyos: info.apoyos.filter((_, j) => j !== i) })}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable && (
            <button type="button" className="seg-link" onClick={() => setInfo({ apoyos: [...info.apoyos, { nombre: '', tipo: 'Auxiliar', codigo_estudiantil: '', correo: '' }] })}>
              <Plus size={14} /> Añadir auxiliar o asistente
            </button>
          )}

          <h4>Lugar de ejecución y recursos</h4>
          <div className="seg-grid">
            <label className="seg-campo">
              Ciudad *
              <input disabled={!editable} value={info.ciudad} onChange={(e) => setInfo({ ciudad: e.target.value })} />
            </label>
            <label className="seg-campo">
              Departamento *
              <input disabled={!editable} value={info.departamento} onChange={(e) => setInfo({ departamento: e.target.value })} />
            </label>
            <CampoLectura etiqueta="Financiación interna" valor={formatoPesos(interna)} />
            <label className="seg-campo">
              Financiación externa
              <input type="number" min={0} disabled={!editable} value={info.financiacion_externa || ''} onChange={(e) => setInfo({ financiacion_externa: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            <CampoLectura etiqueta="Valor total" valor={formatoPesos(interna + info.financiacion_externa)} />
          </div>
        </>
      )}

      {seccion === 'objetivos' && (
        <>
          <h4>2. Resumen del proyecto *</h4>
          <div className="seg-campo-angosto">
            <textarea
              style={{ width: '100%', minHeight: 140 }}
              disabled={!editable}
              value={borrador.resumen}
              onChange={(e) => setBorrador({ ...borrador, resumen: limitarPalabras(e.target.value, borrador.resumen, maxPalabrasResumen) })}
            />
            <small className={`seg-ayuda${contarPalabras(borrador.resumen) > maxPalabrasResumen ? ' seg-error-campo' : ''}`} style={{ display: 'block', textAlign: 'right' }}>
              {contarPalabras(borrador.resumen)}/{maxPalabrasResumen} palabras
            </small>
          </div>
          <h4>3. Cumplimiento de objetivos</h4>
          <div className="seg-tabla-wrap">
            <table className="seg-tabla seg-tabla-objetivos">
              <thead>
                <tr><th>Objetivo (planteado)</th><th>Descripción cumplimiento *</th><th className="c">Cumplido</th></tr>
              </thead>
              <tbody>
                {borrador.objetivos.map((o, i) => (
                  <tr key={o.titulo}>
                    <td><b>{i === 0 ? 'Objetivo general' : `Objetivo específico ${i}`}</b><br />{o.descripcion}</td>
                    <td><textarea maxLength={1000} disabled={!editable} value={o.cumplimiento} onChange={(e) => setObjetivo(i, { cumplimiento: e.target.value })} /></td>
                    <td className="c"><input type="checkbox" aria-label="Cumplido" disabled={!editable} checked={o.cumplido} onChange={(e) => setObjetivo(i, { cumplido: e.target.checked })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="seg-campo seg-campo-angosto" style={{ marginTop: 12 }}>
            Observaciones
            <textarea maxLength={1000} disabled={!editable} value={borrador.observaciones_objetivos} onChange={(e) => setBorrador({ ...borrador, observaciones_objetivos: e.target.value })} />
          </label>
        </>
      )}

      {seccion === 'resultados' && (
        <>
          <div className="seg-kpis" style={{ marginTop: 16 }}>
            <Kpi etiqueta="Proyectado" valor={totales.proyectado} />
            <Kpi etiqueta="Obtenido" valor={totales.obtenido} />
            <Kpi etiqueta="Cumplimiento" valor={`${totales.porcentaje} %`} />
            <Kpi etiqueta="Semáforo" valor={<Badge estado={semaforo.etiqueta} />} />
          </div>
          <p className="seg-ayuda">
            Registra lo obtenido en cada resultado que el proyecto comprometió; los conceptos sin resultados proyectados no se muestran. Cada
            resultado obtenido debe tener su soporte, que puede ser un enlace o un archivo adjunto, y la observación es obligatoria si se obtuvo menos
            de lo proyectado.
          </p>
          {categorias.length === 0 && <p className="seg-vacio">Este proyecto no tiene resultados proyectados.</p>}
          {categorias.map((cat) => (
            <div key={cat.codigo}>
              <h4>{cat.codigo} {cat.nombre}</h4>
              <div className="seg-tabla-wrap">
                <table className="seg-tabla">
                  <thead>
                    <tr><th>Concepto</th><th className="c">Resultados proyectados</th><th className="c">Resultados obtenidos</th><th>Soporte (enlace o archivo)</th><th>Observaciones</th></tr>
                  </thead>
                  <tbody>
                    {cat.conceptos.map((concepto) => {
                      const x = borrador.productos.find((p) => p.nombre === concepto)
                      if (!x) return null
                      const faltantes = faltantesProducto(x)
                      const cantidad = cantidadSoportes(x)
                      return (
                        <tr key={concepto}>
                          <td style={{ maxWidth: 280 }}>{concepto}</td>
                          <td className="c">{x.proyectado}</td>
                          <td className="c">
                            <input type="number" min={0} style={{ width: 80 }} disabled={!editable} value={x.obtenido ?? ''}
                              onChange={(e) => setProducto(concepto, { obtenido: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} />
                            {faltantes.includes('cantidad obtenida') && <span className="seg-error-campo">Obligatorio</span>}
                          </td>
                          <td>
                            <Evidencias evidencias={x.soportes} editable={editable} onAgregar={(ev) => agregarSoporte(concepto, ev)} onQuitar={(k) => quitarSoporte(concepto, k)} />
                            {cantidad > 0 && <small className="seg-ayuda">{x.soportes.length} de {cantidad} soporte{cantidad === 1 ? '' : 's'}</small>}
                            {faltantes.includes('soporte') && (
                              <span className="seg-error-campo">
                                {soportesFaltantes(x) === 1 ? 'Falta 1 soporte (enlace o archivo)' : `Faltan ${soportesFaltantes(x)} soportes (enlaces o archivos)`}
                              </span>
                            )}
                          </td>
                          <td>
                            <textarea disabled={!editable} value={x.observacion} onChange={(e) => setProducto(concepto, { observacion: e.target.value })} />
                            {faltantes.includes('observación') && <span className="seg-error-campo">Obligatoria si se obtuvo menos de lo proyectado</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}

      {seccion === 'adquisiciones' && (
        <>
          <h4>5. Equipos – Software – Licencias</h4>
          <p className="seg-ayuda">Relacionar los equipos adquiridos con los recursos presupuestales del proyecto de investigación.</p>
          <TablaDinamica columnas={COL_EQUIPOS} filas={borrador.equipos} editable={editable} textoAgregar="Añadir equipo, software o licencia" onCambiar={(equipos) => setBorrador({ ...borrador, equipos })} />
          <h4>6. Material bibliográfico</h4>
          <p className="seg-ayuda">Relacionar el material bibliográfico adquirido con los recursos presupuestales del proyecto de investigación.</p>
          <TablaDinamica columnas={COL_MATERIALES} filas={borrador.materiales} editable={editable} textoAgregar="Añadir material" onCambiar={(materiales) => setBorrador({ ...borrador, materiales })} />
        </>
      )}

      {seccion === 'apoyos' && (
        <>
          <h4>7. Participación de auxiliares o asistentes de investigación</h4>
          {info.apoyos.length === 0 ? (
            <p className="seg-ayuda">No hay auxiliares ni asistentes registrados. Se agregan en “1. Información general”.</p>
          ) : (
            <ul className="seg-firmas" style={{ marginBottom: 12 }}>
              {info.apoyos.map((a, i) => (
                <li key={i}>
                  <span className="seg-firma-texto"><span className="seg-firma-rol">{a.nombre || 'Sin nombre'}</span></span>
                  <Badge estado={a.tipo} />
                </li>
              ))}
            </ul>
          )}
          <label className="seg-campo">
            Actividades desarrolladas
            <textarea style={{ minHeight: 90 }} maxLength={2000} disabled={!editable} value={borrador.actividades_apoyos} onChange={(e) => setBorrador({ ...borrador, actividades_apoyos: e.target.value })} />
          </label>
          <label className="seg-campo" style={{ marginTop: 12 }}>
            Evidencias
            <textarea style={{ minHeight: 90 }} maxLength={2000} disabled={!editable} value={borrador.evidencias_apoyos} onChange={(e) => setBorrador({ ...borrador, evidencias_apoyos: e.target.value })} />
          </label>
          <Aviso tipo="info">
            <b>Soportes:</b> las evidencias del proyecto correspondientes a los productos de generación de nuevo conocimiento, apropiación social del
            conocimiento, formación del recurso humano y desarrollo tecnológico e innovación, deben reposar en el drive del correo del grupo de investigación.
          </Aviso>
        </>
      )}

      {seccion === 'firmas' && (
        <>
          <h4>Firmas del informe</h4>
          {abierto && faltan.length > 0 && (
            <Aviso tipo="error">
              Antes de firmar:
              <ul>{faltan.map((x) => <li key={x}>{x}</li>)}</ul>
            </Aviso>
          )}
          {sinGuardar && <Aviso tipo="info">Tienes cambios sin guardar. Guárdalos antes de firmar: se firma lo que está guardado.</Aviso>}
          <p className="seg-ayuda">
            Firman el investigador principal, los co-investigadores y el líder, en ese orden, y todas las firmas son obligatorias para radicar el
            informe. Al aprobarlo, el Administrador firma como quien lo revisó.
          </p>
          <FirmasSecuenciales
            firmas={f.firmas}
            habilitado={!bloqueado && faltan.length === 0 && !sinGuardar && abierto}
            puedeFirmar={(x) => puedeFirmarComo(x.rol, roles)}
            textoConfirmacion="Vas a firmar el informe técnico final. Después de la primera firma el informe ya no se puede editar."
            onFirmar={(i) => ejecutar(() => api.firmarInformeFinal(proyecto.id_proyecto, i), 'Firma registrada.')}
            extras={<FilaRevisadoPor revisado={f.revisado_por} radicado={f.estado === 'Radicado'} numero={f.firmas.length + 1} />}
          />
          {roles.includes('usuario') && !bloqueado && firmasCompletas && abierto && (
            <div className="seg-acciones">
              <button type="button" className="seg-btn" disabled={ocupado} onClick={() => ejecutar(() => api.radicarInformeFinal(proyecto.id_proyecto), 'Informe técnico final radicado. Pasa a revisión de la Vicerrectoría.')}>
                Radicar informe
              </button>
            </div>
          )}
        </>
      )}

      {editable && seccion !== 'firmas' && (
        <div className="seg-acciones">
          <button type="button" className="seg-btn" disabled={ocupado || !sinGuardar} onClick={guardar}>Guardar cambios</button>
        </div>
      )}
    </section>
  )
}

export default InformeFinalTab
