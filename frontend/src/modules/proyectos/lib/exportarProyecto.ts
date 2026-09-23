import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ImageRun,
} from 'docx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DatosVistaProyecto } from '../components/VistaDetalleProyecto'
import { MESES } from '../components/VistaDetalleProyecto'
import logoUrl from '../../../assets/cesmag-logo.png'

// El logo original es de 576x198 px.
const LOGO_ANCHO = 576
const LOGO_ALTO = 198

let logoBufferCache: ArrayBuffer | null = null
async function obtenerLogoBuffer(): Promise<ArrayBuffer> {
  if (logoBufferCache) return logoBufferCache
  const respuesta = await fetch(logoUrl)
  logoBufferCache = await respuesta.arrayBuffer()
  return logoBufferCache
}

function bufferABase64(buffer: ArrayBuffer): string {
  let binario = ''
  const bytes = new Uint8Array(buffer)
  const tamanoChunk = 0x8000
  for (let i = 0; i < bytes.length; i += tamanoChunk) {
    binario += String.fromCharCode(...bytes.subarray(i, i + tamanoChunk))
  }
  return btoa(binario)
}

const VACIO = '—'
const CODIGO_FORMATO = 'INV-IC-FR-001'
const VERSION_FORMATO = '7'
const FECHA_FORMATO = '29/MAY/2026'

function v(texto: string | number | null | undefined): string {
  if (texto === null || texto === undefined) return VACIO
  const s = String(texto).trim()
  return s ? s : VACIO
}

function formatearMoneda(valor: string | null | undefined): string {
  const n = Number(valor)
  if (!valor || Number.isNaN(n)) return VACIO
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

const ROL_PRINCIPAL = 'Investigador(a) Principal UNICESMAG'
const ROL_COINV_UNICESMAG = 'Co investigador(a) UNICESMAG'
const ROL_EXTERNO = 'Co investigador(a) Externo(a)'
const ROL_EGRESADO = 'Co investigador(a) Egresado(a) UNICESMAG'
const ROL_ESTUDIANTE = 'Estudiante Investigador(a)'

const MODALIDADES_OFICIALES = [
  'Investigación Científica',
  'Desarrollo Tecnológico',
  'Innovación',
  'Creación Artística y Cultural',
  'Investigación-Creación',
  'Desarrollo Experimental',
]

const AREAS_OFICIALES = [
  'Ciencias naturales',
  'Ciencias agrícolas',
  'Ciencias Sociales',
  'Ciencias médicas y de la salud',
  'Ingeniería y Tecnología',
  'Humanidades',
]

function coincide(nombreReal: string | null | undefined, opcion: string): boolean {
  if (!nombreReal) return false
  return nombreReal.trim().toLowerCase() === opcion.trim().toLowerCase()
}

/** Filas de participantes por tipo, en el orden del formato oficial (RQ INV-IC-FR-001). */
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

interface FilaCronograma {
  periodoNombre: string
  año: string
  actividad: string
  resultado: string
  responsable: string
  mesesMarcados: Set<number>
}

/** Agrupa las actividades por periodo (Periodo I, Periodo II, ...), una fila por actividad dentro de cada periodo. */
function agruparCronogramaPorPeriodo(datos: DatosVistaProyecto): FilaCronograma[] {
  const filas: FilaCronograma[] = []
  for (const a of datos.actividades) {
    const porPeriodo = new Map<string, { año: string; meses: Set<number> }>()
    for (const pm of a.periodos) {
      const clave = pm.periodo.nombre
      const existente = porPeriodo.get(clave) ?? { año: String(pm.año), meses: new Set<number>() }
      existente.meses.add(pm.mes)
      porPeriodo.set(clave, existente)
    }
    if (porPeriodo.size === 0) {
      filas.push({
        periodoNombre: VACIO,
        año: VACIO,
        actividad: a.actividad,
        resultado: v(a.resultado),
        responsable: a.responsables.map((r) => `${r.usuario.nombre} ${r.usuario.apellido}`).join(', ') || VACIO,
        mesesMarcados: new Set(),
      })
      continue
    }
    for (const [periodoNombre, { año, meses }] of porPeriodo) {
      filas.push({
        periodoNombre,
        año,
        actividad: a.actividad,
        resultado: v(a.resultado),
        responsable: a.responsables.map((r) => `${r.usuario.nombre} ${r.usuario.apellido}`).join(', ') || VACIO,
        mesesMarcados: meses,
      })
    }
  }
  return filas
}

function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

// ==================== WORD (.docx) ====================

const bordeCelda = {
  top: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
  left: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
  right: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
}

function celda(texto: string, opciones: { negrita?: boolean; encabezado?: boolean; ancho?: number } = {}): TableCell {
  return new TableCell({
    width: opciones.ancho ? { size: opciones.ancho, type: WidthType.PERCENTAGE } : undefined,
    shading: opciones.encabezado ? { fill: 'D9D9D9' } : undefined,
    borders: bordeCelda,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text: texto, bold: opciones.negrita ?? opciones.encabezado })] })],
  })
}

function filaEncabezado(columnas: string[]): TableRow {
  return new TableRow({ children: columnas.map((c) => celda(c, { encabezado: true, ancho: 100 / columnas.length })) })
}

function tituloSeccion(texto: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    shading: { fill: 'D9D9D9' },
    children: [new TextRun({ text: texto, bold: true })],
  })
}

