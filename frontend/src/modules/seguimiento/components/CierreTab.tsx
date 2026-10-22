import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Download, XCircle } from 'lucide-react'
import ConfirmModal from '../../../shared/components/common/ConfirmModal'
import * as api from '../api/seguimiento'
import type { CierreProyecto } from '../api/tipos'
import { INTRO_RESULTADOS, MODALIDADES_CIERRE, TEXTO_PAZ_Y_SALVO, TEXTO_SOPORTES, fraseFirmaCierre, indiceModalidad, resultadosCierre } from '../lib/cierre'
import { formatoFecha } from '../lib/formato'
import { duracionTotal, faltantesCierre, fechaFin, prerrequisitosCierre, puedeFirmarComo, siguienteFirma } from '../lib/reglas'
import { Aviso, Badge, CampoLectura, FirmasSecuenciales } from './UI'
import type { PropsPestana } from './props'

type DatosCierre = Omit<CierreProyecto, 'firmas' | 'finalizado'>

const datosDe = ({ firmas: _f, finalizado: _x, ...resto }: CierreProyecto): DatosCierre => resto

const COL_EQUIPOS = ['Equipo / Software / Licencia', 'Fecha de adquisición', 'Estado', 'Código inventario', 'Observaciones']
const COL_MATERIALES = ['Nombre del material', 'Fecha de adquisición', 'ISBN / ISSN', 'Código inventario', 'Observaciones']

