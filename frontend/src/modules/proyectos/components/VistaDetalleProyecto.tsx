import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import * as proyectosApi from '../api/proyectos'
import * as documentosApi from '../api/documentos'
import * as productosApi from '../api/productos'
import type * as usuariosLib from '../../usuarios/lib/usuarios'
import { verPdfProyecto } from '../lib/exportarProyecto'
import { cargarDatosVistaProyecto, investigadoresConHojaVida, participantesEnOrden } from '../lib/datosVistaProyecto'
import { ApiError } from '../../../shared/api/client'
import { partesAntecedente } from '../lib/antecedentes'
import { agruparResultados } from '../lib/resultadosEsperados'
import { textoComponenteEtico } from '../lib/componenteEtico'
import './VistaDetalleProyecto.css'

/** "1991-09-15T00:00:00.000Z" o "1991-09-15" -> "15/09/1991" (mismo formato del calendario; sin correr el día por zona horaria). */
function fechaDDMMAAAA(valor: string | null | undefined): string {
  const m = valor?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor || '—'
}

export const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export interface DatosVistaProyecto {
  proyecto: proyectosApi.ProyectoDetalle
  participantes: proyectosApi.ParticipanteProyecto[]
  areas: proyectosApi.AreaDelProyecto[]
  programas: proyectosApi.ProgramaDelProyecto[]
  financiacion: proyectosApi.FinanciacionProyecto | null
  grupos: proyectosApi.GrupoDelProyecto[]
  objetivos: proyectosApi.ObjetivoProyecto[]
  antecedentes: proyectosApi.AntecedenteProyecto[]
  referencias: proyectosApi.ReferenciaProyecto[]
  actividades: proyectosApi.ActividadCronogramaProyecto[]
  productos: proyectosApi.ProductoDelProyecto[]
  documentos: documentosApi.DocumentoProyecto[]
  facultades: Map<number, string>
  /** Catálogo de programas académicos por id (los egresados guardan solo el id). */
  programasCatalogo: Map<number, string>
  /** Catálogo TC/MT/HC (dedicación del director de un grupo externo). */
  dedicaciones?: Map<number, string>
  /** Catálogo completo (todas las categorías/subcategorías/tipos), para mostrar la grilla de resultados esperados aunque casi todo esté en 0. */
  categoriasProducto: productosApi.CategoriaProductoItem[]
  /** Por id_usuario. null = no tiene hoja de vida diligenciada todavía. */
  hojasVida: Map<number, usuariosLib.HojaVidaUsuario | null>
  /** Por id_usuarioproyecto. Solo para participantes con rol "Co investigador(a) Egresado(a) UNICESMAG". */
  egresados: Map<number, proyectosApi.InformacionEgresado | null>
  /** Sección "Información general de egresados" de la pestaña Grupos, tal cual se diligenció. */
  egresadosInfo?: proyectosApi.EgresadosInfoProyecto | null
  /** Hojas de vida de co-investigadores/externos diligenciadas en el proyecto (normalmente sin cuenta). */
  hojasVidaProyecto?: proyectosApi.HojaVidaProyecto[]
  /** Por id_usuarioproyecto. Vacío (sin esa llave) si todavía no se le pidió firma a ese participante — proyectos de antes de esta función, por ejemplo. */
  firmas: Map<
    number,
    {
      firmado: boolean
      fecha_firma: string | null
      id_transaccion: string | null
      hash_firma: string | null
      correo_verificacion_enmascarado: string | null
    }
  >
}

interface VistaDetalleProyectoProps {
  id_proyecto: number
  /** La pantalla que lo contiene ya pone el botón "Ver documento" por su cuenta (antes de la información general). */
  ocultarBotonVerDocumento?: boolean
}