function subtitulo(texto: string): Paragraph {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: texto, bold: true })] })
}

function parrafo(etiqueta: string, texto: string): Paragraph[] {
  return [
    new Paragraph({ children: [new TextRun({ text: etiqueta, bold: true })] }),
    new Paragraph({ text: texto }),
  ]
}

type Participante = DatosVistaProyecto['participantes'][number]

/**
 * Replica el bloque de participantes del formato oficial: por cada persona,
 * una fila [Rol][Nombre][Campo 3][Valor 3] y, cuando aplica (todos menos
 * egresados/estudiantes), una segunda fila [ORCID][valor][Google Académico][valor].
 */
function tablaParticipantes(datos: DatosVistaProyecto): Table {
  const { principal, coinvestigadores, externos, egresados, estudiantes } = participantesPorRol(datos)
  const filas: TableRow[] = []

  const filaPrincipal = (etiqueta: string, p: Participante | null, campo3: string, valor3: string) =>
    new TableRow({
      children: [
        celda(etiqueta, { negrita: true, ancho: 28 }),
        celda(p ? `${p.usuario.nombre} ${p.usuario.apellido}` : VACIO, { ancho: 32 }),
        celda(campo3, { negrita: true, ancho: 20 }),
        celda(valor3, { ancho: 20 }),
      ],
    })

  const filaOrcid = (p: Participante | null) =>
    new TableRow({
      children: [
        celda('ORCID', { negrita: true, ancho: 28 }),
        celda(p?.orcid ?? VACIO, { ancho: 32 }),
        celda('Google Académico', { negrita: true, ancho: 20 }),
        celda(p?.google_academico ?? VACIO, { ancho: 20 }),
      ],
    })

  const agregarConOrcid = (etiqueta: string, p: Participante | null) => {
    filas.push(filaPrincipal(etiqueta, p, 'Dedicación', p?.dedicacion.nombre ?? VACIO))
    filas.push(filaOrcid(p))
  }

  agregarConOrcid('Investigador(a) Principal UNICESMAG:', principal)

  if (coinvestigadores.length === 0) agregarConOrcid('Co investigador(a) UNICESMAG:', null)
  for (const p of coinvestigadores) agregarConOrcid('Co investigador(a) UNICESMAG:', p)

  if (externos.length === 0) agregarConOrcid('Co investigador(a) Externo(a):', null)
  for (const p of externos) agregarConOrcid('Co investigador(a) Externo(a):', p)

  const egresadosConCedula = egresados.length > 0 ? egresados : [null]
  for (const p of egresadosConCedula) {
    const eg = p ? datos.egresados.get(p.id_usuarioproyecto) : null
    filas.push(filaPrincipal('Co investigador(a) Egresado(a) UNICESMAG:', p, 'Cédula', v(eg?.cedula)))
  }

  const estudiantesConCodigo = estudiantes.length > 0 ? estudiantes : [null]
  for (const p of estudiantesConCodigo) {
    filas.push(
      filaPrincipal(
        'Estudiante Investigador(a):',
        p,
        'Código / Rol',
        p ? `${p.codigo_estudiantil ?? VACIO} — ${p.rolEstudiante?.nombre ?? VACIO}` : VACIO
      )
    )
  }

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas })
}

function tablaSeleccionUnica(titulo: string, opciones: string[], seleccionado: string | null | undefined): (Paragraph | Table)[] {
  const filas: TableRow[] = []
  for (let i = 0; i < opciones.length; i += 2) {
    const izq = opciones[i]
    const der = opciones[i + 1]
    filas.push(
      new TableRow({
        children: [
          celda(izq),
          celda(coincide(seleccionado, izq) ? 'X' : ''),
          ...(der ? [celda(der), celda(coincide(seleccionado, der) ? 'X' : '')] : []),
        ],
      })
    )
  }
  const elementos: (Paragraph | Table)[] = [subtitulo(titulo)]
  if (seleccionado && !opciones.some((o) => coincide(seleccionado, o))) {
    elementos.push(new Paragraph({ children: [new TextRun({ text: `Valor registrado: ${seleccionado}`, italics: true })] }))
  }
  elementos.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas }))
  return elementos
}

