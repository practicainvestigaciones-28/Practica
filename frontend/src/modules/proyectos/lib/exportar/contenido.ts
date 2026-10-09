import type { DatosVistaProyecto } from '../../components/VistaDetalleProyecto'
import type { Bloque, CeldaSpec, DocumentoFormato, Run, SeccionDoc, TablaSpec, Texto } from './modelo'

/** Datos del formato oficial INV-IC-FR-001 (se repiten en el encabezado de cada página). */
export const CODIGO_FORMATO = 'INV-IC-FR-001'
export const VERSION_FORMATO = '7'
export const FECHA_FORMATO = '29/MAY/2026'
export const TITULO_FORMATO = 'PRESENTACIÓN DE PROYECTOS DE INVESTIGACIÓN'

const GRIS = 'D9D9D9'
const AZUL = 'D9E2F3'
const CLARO = 'EDEDED'

const ROL_PRINCIPAL = 'Investigador(a) Principal UNICESMAG'
const ROL_COINV_UNICESMAG = 'Co investigador(a) UNICESMAG'
const ROL_EXTERNO = 'Co investigador(a) Externo(a)'
const ROL_EGRESADO = 'Co investigador(a) Egresado(a) UNICESMAG'
const ROL_ESTUDIANTE = 'Estudiante Investigador(a)'

const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

type Participante = DatosVistaProyecto['participantes'][number]

// ---------- utilidades ----------

