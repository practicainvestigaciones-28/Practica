import { useEffect, useRef, useState } from 'react'
import { Download, ChevronDown } from 'lucide-react'
import * as proyectosApi from '../api/proyectos'
import * as documentosApi from '../api/documentos'
import * as catalogosApi from '../../catalogos/api/catalogos'
import * as usuariosLib from '../../usuarios/lib/usuarios'
import * as productosApi from '../api/productos'
import { generarWordProyecto, generarPdfProyecto } from '../lib/exportarProyecto'
import { ApiError } from '../../../shared/api/client'
import './VistaDetalleProyecto.css'

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
  /** Catálogo completo (todas las categorías/subcategorías/tipos), para mostrar la grilla de resultados esperados aunque casi todo esté en 0. */
  categoriasProducto: productosApi.CategoriaProductoItem[]
  /** Por id_usuario. null = no tiene hoja de vida diligenciada todavía. */
  hojasVida: Map<number, usuariosLib.HojaVidaUsuario | null>
  /** Por id_usuarioproyecto. Solo para participantes con rol "Co investigador(a) Egresado(a) UNICESMAG". */
  egresados: Map<number, proyectosApi.InformacionEgresado | null>
}

interface VistaDetalleProyectoProps {
  id_proyecto: number
}

function formatearMoneda(valor: string | null | undefined): string {
  const n = Number(valor)
  if (!valor || Number.isNaN(n)) return '—'
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function VistaDetalleProyecto({ id_proyecto }: VistaDetalleProyectoProps) {
  const [datos, setDatos] = useState<DatosVistaProyecto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [menuDescargaAbierto, setMenuDescargaAbierto] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const menuDescargaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (menuDescargaRef.current && !menuDescargaRef.current.contains(e.target as Node)) {
        setMenuDescargaAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [])

  useEffect(() => {
    setCargando(true)
    setError('')

    Promise.all([
      proyectosApi.obtenerProyecto(id_proyecto),
      proyectosApi.listarParticipantes(id_proyecto),
      proyectosApi.listarAreasProyecto(id_proyecto),
      proyectosApi.listarProgramasProyecto(id_proyecto),
      proyectosApi.obtenerFinanciacionProyecto(id_proyecto).catch(() => null),
      proyectosApi.listarGruposDelProyecto(id_proyecto),
      proyectosApi.listarObjetivosProyecto(id_proyecto),
      proyectosApi.listarAntecedentesProyecto(id_proyecto),
      proyectosApi.listarReferenciasProyecto(id_proyecto),
      proyectosApi.listarActividadesCronograma(id_proyecto),
      proyectosApi.listarProductosProyecto(id_proyecto),
      documentosApi.listarDocumentosProyecto(id_proyecto),
      catalogosApi.listarFacultades(),
      catalogosApi.listarProgramas(),
      productosApi.listarCategoriasProducto(),
    ])
      .then(
        async ([
          proyecto,
          participantes,
          areas,
          programas,
          financiacion,
          grupos,
          objetivos,
          antecedentes,
          referencias,
          actividades,
          productos,
          documentos,
          facultadesRes,
          programasRes,
          categoriasProducto,
        ]) => {
          const [hojasVidaRes, egresadosRes] = await Promise.all([
            Promise.all(
              participantes.map((p) =>
                usuariosLib
                  .obtenerHojaVida(p.participante)
                  .then((hv) => [p.participante, hv] as const)
                  .catch(() => [p.participante, null] as const)
              )
            ),
            Promise.all(
              participantes
                .filter((p) => p.rolProyecto.nombre === 'Co investigador(a) Egresado(a) UNICESMAG')
                .map((p) =>
                  proyectosApi
                    .obtenerInformacionEgresado(id_proyecto, p.id_usuarioproyecto)
                    .then((eg) => [p.id_usuarioproyecto, eg] as const)
                    .catch(() => [p.id_usuarioproyecto, null] as const)
                )
            ),
          ])

          setDatos({
            proyecto,
            participantes,
            areas,
            programas,
            financiacion,
            grupos,
            objetivos,
            antecedentes,
            referencias,
            actividades,
            productos,
            documentos,
            facultades: new Map(facultadesRes.map((f) => [f.id_facultad, f.nombre])),
            programasCatalogo: new Map(programasRes.map((pr) => [pr.id_programa, pr.nombre])),
            categoriasProducto,
            hojasVida: new Map(hojasVidaRes),
            egresados: new Map(egresadosRes),
          })
        }
      )
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el detalle del proyecto.'))
      .finally(() => setCargando(false))
  }, [id_proyecto])

  const handleDescargar = (doc: documentosApi.DocumentoProyecto) => {
    const extension = doc.archivo.includes('.') ? doc.archivo.slice(doc.archivo.lastIndexOf('.')) : ''
    documentosApi.descargarDocumentoProyecto(id_proyecto, doc.id_proyecto_documento, `${doc.tipoDocumento.nombre}${extension}`)
  }

  const handleDescargarWord = () => {
    if (!datos) return
    setDescargando(true)
    setMenuDescargaAbierto(false)
    generarWordProyecto(datos).finally(() => setDescargando(false))
  }

  const handleDescargarPdf = () => {
    if (!datos) return
    setDescargando(true)
    setMenuDescargaAbierto(false)
    generarPdfProyecto(datos).finally(() => setDescargando(false))
  }

  if (cargando) return <p className="vdp-cargando">Cargando el detalle del proyecto...</p>
  if (error) return <p className="vdp-error">{error}</p>
  if (!datos) return null

  const { proyecto, participantes, areas, programas, financiacion, grupos, objetivos, antecedentes, referencias, actividades, productos, documentos, facultades, hojasVida, egresados } = datos

  const objetivoGeneral = objetivos.find((o) => o.tipo_objetivo === 'general')
  const objetivosEspecificos = objetivos.filter((o) => o.tipo_objetivo !== 'general')

  return (
    <div className="vdp-wrapper">
      <div className="vdp-descarga-wrapper" ref={menuDescargaRef}>
        <button
          type="button"
          className="vdp-descargar-documento-btn"
          onClick={() => setMenuDescargaAbierto((actual) => !actual)}
          disabled={descargando}
        >
          <Download size={16} />
          {descargando ? 'Generando...' : 'Descargar documento'}
          <ChevronDown size={14} />
        </button>

        {menuDescargaAbierto && (
          <div className="vdp-descarga-menu">
            <button type="button" onClick={handleDescargarWord}>Formato Word (.docx)</button>
            <button type="button" onClick={handleDescargarPdf}>Formato PDF</button>
          </div>
        )}
      </div>

      <div className="vdp-seccion">
        <div className="vdp-seccion-header">HOJAS DE VIDA (se diligencia una ficha por cada investigador)</div>
        {participantes.length > 0 ? (
          participantes.map((p) => {
            const hv = hojasVida.get(p.participante)
            const eg = egresados.get(p.id_usuarioproyecto)
            return (
              <div className="vdp-hv-card" key={p.id_usuarioproyecto}>
                <p className="vdp-hv-nombre">
                  {p.usuario.nombre} {p.usuario.apellido} — <em>{p.rolProyecto.nombre}</em>
                </p>
                <div className="vdp-grid-campos">
                  <p><strong>Lugar de nacimiento:</strong> {hv?.lugar_nacimiento ?? '—'}</p>
                  <p><strong>Fecha de nacimiento:</strong> {hv?.fecha_nacimiento ?? '—'}</p>
                  <p><strong>Nacionalidad:</strong> {hv?.nacionalidad ?? '—'}</p>
                  <p><strong>Tipo de documento:</strong> {hv?.tipo_documento ?? '—'}</p>
                  <p><strong>No. Documento:</strong> {hv?.numero_documento ?? '—'}</p>
                  <p><strong>Dirección de residencia:</strong> {hv?.direccion ?? '—'}</p>
                  <p><strong>Correo electrónico:</strong> {p.usuario.correo}</p>
                  <p><strong>Teléfono:</strong> {hv?.telefono ?? '—'}</p>
                  <p><strong>Celular:</strong> {hv?.celular ?? '—'}</p>
                  <p><strong>ORCID:</strong> {p.orcid ?? '—'}</p>
                  <p><strong>Google Académico:</strong> {p.google_academico ?? '—'}</p>
                </div>
                <p><strong>Cargo actual:</strong></p>
                <p className="vdp-texto-largo">{hv?.cargo_actual || '—'}</p>
                <p><strong>Cargos desempeñados:</strong></p>
                <p className="vdp-texto-largo">{hv?.cargos_desempenados || '—'}</p>
                <p><strong>Títulos académicos obtenidos:</strong></p>
                <p className="vdp-texto-largo">{hv?.titulos_academicos || '—'}</p>
                <p><strong>Producción científica y académica:</strong></p>
                <p className="vdp-texto-largo">{hv?.produccion_cientifica || '—'}</p>
                {p.rolProyecto.nombre === 'Co investigador(a) Egresado(a) UNICESMAG' && (
                  <>
                    <p><strong>Información de egresado(a):</strong></p>
                    <div className="vdp-grid-campos">
                      <p><strong>Facultad:</strong> {eg?.facultad ?? '—'}</p>
                      <p><strong>Programa académico:</strong> {eg?.programa_academico ?? '—'}</p>
                      <p><strong>Empresa o entidad:</strong> {eg?.empresa_entidad ?? '—'}</p>
                      <p><strong>Dedicación (horas semanales):</strong> {eg?.dedicacion_horas_semanales ?? '—'}</p>
                      <p><strong>Cédula:</strong> {eg?.cedula ?? '—'}</p>
                    </div>
                  </>
                )}
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
            {participantes.map((p) => (
              <div className="vdp-tabla-row" key={p.id_usuarioproyecto}>
                <span>{p.usuario.nombre} {p.usuario.apellido}</span>
                <span>{p.rolProyecto.nombre}{p.rolEstudiante ? ` — ${p.rolEstudiante.nombre}` : ''}</span>
                <span>{p.dedicacion.nombre}</span>
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
          grupos.map((g) => (
            <div className="vdp-grupo-card" key={g.grupo.id_grupo}>
              <p><strong>Nombre:</strong> {g.grupo.nombre}</p>
              <p><strong>Facultad:</strong> {g.grupo.facultad_otra ?? (g.grupo.id_facultad ? facultades.get(g.grupo.id_facultad) : null) ?? '—'}</p>
              <p><strong>Programa:</strong> {g.grupo.programa_otro ?? '—'}</p>
              <p><strong>Líder del grupo:</strong> {g.grupo.lider_grupo ?? '—'}</p>
              <p><strong>Línea de investigación:</strong> {g.lineaInvestigacion?.nombre ?? '—'}</p>
              <p><strong>ODS:</strong> {g.ods?.nombre ?? '—'}</p>
              <p><strong>Código GrupLAC:</strong> {g.grupo.cod_gruplac ?? '—'}</p>
              <p><strong>Reconocido por Minciencias:</strong> {g.grupo.reconocido_minciencias ? 'Sí' : 'No'}</p>
              <p><strong>Categoría:</strong> {g.grupo.categoria ?? '—'}</p>
            </div>
          ))
        ) : (
          <p className="vdp-vacio">No hay grupos de investigación registrados.</p>
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
                <p key={i} className="vdp-impacto">
                  <strong>Impacto esperado:</strong> {im.impacto_esperado}
                  {im.beneficiario_potencial ? ` — Beneficiario: ${im.beneficiario_potencial}` : ''}
                  {im.indicador_verificable ? ` — Indicador: ${im.indicador_verificable}` : ''}
                </p>
              ))}
            </div>
          ))
        ) : (
          <p className="vdp-vacio">No hay objetivos específicos registrados.</p>
        )}

        <div className="vdp-subtitulo">Antecedentes</div>
        {antecedentes.length > 0 ? (
          <ul className="vdp-lista">
            {antecedentes.map((a, i) => (
              <li key={i}>
                {a.descripcion}
                {a.autor ? ` — ${a.autor}` : ''}
                {a.fuente ? ` (${a.fuente})` : ''}
                {a.fecha_publicacion ? `, ${a.fecha_publicacion}` : ''}
              </li>
            ))}
          </ul>
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
        {actividades.length > 0 ? (
          <div className="vdp-tabla">
            <div className="vdp-tabla-header">
              <span>Actividad</span>
              <span>Resultado</span>
              <span>Responsable(s)</span>
              <span>Programación</span>
            </div>
            {actividades.map((a) => (
              <div className="vdp-tabla-row" key={a.id_actividad}>
                <span>{a.actividad}</span>
                <span>{a.resultado ?? '—'}</span>
                <span>
                  {a.responsable_manual?.trim()
                    ? a.responsable_manual.split('\n').filter(Boolean).join(', ')
                    : a.responsables.map((r) => `${r.usuario.nombre} ${r.usuario.apellido}`).join(', ') || '—'}
                </span>
                <span>
                  {a.periodos.length > 0
                    ? a.periodos.map((pm) => `${pm.periodo.nombre} ${MESES[pm.mes - 1]}/${pm.año}`).join(', ')
                    : '—'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="vdp-vacio">No hay actividades de cronograma registradas.</p>
        )}
      </div>

      <div className="vdp-seccion">
        <div className="vdp-seccion-header">RESULTADOS ESPERADOS</div>
        {productos.length > 0 ? (
          <ul className="vdp-lista">
            {productos.map((p, i) => (
              <li key={i}>
                {p.tipoProducto.subcategoria.categoria.nombre} → {p.tipoProducto.subcategoria.nombre} → {p.tipoProducto.nombre}
                {' '}(cantidad: {p.cantidad})
              </li>
            ))}
          </ul>
        ) : (
          <p className="vdp-vacio">No hay resultados esperados registrados.</p>
        )}
      </div>

      <div className="vdp-seccion">
        <div className="vdp-seccion-header">COMPONENTE ÉTICO</div>
        <p className="vdp-texto-largo">{proyecto.componente_etico || '—'}</p>
        <div className="vdp-subtitulo">Funciones del estudiante auxiliar/asistente</div>
        <p className="vdp-texto-largo">{proyecto.funciones_estudiante_auxiliar || '—'}</p>
      </div>

      <div className="vdp-seccion">
        <div className="vdp-seccion-header">FIRMAS Y ANEXOS</div>
        {documentos.length > 0 ? (
          <div className="vdp-documentos-lista">
            {documentos.map((doc) => (
              <div className="vdp-documento-fila" key={doc.id_proyecto_documento}>
                <span className="vdp-documento-nombre">{doc.tipoDocumento.nombre}</span>
                <span
                  className={`vdp-documento-estado vdp-documento-estado-${
                    doc.aprobado_rechazado === true ? 'aprobado' : doc.aprobado_rechazado === false ? 'rechazado' : 'pendiente'
                  }`}
                >
                  {doc.aprobado_rechazado === true ? 'Aprobado' : doc.aprobado_rechazado === false ? 'Rechazado' : 'Pendiente'}
                </span>
                <button type="button" className="vdp-documento-descargar" onClick={() => handleDescargar(doc)}>
                  <Download size={14} />
                  Descargar
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