function bloqueGrupo(g: DatosVistaProyecto['grupos'][number], datos: DatosVistaProyecto): (Paragraph | Table)[] {
  const { facultades, participantes } = datos
  const esExterno = !g.grupo.id_facultad && !!g.grupo.facultad_otra
  const filas = [
    new TableRow({
      children: [
        celda(esExterno ? 'Universidad / Entidad' : 'Facultad/Departamento', { negrita: true, ancho: 30 }),
        celda(v(g.grupo.facultad_otra ?? (g.grupo.id_facultad ? facultades.get(g.grupo.id_facultad) : null)), { ancho: 70 }),
      ],
    }),
    new TableRow({
      children: [
        celda(esExterno ? 'Programa Académico/Dependencia' : 'Programa Académico', { negrita: true }),
        celda(v(g.grupo.programa_otro)),
      ],
    }),
    new TableRow({ children: [celda('Nombre del Grupo', { negrita: true }), celda(v(g.grupo.nombre))] }),
    new TableRow({
      children: [celda(esExterno ? 'Director del Grupo' : 'Líder del grupo', { negrita: true }), celda(v(g.grupo.lider_grupo))],
    }),
    new TableRow({
      children: [
        celda('Código GrupLAC', { negrita: true }),
        celda(v(g.grupo.cod_gruplac)),
        celda('Reconocido MINCIENCIAS', { negrita: true }),
        celda(g.grupo.reconocido_minciencias ? 'SI' : 'NO'),
      ],
    }),
    new TableRow({
      children: [celda('Categoría', { negrita: true }), celda(v(g.grupo.categoria)), celda('Acuerdo Institucional', { negrita: true }), celda(v(g.grupo.acuerdo_institucional))],
    }),
    new TableRow({
      children: [
        celda(esExterno ? 'Línea medular Institucional (Obligatorio)' : 'Línea activa de investigación (Obligatorio)', { negrita: true }),
        celda(v(g.lineaInvestigacion?.nombre ?? g.grupo.linea_medular)),
      ],
    }),
    new TableRow({ children: [celda('Objetivo de Desarrollo Sostenible ODS (Obligatorio)', { negrita: true }), celda(v(g.ods?.nombre))] }),
  ]

  const filasInvestigadores = [filaEncabezado([`Investigadores ${esExterno ? 'externos' : 'UNICESMAG'} del proyecto`, 'Dedicación'])]
  for (const p of participantes) {
    filasInvestigadores.push(new TableRow({ children: [celda(`${p.usuario.nombre} ${p.usuario.apellido}`), celda(p.dedicacion.nombre)] }))
  }
  if (participantes.length === 0) filasInvestigadores.push(new TableRow({ children: [celda(VACIO), celda(VACIO)] }))

  return [
    subtitulo(`Grupo: ${g.grupo.nombre}`),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filasInvestigadores }),
  ]
}

function tablaEgresados(datos: DatosVistaProyecto): (Paragraph | Table)[] {
  const egresadosParticipantes = datos.participantes.filter((p) => p.rolProyecto.nombre === ROL_EGRESADO)
  const filas = [filaEncabezado(['Co Investigador(a) Egresado(a)', 'Facultad', 'Programa Académico', 'Empresa o Entidad', 'Dedicación (h/sem)'])]
  for (const p of egresadosParticipantes) {
    const eg = datos.egresados.get(p.id_usuarioproyecto)
    filas.push(
      new TableRow({
        children: [
          celda(`${p.usuario.nombre} ${p.usuario.apellido}`),
          celda(v(eg?.facultad)),
          celda(v(eg?.programa_academico)),
          celda(v(eg?.empresa_entidad)),
          celda(v(eg?.dedicacion_horas_semanales)),
        ],
      })
    )
  }
  if (egresadosParticipantes.length === 0) filas.push(new TableRow({ children: [celda(VACIO), celda(VACIO), celda(VACIO), celda(VACIO), celda(VACIO)] }))
  return [subtitulo('Información general de egresados(as)'), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas })]
}

function tablaImpactos(datos: DatosVistaProyecto): (Paragraph | Table)[] {
  const impactos = datos.objetivos.flatMap((o) => o.impactos.map((im) => ({ ...im, objetivo: o.descripcion })))
  const filas = [filaEncabezado(['Impacto esperado', 'Beneficiario potencial', 'Indicador verificable'])]
  for (const im of impactos) {
    filas.push(new TableRow({ children: [celda(v(im.impacto_esperado)), celda(v(im.beneficiario_potencial)), celda(v(im.indicador_verificable))] }))
  }
  if (impactos.length === 0) filas.push(new TableRow({ children: [celda(VACIO), celda(VACIO), celda(VACIO)] }))
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas })]
}

function tablaCronograma(datos: DatosVistaProyecto): (Paragraph | Table)[] {
  const filas = agruparCronogramaPorPeriodo(datos)
  if (filas.length === 0) {
    return [new Paragraph({ text: 'No hay actividades de cronograma registradas.' })]
  }
  const porPeriodo = new Map<string, FilaCronograma[]>()
  for (const f of filas) {
    const lista = porPeriodo.get(f.periodoNombre) ?? []
    lista.push(f)
    porPeriodo.set(f.periodoNombre, lista)
  }
  const elementos: (Paragraph | Table)[] = []
  for (const [periodoNombre, filasPeriodo] of porPeriodo) {
    elementos.push(subtitulo(`${periodoNombre} — Año ${filasPeriodo[0].año}`))
    const encabezado = new TableRow({
      children: ['Actividad', 'Resultado', 'Responsable', ...MESES].map((c) => celda(c, { encabezado: true })),
    })
    const filasTabla = filasPeriodo.map(
      (f) =>
        new TableRow({
          children: [
            celda(f.actividad),
            celda(f.resultado),
            celda(f.responsable),
            ...MESES.map((_, i) => celda(f.mesesMarcados.has(i + 1) ? 'X' : '')),
          ],
        })
    )
    elementos.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [encabezado, ...filasTabla] }))
  }
  return elementos
}

/** Una tabla por categoría (como en el formato oficial, que agrupa "Generación de nuevo conocimiento", "Desarrollo tecnológico e innovación", etc. por separado). */
function tablaResultados(datos: DatosVistaProyecto): (Paragraph | Table)[] {
  const elementos: (Paragraph | Table)[] = []
  const cantidadPorTipo = new Map(datos.productos.map((p) => [p.tipoProducto.nombre + '|' + p.tipoProducto.subcategoria.nombre, p.cantidad]))
  for (const cat of datos.categoriasProducto) {
    elementos.push(subtitulo(cat.nombre))
    const filas = [filaEncabezado(['Subcategoría', 'Tipo de producto', 'Número de productos'])]
    for (const sub of cat.subcategorias) {
      for (const tipo of sub.tipos) {
        const cantidad = cantidadPorTipo.get(tipo.nombre + '|' + sub.nombre) ?? 0
        filas.push(new TableRow({ children: [celda(sub.nombre), celda(tipo.nombre), celda(String(cantidad))] }))
      }
    }
    elementos.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas }))
  }
  return elementos
}