function formatearMoneda(valor: string | null | undefined): string {
  const n = Number(valor)
  if (!valor || Number.isNaN(n)) return '—'
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function VistaDetalleProyecto({ id_proyecto, ocultarBotonVerDocumento = false }: VistaDetalleProyectoProps) {
  const [datos, setDatos] = useState<DatosVistaProyecto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [errorAnexo, setErrorAnexo] = useState('')

  useEffect(() => {
    setCargando(true)
    setError('')

    cargarDatosVistaProyecto(id_proyecto)
      .then(setDatos)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el detalle del proyecto.'))
      .finally(() => setCargando(false))
  }, [id_proyecto])

  /** Abre el anexo en el visor de la aplicación (sin descargarlo). */
  const handleVerAnexo = (doc: documentosApi.DocumentoProyecto) => {
    setErrorAnexo('')
    documentosApi
      .verDocumentoProyecto(id_proyecto, doc.id_proyecto_documento, doc.nombre_original || doc.tipoDocumento.nombre)
      .catch((err) => setErrorAnexo(err instanceof Error && err.message ? err.message : 'No se pudo abrir el documento.'))
  }

  // Abre el PDF en el visor de la aplicación, solo para verlo.
  const handleVerDocumento = () => {
    if (!datos) return
    setErrorAnexo('')
    verPdfProyecto(datos).catch((err) => {
      console.error('No se pudo generar el PDF del proyecto:', err)
      setErrorAnexo(`No se pudo generar el documento del proyecto${err instanceof Error && err.message ? `: ${err.message}` : '.'}`)
    })
  }

  if (cargando) return <p className="vdp-cargando">Cargando el detalle del proyecto...</p>
  if (error) return <p className="vdp-error">{error}</p>
  if (!datos) return null

  const { proyecto, participantes, areas, programas, financiacion, grupos, objetivos, antecedentes, referencias, actividades, productos, documentos, facultades } = datos

  // Un cronograma por cada periodo (como en el formulario y el PDF), en orden
  // cronológico; dentro de cada uno, las actividades en el orden en que se ingresaron.
  const cronogramasPorPeriodo = (() => {
    const bloques = new Map<string, { clave: string; periodo: string; año: number; actividades: typeof actividades }>()
    for (const a of actividades) {
      const primero = a.periodos[0]
      const clave = primero ? `${primero.año}|${primero.periodo.nombre}` : 'sin-periodo'
      const bloque = bloques.get(clave) ?? { clave, periodo: primero?.periodo.nombre ?? '', año: primero?.año ?? Infinity, actividades: [] }
      bloque.actividades.push(a)
      bloques.set(clave, bloque)
    }
    return [...bloques.values()].sort(
      (x, y) => x.año - y.año || x.periodo.localeCompare(y.periodo, 'es', { numeric: true })
    )
  })()

  // Resultados esperados: categoría → subcategorías → tipos, en el orden de la tabla del formulario.
  const resultadosPorCategoria = agruparResultados(productos, datos.categoriasProducto)

  // Anexos en el orden del formulario ("Firmas y anexos"): primero el
  // Presupuesto, luego los opcionales y al final las actas de los estudiantes;
  // dentro de cada tipo, en el orden en que se cargaron.
  const ORDEN_DOCUMENTOS = [
    'Presupuesto Proyectos de Investigación',
    'Consentimiento informado',
    'Asentimiento informado',
    'Carta de Intención',
    'Acta de compromiso estudiantes auxiliares o asistentes',
  ]
  const posicionTipo = (nombre: string) => {
    const i = ORDEN_DOCUMENTOS.indexOf(nombre)
    return i < 0 ? ORDEN_DOCUMENTOS.length : i
  }
  const documentosEnOrden = [...documentos].sort(
    (a, b) =>
      posicionTipo(a.tipoDocumento.nombre) - posicionTipo(b.tipoDocumento.nombre) ||
      a.id_proyecto_documento - b.id_proyecto_documento
  )

  const objetivoGeneral = objetivos.find((o) => o.tipo_objetivo === 'general')
  const objetivosEspecificos = objetivos.filter((o) => o.tipo_objetivo !== 'general')

  // En el orden en que se ingresaron, con la hoja de vida de su cuenta o la diligenciada en el proyecto.
  const participantesConHojaVida = investigadoresConHojaVida(datos)

  return (
    <div className="vdp-wrapper">
      {!ocultarBotonVerDocumento && (
        <div className="vdp-acciones-documento">
          <button type="button" className="vdp-descargar-documento-btn" onClick={handleVerDocumento} title="Ver el documento del proyecto">
            <Eye size={16} />
            Ver documento
          </button>
        </div>
      )}

      <div className="vdp-seccion">
        <div className="vdp-seccion-header">HOJAS DE VIDA (se diligencia una ficha por cada investigador)</div>
        {/* Estudiantes y egresados no diligencian hoja de vida: solo se los
            menciona como participantes (ver la tabla de "Participantes" más abajo). */}
        {participantesConHojaVida.length > 0 ? (
          participantesConHojaVida.map(({ p, hv }) => {
            return (
              <div className="vdp-hv-card" key={p.id_usuarioproyecto}>
                {(() => {
                  const nombres = p.usuario ? p.usuario.nombre : p.nombre_manual ?? ''
                  const apellidos = p.usuario ? p.usuario.apellido : p.apellido_manual ?? ''
                  const iniciales = `${nombres.trim().charAt(0)}${apellidos.trim().charAt(0)}`.toUpperCase() || '?'
                  const campo = (etiqueta: string, valor: string | null | undefined) => (
                    <div className="vdp-hv-campo">
                      <span className="vdp-hv-etiqueta">{etiqueta}</span>
                      <span className="vdp-hv-valor">{valor?.trim() ? valor : '—'}</span>
                    </div>
                  )
                  // Un texto largo (más de ~300 caracteres) ocupa toda la fila; los cortos van en dos columnas.
                  const textoLargo = (titulo: string, valor: string | null | undefined) => (
                    <div className={`vdp-hv-texto${(valor?.length ?? 0) > 300 ? ' vdp-hv-texto-ancho' : ''}`}>
                      <span className="vdp-hv-etiqueta">{titulo}</span>
                      <p>{valor?.trim() ? valor : '—'}</p>
                    </div>
                  )
                  return (
                    <>
                      <div className="vdp-hv-encabezado">
                        <span className="vdp-hv-iniciales" aria-hidden="true">{iniciales}</span>
                        <div className="vdp-hv-identidad">
                          <span className="vdp-hv-nombre">{`${nombres} ${apellidos}`.trim() || '—'}</span>
                          <span className="vdp-hv-rol">{p.rolProyecto.nombre}</span>
                        </div>
                      </div>

                      <div className="vdp-hv-columnas">
                      <div className="vdp-hv-bloque">
                        <span className="vdp-hv-bloque-titulo">Datos personales</span>
                        <div className="vdp-hv-grid">
                          {campo('Lugar de nacimiento', hv?.lugar_nacimiento)}
                          {campo('Fecha de nacimiento', fechaDDMMAAAA(hv?.fecha_nacimiento))}
                          {campo('Nacionalidad', hv?.nacionalidad)}
                          {campo('Tipo de documento', hv?.tipo_documento)}
                          {campo('No. de documento', hv?.numero_documento)}
                          {campo('Dirección de residencia', hv?.direccion)}
                        </div>
                      </div>

                      <div className="vdp-hv-bloque">
                        <span className="vdp-hv-bloque-titulo">Contacto e identificadores</span>
                        <div className="vdp-hv-grid">
                          {campo('Correo electrónico', p.usuario ? p.usuario.correo : p.correo_manual)}
                          {campo('Teléfono', hv?.telefono)}
                          {campo('Celular', hv?.celular)}
                          {campo('ORCID', p.orcid)}
                          {campo('Google Académico', p.google_academico)}
                        </div>
                      </div>
                      </div>

                      <div className="vdp-hv-bloque">
                        <span className="vdp-hv-bloque-titulo">Trayectoria académica y profesional</span>
                        <div className="vdp-hv-textos">
                          {textoLargo('Cargo actual', hv?.cargo_actual)}
                          {textoLargo('Cargos desempeñados', hv?.cargos_desempenados)}
                          {textoLargo('Títulos académicos obtenidos', hv?.titulos_academicos)}
                          {textoLargo('Producción científica y académica', hv?.produccion_cientifica)}
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            )
          })
        ) : (
          <p className="vdp-vacio">No hay participantes registrados.</p>
        )}
      </div>

      <div className="vdp-seccion">
        <div className="vdp-seccion-header">INFORMACIÓN GENERAL</div>
        <div className="vdp-grid-campos">
          <p><strong>Título:</strong> {proyecto.titulo}</p>
          <p><strong>Investigador principal:</strong> {proyecto.creador.nombre} {proyecto.creador.apellido} ({proyecto.creador.correo})</p>
          <p><strong>Convocatoria:</strong> {proyecto.convocatoria?.nombre ?? '—'}</p>
          <p><strong>Modalidad:</strong> {proyecto.modalidad?.nombre ?? '—'}</p>
          <p><strong>Tipo de proyecto:</strong> {proyecto.tipoProyecto?.nombre ?? '—'}</p>
          <p><strong>Duración:</strong> {proyecto.duracion_periodos ?? '—'} periodo(s)</p>
          <p><strong>Ubicación:</strong> {proyecto.ciudad ?? '—'}{proyecto.departamento ? `, ${proyecto.departamento}` : ''}</p>
          <p><strong>Fecha de registro:</strong> {new Date(proyecto.fecha_registro).toLocaleDateString('es-CO')}</p>
          <p><strong>Áreas de conocimiento:</strong> {areas.length > 0 ? areas.map((a) => a.area.nombre).join(', ') : '—'}</p>
          <p>
            <strong>Programa(s) a los que se articula:</strong>{' '}
            {programas.length > 0 ? programas.map((p) => p.programa?.nombre ?? p.programa_otro ?? '—').join(', ') : '—'}
          </p>
        </div>

        <div className="vdp-subtitulo">Financiación</div>
        {financiacion ? (
          <div className="vdp-grid-campos">
            <p><strong>Valor solicitado a UNICESMAG:</strong> {formatearMoneda(financiacion.valor_solicitado_unicesmag)}</p>
            <p><strong>Valor contrapartida:</strong> {formatearMoneda(financiacion.valor_contrapartida)}</p>
            <p><strong>Valor total:</strong> {formatearMoneda(financiacion.valor_total)}</p>
          </div>
        ) : (
          <p className="vdp-vacio">No se registró información de financiación.</p>
        )}

        <div className="vdp-subtitulo">Participantes</div>
        {participantes.length > 0 ? (
          <div className="vdp-tabla">
            <div className="vdp-tabla-header">
              <span>Nombre</span>
              <span>Rol</span>
              <span>Dedicación</span>
              <span>ORCID</span>
            </div>
            {/* En el orden de ingreso. En estudiantes, la dedicación es Auxiliar/Asistente (lo que se marcó), no TC/MT. */}
            {participantesEnOrden(datos).map((p) => (
              <div className="vdp-tabla-row" key={p.id_usuarioproyecto}>
                <span>{p.usuario ? p.usuario.nombre : p.nombre_manual} {p.usuario ? p.usuario.apellido : p.apellido_manual}</span>
                <span>{p.rolProyecto.nombre}</span>
                <span>
                  {p.rolEstudiante
                    ? p.rolEstudiante.nombre.charAt(0).toUpperCase() + p.rolEstudiante.nombre.slice(1)
                    : p.dedicacion.nombre}
                </span>
                <span>{p.orcid ?? '—'}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="vdp-vacio">No hay participantes registrados.</p>
        )}
      </div>

      <div className="vdp-seccion">
        <div className="vdp-seccion-header">GRUPOS DE INVESTIGACIÓN</div>
        {grupos.length > 0 ? (
          grupos.map((g, indice) => {
            const grupo = g.grupo
            // Mismo criterio del PDF: un grupo externo no está en nuestro catálogo de facultades.
            const externo = !grupo.id_facultad && !!grupo.facultad_otra
            const principal = !externo && grupos.findIndex((x) => !(!x.grupo.id_facultad && !!x.grupo.facultad_otra)) === indice
            const facultad = grupo.facultad_otra ?? (grupo.id_facultad ? facultades.get(grupo.id_facultad) : null) ?? '—'
            const programa = grupo.programa_otro ?? (grupo.id_programa ? datos.programasCatalogo.get(grupo.id_programa) : null) ?? '—'
            const dedicacionDirector = grupo.id_dedicacion ? datos.dedicaciones?.get(grupo.id_dedicacion) : null
            const lineasActivas = [...g.lineas.map((l) => l.lineaInvestigacion.nombre), ...grupo.lineas_externas]
            return (
              <div className="vdp-grupo-card" key={grupo.id_grupo}>
                <div className="vdp-grupo-encabezado">
                  <span className="vdp-grupo-nombre">{grupo.nombre}</span>
                  <span className={`vdp-grupo-etiqueta${externo ? ' vdp-grupo-etiqueta-externo' : ''}`}>
                    {externo ? 'Externo' : principal ? 'Grupo principal (adscripción)' : 'CESMAG'}
                  </span>
                </div>
                <div className="vdp-grid-campos">
                  <p><strong>{externo ? 'Universidad / Entidad:' : 'Facultad:'}</strong> {facultad}</p>
                  <p><strong>{externo ? 'Programa / Dependencia:' : 'Programa:'}</strong> {programa}</p>
                  <p><strong>{externo ? 'Director del grupo:' : 'Líder del grupo:'}</strong> {grupo.lider_grupo ?? '—'}</p>
                  {externo && <p><strong>Dedicación del director:</strong> {dedicacionDirector ?? '—'}</p>}
                  <p><strong>Código GrupLAC:</strong> {grupo.cod_gruplac ?? '—'}</p>
                  <p><strong>Reconocido por Minciencias:</strong> {grupo.reconocido_minciencias ? 'Sí' : 'No'}</p>
                  <p><strong>Categoría:</strong> {grupo.categoria ?? '—'}</p>
                  <p className="vdp-campo-ancho"><strong>Acuerdo institucional:</strong> {grupo.acuerdo_institucional ?? '—'}</p>
                  <p className="vdp-campo-ancho"><strong>Línea(s) de investigación:</strong> {lineasActivas.join(', ') || '—'}</p>
                  {externo ? (
                    <p className="vdp-campo-ancho">
                      <strong>Línea(s) medular(es) institucional(es):</strong> {grupo.lineas_medulares.join(', ') || '—'}
                    </p>
                  ) : (
                    <p className="vdp-campo-ancho">
                      <strong>ODS:</strong> {g.odsVarios.length > 0 ? g.odsVarios.map((o) => o.ods.nombre).join(', ') : '—'}
                    </p>
                  )}
                </div>
                {g.investigadores.length > 0 && (
                  <div className="vdp-tabla vdp-tabla-investigadores">
                    <div className="vdp-tabla-header">
                      <span>{externo ? 'Investigadores externos del proyecto' : 'Investigadores UNICESMAG del proyecto'}</span>
                      <span>Dedicación (horas semanales)</span>
                    </div>
                    {g.investigadores.map((inv) => (
                      <div className="vdp-tabla-row" key={inv.id_investigador_grupo}>
                        <span>{inv.nombre_completo}</span>
                        <span>{inv.horas_semanales ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <p className="vdp-vacio">No hay grupos de investigación registrados.</p>
        )}

        {datos.egresadosInfo && (
          <div className="vdp-grupo-card">
            <div className="vdp-grupo-encabezado">
              <span className="vdp-grupo-nombre">Información general de egresados(as)</span>
            </div>
            <div className="vdp-grid-campos">
              <p><strong>Facultad:</strong> {datos.egresadosInfo.id_facultad ? facultades.get(datos.egresadosInfo.id_facultad) ?? '—' : '—'}</p>
              <p><strong>Programa:</strong> {datos.egresadosInfo.id_programa ? datos.programasCatalogo.get(datos.egresadosInfo.id_programa) ?? '—' : '—'}</p>
              <p><strong>Empresa o entidad:</strong> {datos.egresadosInfo.empresa_entidad ?? '—'}</p>
            </div>
            {datos.egresadosInfo.integrantes.length > 0 && (
              <div className="vdp-tabla vdp-tabla-investigadores">
                <div className="vdp-tabla-header">
                  <span>Co investigador(a) egresado(a)</span>
                  <span>Dedicación (horas semanales)</span>
                </div>
                {datos.egresadosInfo.integrantes.map((i) => (
                  <div className="vdp-tabla-row" key={i.id_integrante}>
                    <span>{i.nombre_completo}</span>
                    <span>{i.horas_semanales ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="vdp-seccion">
        <div className="vdp-seccion-header">FORMULACIÓN DEL PROYECTO</div>
        <p><strong>Resumen:</strong></p>
        <p className="vdp-texto-largo">{proyecto.resumen || '—'}</p>
        <p><strong>Planteamiento del problema:</strong></p>
        <p className="vdp-texto-largo">{proyecto.planteamiento_problema || '—'}</p>
        <p><strong>Pregunta de investigación:</strong></p>
        <p className="vdp-texto-largo">{proyecto.pregunta_investigacion || '—'}</p>
        <p><strong>Justificación:</strong></p>
        <p className="vdp-texto-largo">{proyecto.justificacion || '—'}</p>

        <div className="vdp-subtitulo">Objetivo general</div>
        <p className="vdp-texto-largo">{objetivoGeneral?.descripcion || '—'}</p>

        <div className="vdp-subtitulo">Objetivos específicos</div>
        {objetivosEspecificos.length > 0 ? (
          objetivosEspecificos.map((o) => (
            <div className="vdp-objetivo-card" key={o.id_objetivo}>
              <p>{o.descripcion}</p>
              {o.impactos.map((im, i) => (
                <div key={i} className="vdp-impacto">
                  <p><strong>Impacto esperado:</strong> {im.impacto_esperado}</p>
                  {im.beneficiario_potencial && <p><strong>Beneficiario potencial:</strong> {im.beneficiario_potencial}</p>}
                  {im.indicador_verificable && <p><strong>Indicador verificable:</strong> {im.indicador_verificable}</p>}
                </div>
              ))}
            </div>
          ))
        ) : (
          <p className="vdp-vacio">No hay objetivos específicos registrados.</p>
        )}

        <div className="vdp-subtitulo">Antecedentes</div>
        {antecedentes.length > 0 ? (
          <div className="vdp-antecedentes">
            {antecedentes.map((a, i) => {
              // Como en el documento: la línea numerada es el título y lo demás su contenido.
              const { titulo, contenido } = partesAntecedente(a.descripcion)
              const extra = [a.autor, a.fuente, a.fecha_publicacion].filter(Boolean).join(' — ')
              return (
                <div className="vdp-antecedente" key={i}>
                  {titulo && <p className="vdp-antecedente-titulo">{titulo}</p>}
                  {contenido && <p className="vdp-antecedente-contenido">{contenido}</p>}
                  {extra && <p className="vdp-antecedente-contenido">{extra}</p>}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="vdp-vacio">No hay antecedentes registrados.</p>
        )}

        <div className="vdp-subtitulo">Referencias</div>
        {referencias.length > 0 ? (
          <ul className="vdp-lista">
            {referencias.map((r, i) => (
              <li key={i}>{r.referencia}</li>
            ))}
          </ul>
        ) : (
          <p className="vdp-vacio">No hay referencias registradas.</p>
        )}
      </div>

      <div className="vdp-seccion">
        <div className="vdp-seccion-header">MARCO TEÓRICO Y METODOLOGÍA</div>
        <p><strong>Marco teórico preliminar:</strong></p>
        <p className="vdp-texto-largo">{proyecto.marco_teorico || '—'}</p>
        <p><strong>Metodología preliminar propuesta:</strong></p>
        <p className="vdp-texto-largo">{proyecto.metodologia_preliminar || '—'}</p>
      </div>

      <div className="vdp-seccion">
        <div className="vdp-seccion-header">CRONOGRAMA DE ACTIVIDADES</div>
        {cronogramasPorPeriodo.length > 0 ? (
          cronogramasPorPeriodo.map((c, n) => (
            <div className="vdp-cronograma-bloque" key={c.clave}>
              <div className="vdp-subtitulo">
                Cronograma {n + 1}{c.periodo ? ` — ${c.periodo}, ${c.año}` : ' — Sin periodo asignado'}
              </div>
              {/* Igual que en el Comité de Investigación: una columna por mes, marcada con ✓. */}
              <div className="vdp-crono-scroll">
                <div className="vdp-crono-tabla">
                  <div className="vdp-crono-header">
                    <span>Actividad</span>
                    <span>Resultado</span>
                    <span>Responsable(s)</span>
                    {MESES.map((mes) => (
                      <span key={mes} className="vdp-crono-mes">{mes}</span>
                    ))}
                  </div>
                  {c.actividades.map((a) => {
                    const meses = new Set(a.periodos.map((pm) => pm.mes))
                    return (
                      <div className="vdp-crono-row" key={a.id_actividad}>
                        <span>{a.actividad}</span>
                        <span>{a.resultado ?? '—'}</span>
                        <span>
                          {a.responsable_manual?.trim()
                            ? a.responsable_manual.split('\n').filter(Boolean).join(', ')
                            : a.responsables.map((r) => `${r.usuario.nombre} ${r.usuario.apellido}`).join(', ') || '—'}
                        </span>
                        {MESES.map((mes, i) => (
                          <span key={mes} className="vdp-crono-mes">{meses.has(i + 1) ? '✓' : ''}</span>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="vdp-vacio">No hay actividades de cronograma registradas.</p>
        )}
      </div>

      <div className="vdp-seccion">
        <div className="vdp-seccion-header">RESULTADOS ESPERADOS</div>
        {resultadosPorCategoria.length > 0 ? (
          <div className="vdp-resultados-grid">
            {resultadosPorCategoria.map((cat) => (
              <div className="vdp-resultado-card" key={cat.nombre}>
                <div className="vdp-resultado-card-header">
                  <span>{cat.nombre}</span>
                  <span className="vdp-resultado-total">{cat.total} {cat.total === 1 ? 'producto' : 'productos'}</span>
                </div>
                {cat.subcategorias.map((sub) => (
                  <div className="vdp-resultado-sub" key={sub.nombre}>
                    <div className="vdp-resultado-sub-nombre">{sub.nombre}</div>
                    {sub.tipos.map((tipo) => (
                      <div className="vdp-resultado-fila" key={tipo.nombre}>
                        <span>{tipo.nombre}</span>
                        <span className="vdp-resultado-cantidad">{tipo.cantidad}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="vdp-vacio">No hay resultados esperados registrados.</p>
        )}
      </div>

      <div className="vdp-seccion">
        <div className="vdp-seccion-header">COMPONENTE ÉTICO</div>
        <p className="vdp-texto-largo">{textoComponenteEtico(proyecto) || '—'}</p>
        <div className="vdp-subtitulo">Fuentes de financiación</div>
        <p className="vdp-texto-largo">{proyecto.fuentes_financiacion || '—'}</p>
        <div className="vdp-subtitulo">Permisos o licencias pertinentes</div>
        <p className="vdp-texto-largo">{proyecto.permisos_licencias || '—'}</p>
        <div className="vdp-subtitulo">Funciones del estudiante auxiliar/asistente</div>
        <p className="vdp-texto-largo">{proyecto.funciones_estudiante_auxiliar || '—'}</p>
      </div>

      <div className="vdp-seccion">
        <div className="vdp-seccion-header">ANEXOS</div>
        {errorAnexo && <p className="vdp-vacio">{errorAnexo}</p>}
        {documentos.length > 0 ? (
          <div className="vdp-documentos-lista">
            {documentosEnOrden.map((doc) => (
              <div className="vdp-documento-fila" key={doc.id_proyecto_documento}>
                {/* Qué documento es (y, en las Actas de compromiso, de qué estudiante) y cuándo se cargó. El nombre del
                    archivo subido no se muestra: puede no tener nada que ver con el documento. */}
                <span className="vdp-documento-nombre">
                  {doc.tipoDocumento.nombre}
                  {doc.titular ? ` — ${doc.titular}` : ''}
                  <span className="vdp-documento-detalle">Cargado el {new Date(doc.fecha_carga).toLocaleDateString('es-CO')}</span>
                </span>
                <span
                  className={`vdp-documento-estado vdp-documento-estado-${
                    doc.aprobado_rechazado === true ? 'aprobado' : doc.aprobado_rechazado === false ? 'rechazado' : 'pendiente'
                  }`}
                >
                  {doc.aprobado_rechazado === true ? 'Aprobado' : doc.aprobado_rechazado === false ? 'Rechazado' : 'Pendiente de revisión'}
                </span>
                <button
                  type="button"
                  className="vdp-documento-descargar"
                  onClick={() => handleVerAnexo(doc)}
                  aria-label={`Ver ${doc.tipoDocumento.nombre}`}
                  title="Ver documento"
                >
                  <Eye size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="vdp-vacio">El investigador todavía no ha cargado documentos.</p>
        )}
      </div>
    </div>
  )
}

export default VistaDetalleProyecto