/** Tabla de solo lectura de las adquisiciones reportadas en el informe técnico final. */
function TablaAdquisiciones({ columnas, filas }: { columnas: string[]; filas: string[][] }) {
  return (
    <div className="seg-tabla-wrap">
      <table className="seg-tabla">
        <thead>
          <tr>{columnas.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.length === 0 && <tr><td colSpan={columnas.length} className="seg-vacio">Sin registros en el informe técnico final.</td></tr>}
          {filas.map((f, i) => (
            <tr key={i}>{columnas.map((c, j) => <td key={c}>{j === 1 ? formatoFecha(f[j]) : f[j] || '—'}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** M-07: verificación de prerrequisitos y acta de cierre con los numerales del formato INV-IC-FR-021. */
function CierreTab({ proyecto, roles, ejecutar, ocupado, bloqueado }: PropsPestana) {
  const c = proyecto.cierre
  const [datos, setDatos] = useState<DatosCierre>(() => datosDe(c))
  const [confirmarFin, setConfirmarFin] = useState(false)
  const navigate = useNavigate()

  // Al finalizar se vuelve al listado, donde el proyecto ya aparece como Finalizado.
  const finalizar = async () => {
    const ok = await ejecutar(() => api.finalizarProyecto(proyecto.id_proyecto), 'Proyecto finalizado.')
    if (ok) navigate('/seguimiento', { state: { aviso: `El proyecto “${proyecto.titulo}” quedó finalizado.` } })
  }

  useEffect(() => {
    setDatos(datosDe(proyecto.cierre))
  }, [proyecto])

  const prerrequisitos = prerrequisitosCierre(proyecto)
  const pendientes = prerrequisitos.filter((x) => !x.ok).length
  const habilitado = pendientes === 0
  const esAdmin = roles.includes('administrador')
  const hayFirmas = c.firmas.some((x) => x.firmado)
  const editable = esAdmin && habilitado && !hayFirmas && !bloqueado
  const sinGuardar = JSON.stringify(datos) !== JSON.stringify(datosDe(c))
  // Se evalúa sobre lo que está en pantalla: así el aviso se actualiza mientras se diligencia.
  const faltantes = faltantesCierre({ ...c, ...datos, fecha_fin_real: datos.fecha_fin_real || fechaFin(proyecto) })
  const datosCompletos = faltantes.length === 0
  const firmasCompletas = siguienteFirma(c.firmas) === -1

  const { info } = proyecto.informe_final
  const coinvestigador = info.co_investigador_interno.nombre ? info.co_investigador_interno : info.co_investigador_externo
  const modalidad = indiceModalidad(proyecto.modalidad)
  // La fecha de fin real arranca con la fecha calculada (inicio + duración + prórrogas).
  const valorFechaFin = datos.fecha_fin_real || fechaFin(proyecto)
  const categorias = resultadosCierre(proyecto, { ...c, ...datos })

  const setPrograma = (i: number, valor: string) =>
    setDatos((d) => ({ ...d, programas_estudiantes: info.apoyos.map((_, j) => (j === i ? valor : d.programas_estudiantes[j] ?? '')) }))

  const descargar = async () => {
    const { descargarPdfCierre } = await import('../lib/pdfCierre')
    await descargarPdfCierre({ ...proyecto, cierre: { ...c, ...datos, fecha_fin_real: valorFechaFin } })
  }

  return (
    <>
      <section className="seg-card">
        <h3>Verificación de prerrequisitos</h3>
        <ul className="seg-checklist">
          {prerrequisitos.map((x) => (
            <li key={x.titulo}>
              {x.ok ? <CheckCircle2 size={18} className="seg-check-ok" /> : <XCircle size={18} className="seg-check-no" />}
              <span>
                <b>{x.titulo}</b>
                <span className={x.ok ? 'seg-ayuda' : 'seg-error-campo'}>{x.detalle}</span>
              </span>
            </li>
          ))}
        </ul>
        {habilitado ? (
          <Aviso tipo="ok">Todos los prerrequisitos están cumplidos. Se puede diligenciar y firmar el acta de cierre.</Aviso>
        ) : (
          <Aviso tipo="error"><b>Cierre no habilitado.</b> Resuelve los {pendientes} ítem(s) marcados.</Aviso>
        )}
      </section>

      <section className={`seg-card ${habilitado ? '' : 'seg-bloqueado'}`}>
        <div className="seg-filtros" style={{ marginBottom: 4 }}>
          <div className="seg-header-fila">
            <h3 style={{ margin: 0 }}>Acta de cierre · INV-IC-FR-021</h3>
            {c.finalizado && <Badge estado="Finalizado" />}
          </div>
          <button type="button" className="seg-btn seg-btn-sec" disabled={ocupado} onClick={() => ejecutar(descargar, 'PDF del acta de cierre descargado.')}>
            <Download size={14} /> Descargar acta (PDF)
          </button>
        </div>

        {/* Numeral 1 */}
        <h4>1. Información general del proyecto</h4>
        <div className="seg-grid">
          <CampoLectura etiqueta="Título del proyecto" valor={proyecto.titulo} />
          <CampoLectura etiqueta="Centro de costos" valor={proyecto.centro_costos} />
          <CampoLectura etiqueta="Convocatoria interna" valor={proyecto.convocatoria} />
          <CampoLectura etiqueta="Fecha de inicio" valor={formatoFecha(proyecto.fecha_inicio)} />
          <label className="seg-campo">
            Fecha de finalización *
            <input type="date" disabled={!editable} value={valorFechaFin} onChange={(e) => setDatos({ ...datos, fecha_fin_real: e.target.value })} />
          </label>
          <CampoLectura etiqueta="Duración" valor={`${duracionTotal(proyecto)} meses`} />
        </div>
        <div className="seg-campo" style={{ marginBottom: 12 }}>
          Modalidad del proyecto
          <div className="seg-opciones">
            {MODALIDADES_CIERRE.map((m, i) => (
              <span key={m} className={`seg-opcion ${i === modalidad ? 'seg-opcion-activa' : ''}`}>{i === modalidad ? '☒' : '☐'} {m}</span>
            ))}
          </div>
        </div>
        <div className="seg-grid">
          <CampoLectura etiqueta="Nombre investigador(a) principal" valor={info.investigador_principal.nombre} />
          <CampoLectura etiqueta="Programa académico" valor={info.investigador_principal.programa} />
          <CampoLectura etiqueta="Grupo de investigación" valor={info.investigador_principal.grupo} />
          <label className="seg-campo">
            Línea de investigación
            <input disabled={!editable} value={datos.linea_investigacion_principal} onChange={(e) => setDatos({ ...datos, linea_investigacion_principal: e.target.value })} />
          </label>
        </div>
        <div className="seg-grid">
          <CampoLectura etiqueta="Nombre coinvestigador(a)" valor={coinvestigador.nombre} />
          <CampoLectura etiqueta="Programa académico" valor={coinvestigador.programa} />
          <CampoLectura etiqueta="Grupo de investigación" valor={coinvestigador.grupo} />
          <label className="seg-campo">
            Línea de investigación
            <input disabled={!editable} value={datos.linea_investigacion_co} onChange={(e) => setDatos({ ...datos, linea_investigacion_co: e.target.value })} />
          </label>
        </div>
        <div className="seg-tabla-wrap">
          <table className="seg-tabla">
            <thead>
              <tr><th>Nombre estudiante investigador(a)</th><th>Programa académico</th><th>Rol</th></tr>
            </thead>
            <tbody>
              {info.apoyos.length === 0 && <tr><td colSpan={3} className="seg-vacio">El informe técnico final no registra auxiliares ni asistentes.</td></tr>}
              {info.apoyos.map((a, i) => (
                <tr key={i}>
                  <td>{a.nombre || '—'}</td>
                  <td><input disabled={!editable} value={datos.programas_estudiantes[i] ?? ''} onChange={(e) => setPrograma(i, e.target.value)} /></td>
                  <td>{a.tipo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Numeral 2 */}
        <h4>2. Resultados</h4>
        <p className="seg-ayuda">{INTRO_RESULTADOS} Vienen del informe técnico final; aquí solo se registran los libros y capítulos de libro.</p>
        {categorias.map((cat) => (
          <div key={cat.codigo}>
            <h4>{cat.codigo} {cat.nombre} {cat.opcional && <i className="seg-ayuda">(Productos opcionales)</i>}</h4>
            <div className="seg-tabla-wrap">
              <table className="seg-tabla">
                <thead>
                  <tr><th>Concepto</th><th className="c">Resultados proyectados</th><th className="c">Resultados obtenidos</th><th>Soporte (link)</th><th>Observaciones</th></tr>
                </thead>
                <tbody>
                  {cat.filas.map((f) => {
                    const k = f.clave
                    if (!k) {
                      return (
                        <tr key={f.concepto}>
                          <td style={{ maxWidth: 280 }}>{f.concepto}</td>
                          <td className="c">{f.proyectado}</td>
                          <td className="c">{f.obtenido ?? '—'}</td>
                          <td style={{ whiteSpace: 'pre-line' }}>{f.soporte || '—'}</td>
                          <td>{f.observacion || '—'}</td>
                        </tr>
                      )
                    }
                    const kSoporte = `${k}_soporte` as const
                    const kObservacion = `${k}_observacion` as const
                    return (
                      <tr key={f.concepto}>
                        <td>{f.concepto}</td>
                        <td className="c">{f.proyectado}</td>
                        <td className="c">
                          <input type="number" min={0} style={{ width: 80 }} disabled={!editable} aria-label={`${f.concepto} obtenidos`} value={datos[k]}
                            onChange={(e) => setDatos({ ...datos, [k]: Math.max(0, Number(e.target.value) || 0) })} />
                        </td>
                        <td>
                          <input placeholder="https://…" disabled={!editable} aria-label={`${f.concepto} soporte`} value={datos[kSoporte]} onChange={(e) => setDatos({ ...datos, [kSoporte]: e.target.value })} />
                          {datos[k] > 0 && !datos[kSoporte].trim() && <span className="seg-error-campo">Soporte obligatorio</span>}
                        </td>
                        <td>
                          <input disabled={!editable} aria-label={`${f.concepto} observaciones`} value={datos[kObservacion]} onChange={(e) => setDatos({ ...datos, [kObservacion]: e.target.value })} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Numeral 3 */}
        <h4>3. Adquisición de materiales y equipos</h4>
        <h4>3.1 Equipos – Software – Licencias</h4>
        <TablaAdquisiciones columnas={COL_EQUIPOS} filas={proyecto.informe_final.equipos} />
        <h4>3.2 Material bibliográfico</h4>
        <TablaAdquisiciones columnas={COL_MATERIALES} filas={proyecto.informe_final.materiales} />

        <h4>Soportes y declaración de paz y salvo</h4>
        <div className="seg-legal"><b>Soportes:</b> {TEXTO_SOPORTES}</div>
        <div className="seg-legal">{TEXTO_PAZ_Y_SALVO}</div>
        <label className="seg-check">
          <input type="checkbox" disabled={!editable} checked={datos.paz_y_salvo} onChange={(e) => setDatos({ ...datos, paz_y_salvo: e.target.checked })} />
          Declaro el paz y salvo de los investigadores
        </label>
        <div className="seg-grid" style={{ marginTop: 12 }}>
          <label className="seg-campo">
            Ciudad de suscripción *
            <input disabled={!editable} value={datos.ciudad} onChange={(e) => setDatos({ ...datos, ciudad: e.target.value })} />
          </label>
          <label className="seg-campo">
            Fecha del acta *
            <input type="date" disabled={!editable} value={datos.fecha_acta} onChange={(e) => setDatos({ ...datos, fecha_acta: e.target.value })} />
          </label>
        </div>
        <p className="seg-ayuda">{fraseFirmaCierre(datos.ciudad, datos.fecha_acta)}</p>

        {editable && (
          <div className="seg-acciones">
            <button type="button" className="seg-btn" disabled={ocupado || !sinGuardar}
              onClick={() => ejecutar(() => api.guardarCierre(proyecto.id_proyecto, { ...datos, fecha_fin_real: valorFechaFin }), 'Datos del acta de cierre guardados.')}>
              Guardar datos del acta
            </button>
          </div>
        )}

        <h4>Firmas del acta de cierre</h4>
        {habilitado && !c.finalizado && !datosCompletos && (
          <Aviso tipo="error">
            <b>Aún no se puede firmar.</b> Al acta le falta:
            <ul>{faltantes.map((x) => <li key={x}>{x}</li>)}</ul>
          </Aviso>
        )}
        {habilitado && !c.finalizado && datosCompletos && sinGuardar && (
          <Aviso tipo="info">
            Los datos están completos pero <b>sin guardar</b>. Pulsa “Guardar datos del acta” para habilitar las firmas.
          </Aviso>
        )}
        {habilitado && !c.finalizado && datosCompletos && !sinGuardar && !firmasCompletas && (
          <Aviso tipo="ok">El acta está completa y guardada. Pulsa “Firmar” en el firmante que tiene el turno.</Aviso>
        )}
        {habilitado && !c.finalizado && firmasCompletas && (
          <Aviso tipo="ok">Ya están todas las firmas. Pulsa “Finalizar proyecto” para cerrar el proyecto.</Aviso>
        )}
        <FirmasSecuenciales
          firmas={c.firmas}
          habilitado={habilitado && datosCompletos && !sinGuardar && !c.finalizado && !bloqueado}
          puedeFirmar={(x) => puedeFirmarComo(x.rol, roles)}
          textoConfirmacion="Vas a firmar el acta de cierre del proyecto. Se registrará la fecha y no podrás deshacerlo."
          onFirmar={(i) => ejecutar(() => api.firmarCierre(proyecto.id_proyecto, i), 'Firma registrada.')}
        />

        {esAdmin && !c.finalizado && !bloqueado && (
          <div className="seg-acciones">
            <button type="button" className="seg-btn" disabled={ocupado || !firmasCompletas} onClick={() => setConfirmarFin(true)}>
              Finalizar proyecto
            </button>
          </div>
        )}
        {c.finalizado && (
          <Aviso tipo="ok">
            Proyecto <b>finalizado</b>. La edición queda bloqueada; una reapertura excepcional requiere rol autorizado y causal registrada.
          </Aviso>
        )}
      </section>

      {confirmarFin && (
        <ConfirmModal
          mensaje="¿Finalizar el proyecto? Pasará a estado Finalizado y se bloqueará su edición."
          onClose={() => setConfirmarFin(false)}
          botonSecundario={{ label: 'Cancelar', onClick: () => setConfirmarFin(false), variante: 'rojo' }}
          botonPrimario={{
            label: 'Finalizar',
            variante: 'azul',
            onClick: () => {
              setConfirmarFin(false)
              finalizar()
            },
          }}
        />
      )}
    </>
  )
}

export default CierreTab