function filaAncha(etiqueta: string, valor: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        shading: { fill: 'D9D9D9' },
        borders: bordeCelda,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: etiqueta, bold: true })] })],
      }),
      celda(valor),
    ],
  })
}

function tablaHojaVida(nombreSeccion: string, p: DatosVistaProyecto['participantes'][number], datos: DatosVistaProyecto): (Paragraph | Table)[] {
  const hv = datos.hojasVida.get(p.participante)
  const eg = p.rolProyecto.nombre === ROL_EGRESADO ? datos.egresados.get(p.id_usuarioproyecto) : null
  const filas = [
    new TableRow({ children: [celda('Nombres', { negrita: true }), celda(p.usuario.nombre)] }),
    new TableRow({ children: [celda('Apellidos', { negrita: true }), celda(p.usuario.apellido)] }),
    new TableRow({
      children: [celda('Lugar y fecha de Nacimiento', { negrita: true }), celda(`${v(hv?.lugar_nacimiento)} — ${v(hv?.fecha_nacimiento)}`)],
    }),
    new TableRow({ children: [celda('Nacionalidad', { negrita: true }), celda(v(hv?.nacionalidad))] }),
    new TableRow({
      children: [celda('Tipo y No. Documento de identidad', { negrita: true }), celda(`${v(hv?.tipo_documento)} ${v(hv?.numero_documento)}`)],
    }),
    new TableRow({ children: [celda('Dirección de residencia', { negrita: true }), celda(v(hv?.direccion))] }),
    new TableRow({ children: [celda('Correo electrónico', { negrita: true }), celda(p.usuario.correo)] }),
    new TableRow({ children: [celda('Teléfono', { negrita: true }), celda(v(hv?.telefono))] }),
    new TableRow({ children: [celda('Celular', { negrita: true }), celda(v(hv?.celular))] }),
    filaAncha('Cargo actual', v(hv?.cargo_actual)),
    filaAncha('Cargos desempeñados', v(hv?.cargos_desempenados)),
    filaAncha('Títulos académicos obtenidos (área, disciplina, universidad, año)', v(hv?.titulos_academicos)),
    filaAncha('Producción científica y académica (las 5 más importantes en los últimos 5 años)', v(hv?.produccion_cientifica)),
  ]
  if (eg) {
    filas.push(
      new TableRow({ children: [celda('Facultad (egresado)', { negrita: true }), celda(v(eg.facultad))] }),
      new TableRow({ children: [celda('Programa académico (egresado)', { negrita: true }), celda(v(eg.programa_academico))] }),
      new TableRow({ children: [celda('Empresa o entidad', { negrita: true }), celda(v(eg.empresa_entidad))] })
    )
  }
  return [subtitulo(`${nombreSeccion}: ${p.usuario.nombre} ${p.usuario.apellido}`), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas })]
}