function norm(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

function v(x: string | number | null | undefined): string {
  if (x === null || x === undefined) return ''
  return String(x).trim()
}

function moneda(valor: string | null | undefined): string {
  const n = Number(valor)
  if (!valor || Number.isNaN(n)) return '$'
  return `$ ${n.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

function fechaLegible(valor: string | null | undefined): string {
  const s = v(valor)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s
}

function nombreCompleto(p: Participante): string {
  const nombre = p.usuario ? p.usuario.nombre : p.nombre_manual
  const apellido = p.usuario ? p.usuario.apellido : p.apellido_manual
  return `${nombre ?? ''} ${apellido ?? ''}`.trim()
}

function correoParticipante(p: Participante): string {
  return (p.usuario ? p.usuario.correo : p.correo_manual) ?? ''
}

/** Texto en negrita seguido de texto normal, como los títulos de sección del formato. */
function titulado(titulo: string, resto?: string, extra?: Run[]): Run[] {
  const runs: Run[] = [{ t: titulo, b: true }]
  if (resto) runs.push({ t: ` ${resto}` })
  if (extra) runs.push(...extra)
  return runs
}

function celda(w: number, texto?: Texto, o: Partial<CeldaSpec> = {}): CeldaSpec {
  return { w, texto, ...o }
}

const etiqueta = (w: number, texto: Texto, o: Partial<CeldaSpec> = {}) => celda(w, texto, { fondo: GRIS, ...o })
const encabezadoCentrado = (w: number, texto: Texto, o: Partial<CeldaSpec> = {}) =>
  celda(w, texto, { fondo: GRIS, align: 'center', negrita: true, valign: 'middle', ...o })

function tabla(filas: CeldaSpec[][], espacioDespues = 12): Bloque {
  const t: TablaSpec = { filas, espacioDespues }
  return { tipo: 'tabla', tabla: t }
}

/** Caja de una sección del punto 4: título + instrucción del formato + lo diligenciado. */
function caja(w: number, encabezado: Run[], contenido: string, minH: number): CeldaSpec[] {
  const runs: Run[] = [...encabezado]
  if (contenido.trim()) runs.push({ t: `\n${contenido.trim()}` })
  return [celda(w, runs, { minH })]
}

function lista(items: string[]): string {
  return items.map((t, i) => `${i + 1}. ${t}`).join('\n')
}

// ---------- 1. información general ----------

function participantesPorRol(datos: DatosVistaProyecto) {
  const { participantes } = datos
  return {
    principal: participantes.find((p) => p.rolProyecto.nombre === ROL_PRINCIPAL) ?? null,
    coinvestigadores: participantes.filter((p) => p.rolProyecto.nombre === ROL_COINV_UNICESMAG),
    externos: participantes.filter((p) => p.rolProyecto.nombre === ROL_EXTERNO),
    egresados: participantes.filter((p) => p.rolProyecto.nombre === ROL_EGRESADO),
    estudiantes: participantes.filter((p) => p.rolProyecto.nombre === ROL_ESTUDIANTE),
  }
}

function marca(dedicacion: string | undefined, opcion: string): string {
  return norm(dedicacion) === norm(opcion) ? 'X' : ''
}

/** Filas de un investigador/coinvestigador: [rol][nombre][Dedicación][TC/MT/HC] + fila ORCID / Google Académico. */
function filasConDedicacion(
  rol: string,
  p: Participante | null,
  opciones: ('TC' | 'MT' | 'HC')[]
): CeldaSpec[][] {
  const dedic = p?.dedicacion.nombre
  const nombre = p ? nombreCompleto(p) : ''
  const orcid: CeldaSpec[] = [
    etiqueta(165, 'ORCID'),
    celda(119, v(p?.orcid)),
    etiqueta(75, 'Google Académico'),
    celda(145, v(p?.google_academico)),
  ]

  // Si la dedicación registrada no está entre las que muestra el formato para este rol, se deja constancia igual.
  const fueraDeFormato = dedic && !opciones.some((o) => norm(o) === norm(dedic)) ? dedic : ''

  if (opciones.length === 1) {
    return [
      [
        etiqueta(165, `${rol}:`),
        celda(119, nombre),
        celda(75, 'Dedicación:', { align: 'right', valign: 'middle' }),
        celda(145, `TC: ${marca(dedic, 'TC')}${fueraDeFormato ? `   ${fueraDeFormato}: X` : ''}`),
      ],
      orcid,
    ]
  }
  if (opciones.length === 2) {
    return [
      [
        etiqueta(165, `${rol}:`),
        celda(119, nombre),
        celda(75, 'Dedicación:', { align: 'right', valign: 'middle' }),
        celda(90, `TC: ${marca(dedic, 'TC')}`),
        celda(55, `MT: ${marca(dedic, 'MT')}${fueraDeFormato ? `\n${fueraDeFormato}: X` : ''}`),
      ],
      orcid,
    ]
  }
  return [
    [
      etiqueta(165, `${rol}:`, { rowSpan: 2 }),
      celda(119, nombre, { rowSpan: 2 }),
      celda(75, 'Dedicación:', { align: 'right', valign: 'middle', rowSpan: 2 }),
      celda(90, `TC: ${marca(dedic, 'TC')}`),
      celda(55, `MT: ${marca(dedic, 'MT')}`),
    ],
    [celda(145, `HC: ${marca(dedic, 'HC')}${fueraDeFormato ? `   ${fueraDeFormato}: X` : ''}`)],
    orcid,
  ]
}

function filasInformacionGeneral(datos: DatosVistaProyecto): CeldaSpec[][] {
  const { proyecto } = datos
  const { principal, coinvestigadores, externos, egresados, estudiantes } = participantesPorRol(datos)
  const filas: CeldaSpec[][] = []

  filas.push([encabezadoCentrado(504, '1. INFORMACIÓN GENERAL DEL PROYECTO')])
  filas.push([celda(504, titulado('Título:', undefined, [{ t: ` ${v(proyecto.titulo)}` }]), { minH: 40 })])

  filas.push(...filasConDedicacion('Investigador(a) Principal UNICESMAG', principal, ['TC']))
  // Filas de roles opcionales: solo se incluyen si el proyecto realmente
  // tiene a alguien en ese rol — nada de filas en blanco de relleno.
  for (const p of coinvestigadores) {
    filas.push(...filasConDedicacion('Co investigador(a) UNICESMAG', p, ['TC', 'MT']))
  }
  for (const p of externos) {
    filas.push(...filasConDedicacion('Co investigador(a) Externo(a)', p, ['TC', 'MT', 'HC']))
  }
  for (const p of egresados) {
    const cedula = v(datos.egresados.get(p.id_usuarioproyecto)?.cedula)
    filas.push([
      etiqueta(165, 'Co investigador(a) Egresado(a) UNICESMAG'),
      celda(119, nombreCompleto(p)),
      celda(220, `Cédula: ${cedula}`),
    ])
  }
  for (const p of estudiantes) {
    const rolEst = norm(p.rolEstudiante?.nombre)
    filas.push([
      etiqueta(165, 'Estudiante Investigador(a)', { rowSpan: 2 }),
      celda(119, nombreCompleto(p), { rowSpan: 2 }),
      celda(114, 'Código estudiantil', { size: 8.5 }),
      celda(51, 'Auxiliar', { align: 'center', size: 8.5 }),
      celda(55, 'Asistente', { align: 'center', size: 8.5 }),
    ])
    filas.push([
      celda(114, v(p.codigo_estudiantil), { size: 9 }),
      celda(51, rolEst.includes('auxiliar') ? 'X' : '', { align: 'center' }),
      celda(55, rolEst.includes('asistente') ? 'X' : '', { align: 'center' }),
    ])
  }

  // Modalidad — solo la fila de la modalidad elegida, no las demás en blanco.
  filas.push([encabezadoCentrado(504, titulado('Modalidad del proyecto', '(señalar con una x)').map((r, i) => (i === 1 ? { ...r, b: false } : r)))])
  if (proyecto.modalidad?.nombre) {
    filas.push([
      celda(463, proyecto.modalidad.nombre, { valign: 'middle' }),
      celda(41, 'X', { align: 'center', valign: 'middle' }),
    ])
  }

  // Áreas de conocimiento — una fila por cada área realmente seleccionada.
  filas.push([encabezadoCentrado(504, titulado('Área de conocimiento a la que aplica', '(señalar con una x)').map((r, i) => (i === 1 ? { ...r, b: false } : r)))])
  for (const a of datos.areas) {
    filas.push([
      celda(463, a.area.nombre, { valign: 'middle' }),
      celda(41, 'X', { align: 'center', valign: 'middle' }),
    ])
  }

  // Programas de pregrado o posgrado
  const programas = datos.programas.map((p) => p.programa?.nombre ?? v(p.programa_otro)).filter(Boolean)
  const nFilasProg = Math.max(3, programas.length)
  for (let i = 0; i < nFilasProg; i++) {
    const valor = celda(317, programas[i] ?? '')
    filas.push(
      i === 0
        ? [celda(195, 'Programa(s) de pregrado o posgrado al que se articula.', { fondo: CLARO, rowSpan: nFilasProg, valign: 'middle' }), valor]
        : [valor]
    )
  }

  // Lugar de ejecución
  filas.push([encabezadoCentrado(504, 'Lugar de Ejecución del Proyecto')])
  filas.push([
    celda(125, `Ciudad: ${v(proyecto.ciudad)}`, { minH: 32 }),
    celda(122, `Departamento: ${v(proyecto.departamento)}`),
    celda(265, `Duración del proyecto (en periodos): ${v(proyecto.duracion_periodos)}`),
  ])

  // Tipo de proyecto — solo la fila del tipo elegido.
  filas.push([encabezadoCentrado(504, titulado('Tipo de Proyecto', '(señalar con una x)').map((r, i) => (i === 1 ? { ...r, b: false } : r)))])
  if (proyecto.tipoProyecto?.nombre) {
    filas.push([
      celda(463, proyecto.tipoProyecto.nombre, { valign: 'middle' }),
      celda(41, 'X', { align: 'center', valign: 'middle' }),
    ])
  }

  // Financiación
  filas.push([encabezadoCentrado(504, 'Financiación Total Solicitada')])
  filas.push([celda(200, 'Valor solicitado UNICESMAG'), celda(304, moneda(datos.financiacion?.valor_solicitado_unicesmag))])
  filas.push([celda(200, 'Valor contrapartida'), celda(304, moneda(datos.financiacion?.valor_contrapartida))])
  filas.push([celda(200, 'Valor total'), celda(304, moneda(datos.financiacion?.valor_total))])

  return filas
}

// ---------- 2. grupos y egresados ----------

const TAM_GRUPO = 9.5

function filaValor(etiquetaTxt: string, valor: string): CeldaSpec[] {
  return [celda(146, etiquetaTxt, { size: TAM_GRUPO }), celda(378, valor, { size: TAM_GRUPO })]
}

function bloqueGrupo(
  g: DatosVistaProyecto['grupos'][number] | null,
  externo: boolean,
  primero: boolean,
  datos: DatosVistaProyecto,
  investigadores: Participante[]
): Bloque {
  const filas: CeldaSpec[][] = []
  const prefijo = primero ? '2. ' : ''
  filas.push([
    encabezadoCentrado(
      524,
      externo
        ? 'INFORMACIÓN GENERAL DEL GRUPO DE INVESTIGACIÓN EXTERNO'
        : `${prefijo}INFORMACIÓN GENERAL DEL GRUPO DE INVESTIGACIÓN AL CUAL ESTÁ ADSCRITO EL PROYECTO EN UNICESMAG`,
      { size: TAM_GRUPO }
    ),
  ])

  const grupo = g?.grupo
  const facultad = grupo ? v(grupo.facultad_otra ?? (grupo.id_facultad ? datos.facultades.get(grupo.id_facultad) : '')) : ''
  filas.push(filaValor(externo ? 'Universidad / Entidad' : 'Facultad/Departamento:', facultad))
  filas.push(filaValor(externo ? 'Programa Académico/ Dependencia' : 'Programa Académico:', v(grupo?.programa_otro)))
  filas.push(filaValor('Nombre del Grupo:', v(grupo?.nombre)))
  filas.push(filaValor(externo ? 'Director del Grupo:' : 'Líder del grupo:', v(grupo?.lider_grupo)))

  const reconocido = grupo?.reconocido_minciencias
  filas.push([
    celda(102, 'Código GrupLac:', { size: TAM_GRUPO }),
    celda(174, 'Reconocido por MINCIENCIAS', { align: 'center', size: TAM_GRUPO }),
    celda(93, 'Categoría', { align: 'center', size: TAM_GRUPO }),
    celda(155, 'Acuerdo Institucional', { align: 'center', size: TAM_GRUPO }),
  ])
  filas.push([
    celda(102, v(grupo?.cod_gruplac), { size: TAM_GRUPO, minH: 20 }),
    celda(43, 'SI', { align: 'center', size: TAM_GRUPO }),
    celda(43, grupo && reconocido ? 'X' : '', { align: 'center', size: TAM_GRUPO }),
    celda(40, 'NO', { align: 'center', size: TAM_GRUPO }),
    celda(48, grupo && !reconocido ? 'X' : '', { align: 'center', size: TAM_GRUPO }),
    celda(93, v(grupo?.categoria), { align: 'center', size: TAM_GRUPO }),
    celda(155, v(grupo?.acuerdo_institucional), { align: 'center', size: TAM_GRUPO }),
  ])

  if (externo) {
    filas.push([
      celda(334, 'Línea activa de Investigación en la cual está vinculado el proyecto:', { size: TAM_GRUPO, valign: 'middle' }),
      celda(190, v(g?.lineaInvestigacion?.nombre), { size: TAM_GRUPO }),
    ])
    filas.push([
      celda(334, 'Línea medular Institucional en la cual está asociado el proyecto (Obligatorio):', { size: TAM_GRUPO, valign: 'middle' }),
      celda(190, v(grupo?.linea_medular), { size: TAM_GRUPO }),
    ])
  } else {
    filas.push([
      celda(334, 'Línea activa de investigación a la cual está vinculado el proyecto (Obligatorio):', { size: TAM_GRUPO, valign: 'middle' }),
      celda(190, v(g?.lineaInvestigacion?.nombre ?? grupo?.linea_medular), { size: TAM_GRUPO }),
    ])
    filas.push([
      celda(334, 'Objetivo(s) de Desarrollo Sostenible ODS en el (los) cual(es) está asociado el proyecto (Obligatorio):', { size: TAM_GRUPO, valign: 'middle' }),
      celda(190, v(g?.odsVarios.map((o) => o.ods.nombre).join(', ')), { size: TAM_GRUPO }),
    ])
  }

  filas.push([
    encabezadoCentrado(334, externo ? 'Investigadores externos del proyecto' : 'Investigadores UNICESMAG del proyecto', { size: TAM_GRUPO }),
    encabezadoCentrado(190, 'Dedicación', { size: TAM_GRUPO }),
  ])
  for (const p of investigadores) {
    filas.push([celda(334, nombreCompleto(p), { size: TAM_GRUPO, minH: 14 }), celda(190, p.dedicacion.nombre, { size: TAM_GRUPO })])
  }
  return tabla(filas, 16)
}

function bloquesGrupos(datos: DatosVistaProyecto): Bloque[] {
  const { principal, coinvestigadores, externos, estudiantes } = participantesPorRol(datos)
  const internos = [principal, ...coinvestigadores, ...estudiantes].filter((p): p is Participante => p !== null)
  const esExterno = (g: DatosVistaProyecto['grupos'][number]) => !g.grupo.id_facultad && !!g.grupo.facultad_otra

  // Sin grupo registrado no hay nada que mostrar en esta sección — se omite
  // por completo en vez de dejar una tabla en blanco.
  const grupos = datos.grupos
  const lista: { g: DatosVistaProyecto['grupos'][number]; externo: boolean }[] = grupos.map((g) => ({ g, externo: esExterno(g) }))

  return lista.map(({ g, externo }, i) => bloqueGrupo(g, externo, i === 0, datos, externo ? externos : internos))
}

function bloquesEgresados(datos: DatosVistaProyecto): Bloque[] {
  const { egresados } = participantesPorRol(datos)
  // Sin co-investigadores egresados no hay nada que mostrar en esta sección.
  return egresados.map((p) => {
    const eg = datos.egresados.get(p.id_usuarioproyecto)
    const facultad = v(eg?.facultad) || (eg?.id_facultad ? v(datos.facultades.get(eg.id_facultad)) : '')
    const programa = v(eg?.programa_academico) || (eg?.id_programa ? v(datos.programasCatalogo.get(eg.id_programa)) : '')
    return tabla(
      [
        [encabezadoCentrado(524, 'INFORMACIÓN GENERAL DE EGRESADOS(AS)', { size: TAM_GRUPO })],
        [celda(138, 'Facultad', { size: TAM_GRUPO }), celda(386, facultad, { size: TAM_GRUPO })],
        [celda(138, 'Programa Académico', { size: TAM_GRUPO }), celda(386, programa, { size: TAM_GRUPO })],
        [celda(138, 'Empresa o Entidad', { size: TAM_GRUPO }), celda(386, v(eg?.empresa_entidad), { size: TAM_GRUPO })],
        [
          encabezadoCentrado(277, 'Co Investigador(a) Egresado(a)', { size: TAM_GRUPO, fondo: AZUL }),
          encabezadoCentrado(247, 'Dedicación (Horas semanales)', { size: TAM_GRUPO, fondo: AZUL }),
        ],
        [celda(277, nombreCompleto(p), { size: TAM_GRUPO, minH: 16 }), celda(247, v(eg?.dedicacion_horas_semanales), { size: TAM_GRUPO })],
      ],
      16
    )
  })
}

// ---------- 3 y 4. resumen y descripción ----------

function tablaResumen(datos: DatosVistaProyecto): Bloque {
  return tabla(
    [
      [encabezadoCentrado(528, titulado('3. RESUMEN', '(Máximo 200 palabras)').map((r, i) => (i === 1 ? { ...r, b: false } : r)))],
      [celda(528, v(datos.proyecto.resumen), { minH: 130 })],
    ],
    16
  )
}

function tablaDescripcion(datos: DatosVistaProyecto): Bloque {
  const { proyecto } = datos
  const general = datos.objetivos.find((o) => o.tipo_objetivo === 'general')
  const especificos = datos.objetivos.filter((o) => o.tipo_objetivo !== 'general')
  const impactos = datos.objetivos.flatMap((o) => o.impactos)

  const objetivos =
    (general ? `Objetivo general: ${general.descripcion}` : '') +
    (especificos.length ? `${general ? '\n\n' : ''}Objetivos específicos:\n${lista(especificos.map((o) => o.descripcion))}` : '')

  const antecedentes = lista(
    datos.antecedentes.map(
      (a) =>
        `${a.descripcion}${a.autor ? ` — ${a.autor}` : ''}${a.fuente ? ` (${a.fuente})` : ''}${a.fecha_publicacion ? `, ${fechaLegible(a.fecha_publicacion)}` : ''}`
    )
  )

  const cabezaImpacto = (t: string) => encabezadoCentrado(176, t, { fondo: GRIS })
  const filas: CeldaSpec[][] = [
    [
      encabezadoCentrado(
        530,
        [
          { t: '4. DESCRIPCIÓN DEL PROYECTO', b: true },
          { t: ' (Letra Arial 12, espacio sencillo)\n(No diligenciar este espacio)' },
        ]
      ),
    ],
    caja(530, titulado('4.1. PLANTEAMIENTO DEL PROBLEMA', '(máximo 600 palabras y al menos 2 citas con sus correspondientes referencias)'), v(proyecto.planteamiento_problema), 90),
    caja(530, titulado('4.1.1 PREGUNTA DE INVESTIGACIÓN', '(Formular una pregunta acorde con el planteamiento del problema y que esté alineada con el objetivo general del estudio)'), v(proyecto.pregunta_investigacion), 70),
    caja(530, titulado('4.2 JUSTIFICACIÓN', '(Máximo 500 palabras)'), v(proyecto.justificacion), 110),
    caja(530, titulado('4.3 OBJETIVOS GENERAL Y ESPECÍFICOS'), objetivos, 110),
    caja(530, titulado('4.4 ANTECEDENTES', '(5 antecedentes como máximo, preferiblemente en los últimos 5 años)'), antecedentes, 110),
    caja(530, titulado('4.5 MARCO TEORICO PRELIMINAR', '(Máximo 2000 palabras y al menos 10 citas con sus correspondientes referencias preferiblemente de los últimos 5 años)'), v(proyecto.marco_teorico), 110),
    caja(530, titulado('4.6 METODOLOGÍA PRELIMINAR PROPUESTA', '(Mencionar Paradigma, Enfoque, Método, Técnicas de recolección de información y demás aspectos pertinentes al enfoque. Además, determinar las acciones por cada objetivo específico)'), v(proyecto.metodologia_preliminar), 110),
    [celda(530, titulado('4.7  IMPACTO', '(Por cada objetivo específico)'))],
    [cabezaImpacto('IMPACTO ESPERADO'), cabezaImpacto('BENEFICIARIO POTENCIAL'), cabezaImpacto('INDICADOR VERIFICABLE')],
  ]
  for (const im of impactos) {
    filas.push([celda(176, v(im.impacto_esperado), { minH: 14 }), celda(176, v(im.beneficiario_potencial)), celda(178, v(im.indicador_verificable))])
  }
  filas.push(caja(530, titulado('4.8  REFERENCIAS'), datos.referencias.map((r) => r.referencia).join('\n'), 130))
  return tabla(filas, 18)
}

// ---------- 4.9 cronograma ----------

interface GrupoCronograma {
  periodo: string
  año: string
  filas: { actividad: string; resultado: string; responsable: string; meses: Set<number> }[]
}

function agruparCronograma(datos: DatosVistaProyecto): GrupoCronograma[] {
  const grupos = new Map<string, GrupoCronograma>()
  for (const a of datos.actividades) {
    const responsable =
      v(a.responsable_manual) || a.responsables.map((r) => `${r.usuario.nombre} ${r.usuario.apellido}`.trim()).join(', ')
    const porClave = new Map<string, { periodo: string; año: string; meses: Set<number> }>()
    for (const pm of a.periodos) {
      const clave = `${pm.periodo.nombre}|${pm.año}`
      const e = porClave.get(clave) ?? { periodo: pm.periodo.nombre, año: String(pm.año), meses: new Set<number>() }
      e.meses.add(pm.mes)
      porClave.set(clave, e)
    }
    for (const [clave, e] of porClave) {
      const g = grupos.get(clave) ?? { periodo: e.periodo, año: e.año, filas: [] }
      g.filas.push({ actividad: a.actividad, resultado: v(a.resultado), responsable, meses: e.meses })
      grupos.set(clave, g)
    }
  }
  return [...grupos.values()].sort((x, y) => Number(x.año) - Number(y.año) || x.periodo.localeCompare(y.periodo, 'es', { numeric: true }))
}

function bloquesCronograma(datos: DatosVistaProyecto): Bloque[] {
  const grupos = agruparCronograma(datos)
  // Sin actividades de cronograma no hay nada que mostrar en esta sección.
  if (grupos.length === 0) return []

  const bloques: Bloque[] = [tabla([[celda(530, titulado('4.9 CRONOGRAMA DE ACTIVIDADES'), { fondo: GRIS, minH: 34 })]], 0)]
  const mesW = 22.4
  for (const g of grupos) {
    const filas: CeldaSpec[][] = [
      [
        encabezadoCentrado(94, 'Actividad', { fondo: AZUL, rowSpan: 2 }),
        encabezadoCentrado(79, 'Resultado', { fondo: AZUL, rowSpan: 2 }),
        encabezadoCentrado(88, 'Responsable', { fondo: AZUL, rowSpan: 2 }),
        encabezadoCentrado(mesW * 12, `${g.periodo} – Año ${g.año} / Mes`, { fondo: AZUL, size: 9.5 }),
      ],
      Array.from({ length: 12 }, (_, i) => encabezadoCentrado(mesW, String(i + 1), { fondo: AZUL, size: 8.5, negrita: false })),
    ]
    for (const f of g.filas) {
      filas.push([
        celda(94, f.actividad, { size: 9, minH: 16 }),
        celda(79, f.resultado, { size: 9 }),
        celda(88, f.responsable, { size: 9 }),
        ...Array.from({ length: 12 }, (_, m) => celda(mesW, f.meses.has(m + 1) ? 'X' : '', { align: 'center', valign: 'middle', size: 9 })),
      ])
    }
    bloques.push(tabla(filas, 12))
  }
  return bloques
}

// ---------- 4.10 resultados esperados (horizontal) ----------

type Categoria = DatosVistaProyecto['categoriasProducto'][number]

function bloquesResultados(datos: DatosVistaProyecto): Bloque[] {
  const cantidades = new Map<string, number>()
  for (const p of datos.productos) {
    const clave = `${norm(p.tipoProducto.subcategoria.categoria.nombre)}|${norm(p.tipoProducto.subcategoria.nombre)}|${norm(p.tipoProducto.nombre)}`
    cantidades.set(clave, (cantidades.get(clave) ?? 0) + p.cantidad)
  }

  const categorias = datos.categoriasProducto.filter((c) => c.activo && c.subcategorias.some((s) => s.tipos.length > 0))

  /** Filas (solo las celdas nuevas de esa mitad) de una categoría, con el ancho total de la mitad. */
  function filasDeMitad(cat: Categoria, anchoTotal: number): CeldaSpec[][] {
    const subsFiltradas = cat.subcategorias.filter((s) => s.tipos.length > 0)
    const dosNiveles = subsFiltradas.every((s) => s.tipos.length === 1 && norm(s.tipos[0].nombre) === norm(s.nombre))
    const anchoCant = anchoTotal === 315 ? 70 : 63
    const wSub = anchoTotal === 315 ? 126 : 111
    const wTipo = anchoTotal - wSub - anchoCant
    const filas: CeldaSpec[][] = []
    const cant = (sub: string, tipo: string) => {
      const n = cantidades.get(`${norm(cat.nombre)}|${norm(sub)}|${norm(tipo)}`) ?? 0
      return n > 0 ? String(n) : ''
    }
    const tam = 9

    for (const sub of subsFiltradas) {
      const simple = sub.tipos.length === 1 && norm(sub.tipos[0].nombre) === norm(sub.nombre)
      if (dosNiveles || simple) {
        filas.push([
          celda(anchoTotal - anchoCant, sub.nombre, { size: tam, valign: 'middle' }),
          celda(anchoCant, cant(sub.nombre, sub.tipos[0].nombre), { size: tam, align: 'center', valign: 'middle' }),
        ])
        continue
      }
      const conNota = norm(sub.nombre).includes('articulos de investigacion')
      const n = sub.tipos.length + (conNota ? 1 : 0)
      sub.tipos.forEach((tipo, i) => {
        const fila: CeldaSpec[] = []
        if (i === 0) fila.push(celda(wSub, sub.nombre, { size: tam, rowSpan: n, valign: 'middle' }))
        fila.push(celda(wTipo, tipo.nombre, { size: tam, valign: 'middle' }))
        fila.push(celda(anchoCant, cant(sub.nombre, tipo.nombre), { size: tam, align: 'center', valign: 'middle' }))
        filas.push(fila)
      })
      if (conNota) {
        filas.push([
          celda(wTipo + anchoCant, [
            { t: 'Nota. ', b: true },
            { t: 'Se sugiere que la categorización de la revista esté asociada a un cuartil Q1, Q2, Q3 o Q4 de JCR o SJR' },
          ], { size: tam, minH: 40 }),
        ])
      }
    }
    return filas
  }

  const bloques: Bloque[] = [
    tabla([[celda(797, titulado('4.10   RESULTADOS ESPERADOS:'), { fondo: GRIS, minH: 26, valign: 'middle', size: 11 })]], 12),
  ]

  for (let i = 0; i < categorias.length; i += 2) {
    const izq = categorias[i]
    const der = categorias[i + 1]
    const filas: CeldaSpec[][] = [
      [
        encabezadoCentrado(797, [
          { t: 'PRODUCTOS DE LA INVESTIGACIÓN\n', b: true },
          { t: '(Registre el número de productos que se obtendrá por cada categoría)', b: true },
        ], { size: 9.5 }),
      ],
    ]
    const cabeza = (cat: Categoria, ancho: number, wNum: number) => [
      encabezadoCentrado(ancho - wNum, [{ t: cat.nombre, b: true }, { t: '\n(Selección obligatoria)', b: false }], { fondo: AZUL, size: 9.5 }),
      encabezadoCentrado(wNum, 'Número de productos', { fondo: AZUL, size: 9 }),
    ]
    filas.push([...cabeza(izq, 315, 70), ...(der ? cabeza(der, 482, 63) : [celda(482, '', { bordes: false })])])

    const filasIzq = filasDeMitad(izq, 315)
    const filasDer = der ? filasDeMitad(der, 482) : []
    // Cada elemento de filasIzq/filasDer es una fila real (los rowSpan no añaden celdas en las filas que cubren),
    // así que se emparejan por índice; la mitad más corta se completa con celdas sin borde.
    const alto = Math.max(filasIzq.length, filasDer.length)
    for (let r = 0; r < alto; r++) {
      filas.push([
        ...(filasIzq[r] ?? [celda(315, '', { bordes: false })]),
        ...(filasDer[r] ?? [celda(482, '', { bordes: false })]),
      ])
    }
    bloques.push(tabla(filas, 14))
  }
  return bloques
}

// ---------- 4.11 en adelante ----------

function bloquesCierre(datos: DatosVistaProyecto): Bloque[] {
  const { proyecto } = datos
  const { principal, coinvestigadores, externos, egresados } = participantesPorRol(datos)

  const componenteEtico = [
    { t: '4.11  COMPONENTE ÉTICO', b: true },
    { t: '\n\n(Determinar si se va o no a utilizar consentimiento informado)\n(Determinar si se va o no a utilizar asentimiento informado)\n(Determinar si se puede colocar en riesgo a seres humanos y medio ambiente)\n\n' },
    { t: v(proyecto.componente_etico) },
    { t: '\n\nNota. Todos los proyectos de investigación que interactúen con personas, deben incluir el formato de consentimiento informado y si son menores de edad el formato de asentimiento' },
  ]
  const bloques: Bloque[] = [
    tabla(
      [
        [celda(535, componenteEtico, { minH: 130 })],
        caja(535, titulado('4.12  FUNCIONES DEL ESTUDIANTE AUXILIAR O ASISTENTE EN LA INVESTIGACIÓN', '(Máximo 500 palabras)'), v(proyecto.funciones_estudiante_auxiliar), 170),
      ],
      16
    ),
  ]

  const hoy = new Date()
  bloques.push({
    tipo: 'parrafo',
    parrafo: {
      texto: [
        { t: 'Se firma a los ' },
        { t: String(hoy.getDate()) },
        { t: ' días del mes de ' },
        { t: MESES_LARGOS[hoy.getMonth()] },
        { t: ' de ' },
        { t: String(hoy.getFullYear()) },
        { t: ', en acuerdo de lo expuesto anteriormente:' },
      ],
      antes: 6,
      despues: 18,
    },
  })

  const firmantes: { nombre: string; rol: string }[] = []
  const agregar = (p: Participante | null, rol: string) => {
    if (p) firmantes.push({ nombre: nombreCompleto(p), rol })
  }
  agregar(principal, 'Investigador(a) Principal')
  coinvestigadores.forEach((p) => agregar(p, 'Co Investigador(a) UNICESMAG'))
  externos.forEach((p) => agregar(p, 'Co Investigador(a) Externo(a)'))
  egresados.forEach((p) => agregar(p, 'Co Investigador(a) Egresado(a)'))
  if (firmantes.length === 0) firmantes.push({ nombre: 'Nombre Completo', rol: 'Investigador(a) Principal' })

  const filasFirmas: CeldaSpec[][] = []
  const bloqueFirma = (f: { nombre: string; rol: string } | undefined): { linea: CeldaSpec; datos: CeldaSpec } =>
    f
      ? {
          linea: celda(260, 'Firma', { size: 9, bordes: { b: true }, valign: 'bottom', minH: 40 }),
          datos: celda(260, [{ t: f.nombre, b: true }, { t: `\n${f.rol}` }], { bordes: false, minH: 44 }),
        }
      : { linea: celda(260, '', { bordes: false }), datos: celda(260, '', { bordes: false }) }

  for (let i = 0; i < firmantes.length; i += 2) {
    const a = bloqueFirma(firmantes[i])
    const b = bloqueFirma(firmantes[i + 1])
    a.linea.texto = [{ t: 'Firma', color: '999999' }]
    if (firmantes[i + 1]) b.linea.texto = [{ t: 'Firma', color: '999999' }]
    filasFirmas.push([a.linea, celda(20, '', { bordes: false }), b.linea])
    filasFirmas.push([a.datos, celda(20, '', { bordes: false }), b.datos])
  }
  bloques.push(tabla(filasFirmas, 0))
  return bloques
}

// ---------- Anexo 1: hojas de vida ----------

function fichaHojaVida(p: Participante, datos: DatosVistaProyecto): Bloque {
  const hv = p.participante != null ? datos.hojasVida.get(p.participante) : null
  const rol = p.rolProyecto.nombre
  const titulo =
    rol === ROL_PRINCIPAL ? 'INFORMACIÓN INVESTIGADOR(A) PRINCIPAL' : rol === ROL_ESTUDIANTE ? 'INFORMACIÓN ESTUDIANTE INVESTIGADOR(A)' : 'INFORMACIÓN CO- INVESTIGADOR(A)'
  const lugarFecha = [v(hv?.lugar_nacimiento), fechaLegible(hv?.fecha_nacimiento)].filter(Boolean).join(' — ')
  const seccion = (t: string, extra?: string, minH = 85): CeldaSpec[][] => [
    [encabezadoCentrado(522, extra ? [{ t, b: true }, { t: ` ${extra}` }] : t, { size: 10 })],
    [celda(522, '', { minH })],
  ]
  const rellenar = (filas: CeldaSpec[][], texto: string) => {
    filas[1][0].texto = texto
    return filas
  }

  return tabla(
    [
      [encabezadoCentrado(522, [{ t: 'HOJA DE VIDA', b: true }, { t: '\n(Resumen)' }])],
      [encabezadoCentrado(522, titulo, { fondo: AZUL })],
      [etiqueta(113, 'Nombres', { negrita: true }), celda(409, p.usuario ? p.usuario.nombre : v(p.nombre_manual))],
      [etiqueta(113, 'Apellidos', { negrita: true }), celda(409, p.usuario ? p.usuario.apellido : v(p.apellido_manual))],
      [
        encabezadoCentrado(205, 'Lugar y fecha de Nacimiento', { minH: 34 }),
        encabezadoCentrado(99, 'Nacionalidad'),
        encabezadoCentrado(108, 'Tipo documento de identidad'),
        encabezadoCentrado(110, 'No. Documento de identidad'),
      ],
      [celda(205, lugarFecha, { minH: 16 }), celda(99, v(hv?.nacionalidad)), celda(108, v(hv?.tipo_documento)), celda(110, v(hv?.numero_documento))],
      [encabezadoCentrado(246, 'Dirección de residencia'), encabezadoCentrado(276, 'Correo electrónico')],
      [celda(246, v(hv?.direccion), { minH: 16 }), celda(276, correoParticipante(p))],
      [etiqueta(113, 'Teléfono', { negrita: true }), celda(133, v(hv?.telefono)), etiqueta(74, 'Celular', { negrita: true }), celda(202, v(hv?.celular))],
      ...rellenar(seccion('Cargo actual', undefined, 45), v(hv?.cargo_actual)),
      ...rellenar(seccion('Cargos desempeñados'), v(hv?.cargos_desempenados)),
      ...rellenar(seccion('Títulos académicos obtenidos', '(área, disciplina, universidad, año)'), v(hv?.titulos_academicos)),
      ...rellenar(seccion('Producción científica y académica', '(las 5 más importantes en los últimos 5 años)', 120), v(hv?.produccion_cientifica)),
    ],
    0
  )
}

function bloquesAnexo(datos: DatosVistaProyecto): Bloque[] {
  // Estudiantes y egresados no diligencian hoja de vida en el proyecto: solo
  // se los menciona como participantes (ver tabla de participantes y
  // bloquesEgresados, que ya cubren esa información aparte).
  const { principal, coinvestigadores, externos } = participantesPorRol(datos)
  const orden = [principal, ...coinvestigadores, ...externos].filter((p): p is Participante => p !== null)

  const bloques: Bloque[] = [
    { tipo: 'saltoPagina' },
    { tipo: 'parrafo', parrafo: { texto: 'Anexo 1', align: 'center', negrita: true, size: 11, despues: 0 } },
    { tipo: 'parrafo', parrafo: { texto: 'Hojas de vida investigadores', align: 'center', negrita: true, size: 11, despues: 0 } },
    { tipo: 'parrafo', parrafo: { texto: '(Se diligencia una ficha por cada investigador)', align: 'center', size: 11, despues: 10 } },
  ]
  if (orden.length === 0) {
    bloques.push(fichaHojaVida({ id_usuarioproyecto: 0, participante: 0, orcid: null, google_academico: null, codigo_estudiantil: null, nombre_manual: null, apellido_manual: null, correo_manual: null, usuario: { id_usuario: 0, nombre: '', apellido: '', correo: '' }, dedicacion: { nombre: '' }, rolProyecto: { nombre: ROL_PRINCIPAL }, rolEstudiante: null }, datos))
    return bloques
  }
  orden.forEach((p, i) => {
    if (i > 0) bloques.push({ tipo: 'saltoPagina' })
    bloques.push(fichaHojaVida(p, datos))
  })
  return bloques
}

// ---------- documento completo ----------

export function construirDocumento(datos: DatosVistaProyecto): DocumentoFormato {
  const vertical1: SeccionDoc = {
    orientacion: 'vertical',
    bloques: [
      tabla(filasInformacionGeneral(datos), 16),
      ...bloquesGrupos(datos),
      ...bloquesEgresados(datos),
      tablaResumen(datos),
      tablaDescripcion(datos),
      ...bloquesCronograma(datos),
    ],
  }
  const horizontal: SeccionDoc = { orientacion: 'horizontal', bloques: bloquesResultados(datos) }
  const vertical2: SeccionDoc = { orientacion: 'vertical', bloques: [...bloquesCierre(datos), ...bloquesAnexo(datos)] }
  return { secciones: [vertical1, horizontal, vertical2] }
}