export async function generarWordProyecto(datos: DatosVistaProyecto): Promise<void> {
  const { proyecto } = datos
  const objetivoGeneral = datos.objetivos.find((o) => o.tipo_objetivo === 'general')
  const objetivosEspecificos = datos.objetivos.filter((o) => o.tipo_objetivo !== 'general')
  const { principal, coinvestigadores, externos, egresados, estudiantes } = participantesPorRol(datos)

  const logoBuffer = await obtenerLogoBuffer()
  const logoAlturaEmu = 55 // pt, ancho se escala manteniendo la proporción 576:198
  const logoAnchoEmu = Math.round((logoAlturaEmu * LOGO_ANCHO) / LOGO_ALTO)

  const encabezado = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: bordeCelda,
            verticalAlign: 'center',
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    data: logoBuffer,
                    type: 'png',
                    transformation: { width: logoAnchoEmu, height: logoAlturaEmu },
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: bordeCelda,
            verticalAlign: 'center',
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'PRESENTACIÓN DE PROYECTOS DE INVESTIGACIÓN', bold: true, size: 26 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            borders: bordeCelda,
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({ children: [celda('CÓDIGO:', { negrita: true, ancho: 40 }), celda(CODIGO_FORMATO, { ancho: 60 })] }),
                  new TableRow({ children: [celda('VERSIÓN:', { negrita: true }), celda(VERSION_FORMATO)] }),
                  new TableRow({ children: [celda('FECHA:', { negrita: true }), celda(FECHA_FORMATO)] }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })

  const hijos: (Paragraph | Table)[] = [
    encabezado,
    new Paragraph({ text: '' }),

    tituloSeccion('1. INFORMACIÓN GENERAL DEL PROYECTO'),
    ...parrafo('Título:', v(proyecto.titulo)),
    tablaParticipantes(datos),
    ...tablaSeleccionUnica('Modalidad del proyecto', MODALIDADES_OFICIALES, proyecto.modalidad?.nombre),
    ...tablaSeleccionUnica('Área de conocimiento a la que aplica', AREAS_OFICIALES, datos.areas[0]?.area.nombre),
    ...parrafo('Programa(s) de pregrado o posgrado al que se articula:', datos.programas.map((p) => p.programa?.nombre ?? p.programa_otro ?? VACIO).join(', ') || VACIO),
    subtitulo('Lugar de Ejecución del Proyecto'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            celda('Ciudad', { negrita: true }),
            celda(v(proyecto.ciudad)),
            celda('Departamento', { negrita: true }),
            celda(v(proyecto.departamento)),
            celda('Duración (periodos)', { negrita: true }),
            celda(v(proyecto.duracion_periodos)),
          ],
        }),
      ],
    }),
    ...tablaSeleccionUnica('Tipo de Proyecto', ['Investigación Básica', 'Investigación Aplicada'], proyecto.tipoProyecto?.nombre),
    subtitulo('Financiación Total Solicitada'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [celda('Valor solicitado UNICESMAG', { negrita: true }), celda(formatearMoneda(datos.financiacion?.valor_solicitado_unicesmag))] }),
        new TableRow({ children: [celda('Valor contrapartida', { negrita: true }), celda(formatearMoneda(datos.financiacion?.valor_contrapartida))] }),
        new TableRow({ children: [celda('Valor total', { negrita: true }), celda(formatearMoneda(datos.financiacion?.valor_total))] }),
      ],
    }),

    tituloSeccion('2. INFORMACIÓN GENERAL DEL GRUPO DE INVESTIGACIÓN'),
    ...(datos.grupos.length > 0 ? datos.grupos.flatMap((g) => bloqueGrupo(g, datos)) : [new Paragraph({ text: 'No hay grupos de investigación registrados.' })]),
    ...tablaEgresados(datos),

    tituloSeccion('3. RESUMEN'),
    new Paragraph({ text: v(proyecto.resumen) }),

    tituloSeccion('4. DESCRIPCIÓN DEL PROYECTO'),
    subtitulo('4.1 Planteamiento del problema'),
    new Paragraph({ text: v(proyecto.planteamiento_problema) }),
    subtitulo('4.1.1 Pregunta de investigación'),
    new Paragraph({ text: v(proyecto.pregunta_investigacion) }),
    subtitulo('4.2 Justificación'),
    new Paragraph({ text: v(proyecto.justificacion) }),
    subtitulo('4.3 Objetivo general'),
    new Paragraph({ text: v(objetivoGeneral?.descripcion) }),
    subtitulo('4.3 Objetivos específicos'),
    ...(objetivosEspecificos.length > 0
      ? objetivosEspecificos.map((o) => new Paragraph({ text: `• ${o.descripcion}` }))
      : [new Paragraph({ text: VACIO })]),
    subtitulo('4.4 Antecedentes'),
    ...(datos.antecedentes.length > 0
      ? datos.antecedentes.map(
        (a) =>
          new Paragraph({
            text: `• ${a.descripcion}${a.autor ? ` — ${a.autor}` : ''}${a.fuente ? ` (${a.fuente})` : ''}${a.fecha_publicacion ? `, ${a.fecha_publicacion}` : ''}`,
          })
      )
      : [new Paragraph({ text: VACIO })]),
    subtitulo('4.5 Marco teórico preliminar'),
    new Paragraph({ text: v(proyecto.marco_teorico) }),
    subtitulo('4.6 Metodología preliminar propuesta'),
    new Paragraph({ text: v(proyecto.metodologia_preliminar) }),
    subtitulo('4.7 Impacto (por cada objetivo específico)'),
    ...tablaImpactos(datos),
    subtitulo('4.8 Referencias'),
    ...(datos.referencias.length > 0 ? datos.referencias.map((r) => new Paragraph({ text: `• ${r.referencia}` })) : [new Paragraph({ text: VACIO })]),
    subtitulo('4.9 Cronograma de actividades'),
    ...tablaCronograma(datos),
    subtitulo('4.10 Resultados esperados'),
    ...tablaResultados(datos),
    subtitulo('4.11 Componente ético'),
    new Paragraph({ text: v(proyecto.componente_etico) }),
    subtitulo('4.12 Funciones del estudiante auxiliar o asistente en la investigación'),
    new Paragraph({ text: v(proyecto.funciones_estudiante_auxiliar) }),

    tituloSeccion('FIRMAS'),
    ...[principal, ...coinvestigadores, ...externos, ...egresados, ...estudiantes]
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => new Paragraph({ text: `${p.usuario.nombre} ${p.usuario.apellido} — ${p.rolProyecto.nombre}` })),

    tituloSeccion('ANEXO 1 — HOJAS DE VIDA DE INVESTIGADORES'),
    ...datos.participantes.flatMap((p) => tablaHojaVida(p.rolProyecto.nombre, p, datos)),
  ]

  const doc = new Document({ sections: [{ children: hijos }] })
  const blob = await Packer.toBlob(doc)
  descargarBlob(blob, `${proyecto.titulo || 'proyecto'}.docx`)
}

// ==================== PDF ====================

export async function generarPdfProyecto(datos: DatosVistaProyecto): Promise<void> {
  const { proyecto } = datos
  const objetivoGeneral = datos.objetivos.find((o) => o.tipo_objetivo === 'general')
  const objetivosEspecificos = datos.objetivos.filter((o) => o.tipo_objetivo !== 'general')
  const { principal, coinvestigadores, externos, egresados, estudiantes } = participantesPorRol(datos)

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margenIzq = 40
  const anchoUtil = 515
  let y = 50

  const saltoSiNecesario = (altura: number) => {
    if (y + altura > 800) {
      doc.addPage()
      y = 50
    }
  }

  const texto = (t: string, opciones: { tamaño?: number; negrita?: boolean; espacio?: number; centrado?: boolean } = {}) => {
    const { tamaño = 10, negrita = false, espacio = 4, centrado = false } = opciones
    doc.setFontSize(tamaño)
    doc.setFont('helvetica', negrita ? 'bold' : 'normal')
    const lineas: string[] = doc.splitTextToSize(t, anchoUtil)
    for (const linea of lineas) {
      saltoSiNecesario(tamaño * 1.4)
      doc.text(linea, centrado ? margenIzq + anchoUtil / 2 : margenIzq, y, centrado ? { align: 'center' } : undefined)
      y += tamaño * 1.4
    }
    y += espacio
  }

  const tituloSeccionPdf = (t: string) => {
    saltoSiNecesario(26)
    doc.setFillColor(217, 217, 217)
    doc.rect(margenIzq, y - 12, anchoUtil, 20, 'F')
    texto(t, { tamaño: 12, negrita: true, espacio: 8 })
  }

  const tabla = (encabezados: string[], filas: string[][]) => {
    autoTable(doc, {
      startY: y,
      margin: { left: margenIzq, right: 595 - margenIzq - anchoUtil },
      head: [encabezados],
      body: filas.length > 0 ? filas : [encabezados.map(() => VACIO)],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [217, 217, 217], textColor: [30, 30, 30] },
      didDrawPage: () => {
        y = 50
      },
    })
    // @ts-expect-error -- jspdf-autotable adjunta lastAutoTable en runtime
    y = (doc.lastAutoTable?.finalY ?? y) + 12
  }

  // Encabezado: escudo a la izquierda, título en el centro, caja CÓDIGO/VERSIÓN/FECHA a la derecha (como el formato oficial).
  const logoBase64 = bufferABase64(await obtenerLogoBuffer())
  const anchoLogoCelda = anchoUtil * 0.2
  const altoLogo = 34
  const anchoLogo = (altoLogo * LOGO_ANCHO) / LOGO_ALTO

  autoTable(doc, {
    startY: y,
    margin: { left: margenIzq, right: 595 - margenIzq - anchoUtil },
    body: [['', 'PRESENTACIÓN DE PROYECTOS DE INVESTIGACIÓN', `CÓDIGO: ${CODIGO_FORMATO}\nVERSIÓN: ${VERSION_FORMATO}\nFECHA: ${FECHA_FORMATO}`]],
    styles: { fontSize: 11, cellPadding: 6, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: anchoLogoCelda },
      1: { cellWidth: anchoUtil * 0.45, fontStyle: 'bold', halign: 'center' },
      2: { cellWidth: anchoUtil * 0.35, fontSize: 8 },
    },
    didDrawCell: (datosCelda) => {
      if (datosCelda.section === 'body' && datosCelda.column.index === 0) {
        const { x, y: yCelda, width, height } = datosCelda.cell
        doc.addImage(
          `data:image/png;base64,${logoBase64}`,
          'PNG',
          x + (width - anchoLogo) / 2,
          yCelda + (height - altoLogo) / 2,
          anchoLogo,
          altoLogo
        )
      }
    },
  })
  // @ts-expect-error -- jspdf-autotable adjunta lastAutoTable en runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 14

  tituloSeccionPdf('1. INFORMACIÓN GENERAL DEL PROYECTO')
  texto(`Título: ${v(proyecto.titulo)}`, { negrita: true, espacio: 6 })

  const filaDoble = (etiqueta: string, p: Participante | null, campo3: string, valor3: string) => [etiqueta, p ? `${p.usuario.nombre} ${p.usuario.apellido}` : VACIO, campo3, valor3]
  const filaOrcidPdf = (p: Participante | null) => ['ORCID', p?.orcid ?? VACIO, 'Google Académico', p?.google_academico ?? VACIO]

  const filasParticipantes: string[][] = []
  const agregarConOrcidPdf = (etiqueta: string, p: Participante | null) => {
    filasParticipantes.push(filaDoble(etiqueta, p, 'Dedicación', p?.dedicacion.nombre ?? VACIO))
    filasParticipantes.push(filaOrcidPdf(p))
  }
  agregarConOrcidPdf('Investigador(a) Principal UNICESMAG:', principal)
  if (coinvestigadores.length === 0) agregarConOrcidPdf('Co investigador(a) UNICESMAG:', null)
  for (const p of coinvestigadores) agregarConOrcidPdf('Co investigador(a) UNICESMAG:', p)
  if (externos.length === 0) agregarConOrcidPdf('Co investigador(a) Externo(a):', null)
  for (const p of externos) agregarConOrcidPdf('Co investigador(a) Externo(a):', p)
  const egresadosConCedulaPdf = egresados.length > 0 ? egresados : [null]
  for (const p of egresadosConCedulaPdf) {
    const eg = p ? datos.egresados.get(p.id_usuarioproyecto) : null
    filasParticipantes.push(filaDoble('Co investigador(a) Egresado(a) UNICESMAG:', p, 'Cédula', v(eg?.cedula)))
  }
  const estudiantesConCodigoPdf = estudiantes.length > 0 ? estudiantes : [null]
  for (const p of estudiantesConCodigoPdf) {
    filasParticipantes.push(
      filaDoble('Estudiante Investigador(a):', p, 'Código / Rol', p ? `${p.codigo_estudiantil ?? VACIO} — ${p.rolEstudiante?.nombre ?? VACIO}` : VACIO)
    )
  }
  tabla(['Rol', 'Nombre', 'Campo', 'Valor'], filasParticipantes)

  texto('Modalidad del proyecto', { negrita: true, espacio: 2 })
  texto(proyecto.modalidad?.nombre ? `Seleccionada: ${proyecto.modalidad.nombre}` : VACIO)
  texto('Área de conocimiento a la que aplica', { negrita: true, espacio: 2 })
  texto(datos.areas.length > 0 ? datos.areas.map((a) => a.area.nombre).join(', ') : VACIO)
  texto(`Programa(s) de pregrado o posgrado al que se articula: ${datos.programas.map((p) => p.programa?.nombre ?? p.programa_otro ?? VACIO).join(', ') || VACIO}`)
  texto(`Ciudad: ${v(proyecto.ciudad)}   Departamento: ${v(proyecto.departamento)}   Duración: ${v(proyecto.duracion_periodos)} periodo(s)`)
  texto(`Tipo de proyecto: ${v(proyecto.tipoProyecto?.nombre)}`, { negrita: true })

  texto('Financiación Total Solicitada', { negrita: true, espacio: 2 })
  texto(`Valor solicitado UNICESMAG: ${formatearMoneda(datos.financiacion?.valor_solicitado_unicesmag)}`)
  texto(`Valor contrapartida: ${formatearMoneda(datos.financiacion?.valor_contrapartida)}`)
  texto(`Valor total: ${formatearMoneda(datos.financiacion?.valor_total)}`, { espacio: 12 })

  tituloSeccionPdf('2. INFORMACIÓN GENERAL DEL GRUPO DE INVESTIGACIÓN')
  if (datos.grupos.length === 0) {
    texto('No hay grupos de investigación registrados.')
  } else {
    for (const g of datos.grupos) {
      const esExterno = !g.grupo.id_facultad && !!g.grupo.facultad_otra
      texto(`Grupo: ${g.grupo.nombre}`, { negrita: true, espacio: 4 })
      tabla(
        ['Campo', 'Valor'],
        [
          [esExterno ? 'Universidad/Entidad' : 'Facultad/Departamento', v(g.grupo.facultad_otra ?? (g.grupo.id_facultad ? datos.facultades.get(g.grupo.id_facultad) : null))],
          [esExterno ? 'Programa Académico/Dependencia' : 'Programa Académico', v(g.grupo.programa_otro)],
          [esExterno ? 'Director del Grupo' : 'Líder del grupo', v(g.grupo.lider_grupo)],
          ['Código GrupLAC', v(g.grupo.cod_gruplac)],
          ['Reconocido por MINCIENCIAS', g.grupo.reconocido_minciencias ? 'SI' : 'NO'],
          ['Categoría', v(g.grupo.categoria)],
          ['Acuerdo Institucional', v(g.grupo.acuerdo_institucional)],
          [esExterno ? 'Línea medular Institucional (Obligatorio)' : 'Línea activa de investigación (Obligatorio)', v(g.lineaInvestigacion?.nombre ?? g.grupo.linea_medular)],
          ['Objetivo de Desarrollo Sostenible ODS (Obligatorio)', v(g.ods?.nombre)],
        ]
      )
      tabla(
        [`Investigadores ${esExterno ? 'externos' : 'UNICESMAG'} del proyecto`, 'Dedicación'],
        datos.participantes.map((p) => [`${p.usuario.nombre} ${p.usuario.apellido}`, p.dedicacion.nombre])
      )
    }
  }

  const egresadosParticipantes = datos.participantes.filter((p) => p.rolProyecto.nombre === ROL_EGRESADO)
  texto('Información general de egresados(as)', { negrita: true, espacio: 2 })
  tabla(
    ['Co Investigador(a) Egresado(a)', 'Facultad', 'Programa Académico', 'Empresa/Entidad', 'Dedicación (h/sem)'],
    egresadosParticipantes.map((p) => {
      const eg = datos.egresados.get(p.id_usuarioproyecto)
      return [`${p.usuario.nombre} ${p.usuario.apellido}`, v(eg?.facultad), v(eg?.programa_academico), v(eg?.empresa_entidad), v(eg?.dedicacion_horas_semanales)]
    })
  )

  tituloSeccionPdf('3. RESUMEN')
  texto(v(proyecto.resumen), { espacio: 12 })

  tituloSeccionPdf('4. DESCRIPCIÓN DEL PROYECTO')
  texto('4.1 Planteamiento del problema', { negrita: true, espacio: 2 })
  texto(v(proyecto.planteamiento_problema))
  texto('4.1.1 Pregunta de investigación', { negrita: true, espacio: 2 })
  texto(v(proyecto.pregunta_investigacion))
  texto('4.2 Justificación', { negrita: true, espacio: 2 })
  texto(v(proyecto.justificacion))
  texto('4.3 Objetivo general', { negrita: true, espacio: 2 })
  texto(v(objetivoGeneral?.descripcion))
  texto('4.3 Objetivos específicos', { negrita: true, espacio: 2 })
  if (objetivosEspecificos.length === 0) texto(VACIO)
  else for (const o of objetivosEspecificos) texto(`• ${o.descripcion}`)
  texto('4.4 Antecedentes', { negrita: true, espacio: 2 })
  if (datos.antecedentes.length === 0) texto(VACIO)
  else for (const a of datos.antecedentes) texto(`• ${a.descripcion}${a.autor ? ` — ${a.autor}` : ''}${a.fuente ? ` (${a.fuente})` : ''}`)
  texto('4.5 Marco teórico preliminar', { negrita: true, espacio: 2 })
  texto(v(proyecto.marco_teorico))
  texto('4.6 Metodología preliminar propuesta', { negrita: true, espacio: 2 })
  texto(v(proyecto.metodologia_preliminar), { espacio: 12 })

  texto('4.7 Impacto (por cada objetivo específico)', { negrita: true, espacio: 2 })
  const impactos = datos.objetivos.flatMap((o) => o.impactos)
  tabla(
    ['Impacto esperado', 'Beneficiario potencial', 'Indicador verificable'],
    impactos.map((im) => [v(im.impacto_esperado), v(im.beneficiario_potencial), v(im.indicador_verificable)])
  )

  texto('4.8 Referencias', { negrita: true, espacio: 2 })
  if (datos.referencias.length === 0) texto(VACIO)
  else for (const r of datos.referencias) texto(`• ${r.referencia}`)

  texto('4.9 Cronograma de actividades', { negrita: true, espacio: 4 })
  const filasCronograma = agruparCronogramaPorPeriodo(datos)
  if (filasCronograma.length === 0) {
    texto(VACIO)
  } else {
    const porPeriodo = new Map<string, FilaCronograma[]>()
    for (const f of filasCronograma) {
      const lista = porPeriodo.get(f.periodoNombre) ?? []
      lista.push(f)
      porPeriodo.set(f.periodoNombre, lista)
    }
    for (const [periodoNombre, filasPeriodo] of porPeriodo) {
      texto(`${periodoNombre} — Año ${filasPeriodo[0].año}`, { negrita: true, espacio: 2 })
      tabla(
        ['Actividad', 'Resultado', 'Responsable', ...MESES],
        filasPeriodo.map((f) => [f.actividad, f.resultado, f.responsable, ...MESES.map((_, i) => (f.mesesMarcados.has(i + 1) ? 'X' : ''))])
      )
    }
  }

  texto('4.10 Resultados esperados', { negrita: true, espacio: 4 })
  const cantidadPorTipoPdf = new Map(datos.productos.map((p) => [p.tipoProducto.nombre + '|' + p.tipoProducto.subcategoria.nombre, p.cantidad]))
  for (const cat of datos.categoriasProducto) {
    texto(cat.nombre, { negrita: true, espacio: 2 })
    const filasCat: string[][] = []
    for (const sub of cat.subcategorias) {
      for (const tipo of sub.tipos) {
        filasCat.push([sub.nombre, tipo.nombre, String(cantidadPorTipoPdf.get(tipo.nombre + '|' + sub.nombre) ?? 0)])
      }
    }
    tabla(['Subcategoría', 'Tipo de producto', 'Número de productos'], filasCat)
  }

  texto('4.11 Componente ético', { negrita: true, espacio: 2 })
  texto(v(proyecto.componente_etico))
  texto('4.12 Funciones del estudiante auxiliar o asistente', { negrita: true, espacio: 2 })
  texto(v(proyecto.funciones_estudiante_auxiliar), { espacio: 12 })

  tituloSeccionPdf('FIRMAS')
  for (const p of [principal, ...coinvestigadores, ...externos, ...egresados, ...estudiantes]) {
    if (p) texto(`${p.usuario.nombre} ${p.usuario.apellido} — ${p.rolProyecto.nombre}`)
  }

  tituloSeccionPdf('ANEXO 1 — HOJAS DE VIDA DE INVESTIGADORES')
  for (const p of datos.participantes) {
    const hv = datos.hojasVida.get(p.participante)
    const eg = p.rolProyecto.nombre === ROL_EGRESADO ? datos.egresados.get(p.id_usuarioproyecto) : null
    texto(`${p.rolProyecto.nombre}: ${p.usuario.nombre} ${p.usuario.apellido}`, { negrita: true, espacio: 2 })
    texto(`Lugar y fecha de nacimiento: ${v(hv?.lugar_nacimiento)}, ${v(hv?.fecha_nacimiento)}   Nacionalidad: ${v(hv?.nacionalidad)}`)
    texto(`Tipo y No. Documento de identidad: ${v(hv?.tipo_documento)} ${v(hv?.numero_documento)}   Correo: ${p.usuario.correo}`)
    texto(`Dirección de residencia: ${v(hv?.direccion)}   Teléfono: ${v(hv?.telefono)}   Celular: ${v(hv?.celular)}`)
    texto(`Cargo actual: ${v(hv?.cargo_actual)}`)
    texto(`Cargos desempeñados: ${v(hv?.cargos_desempenados)}`)
    texto(`Títulos académicos obtenidos: ${v(hv?.titulos_academicos)}`)
    texto(`Producción científica y académica: ${v(hv?.produccion_cientifica)}`, { espacio: eg ? 4 : 10 })
    if (eg) {
      texto(`Facultad (egresado): ${v(eg.facultad)}   Programa académico: ${v(eg.programa_academico)}   Empresa/Entidad: ${v(eg.empresa_entidad)}`, { espacio: 10 })
    }
  }

  doc.save(`${proyecto.titulo || 'proyecto'}.pdf`)
}
