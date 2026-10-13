import type jsPDF from 'jspdf'
import logoUrl from '../../../assets/cesmag-logo.png'
import { generarPdf, type EncabezadoFormato } from '../../proyectos/lib/exportar/pdf'
import type { Bloque, CeldaSpec, DocumentoFormato, Texto } from '../../proyectos/lib/exportar/modelo'
import type { ActaInicioDetalle, FirmaActa, ParticipanteActa, TipoProyecto } from '../api/actaInicio'
import { formatoPesos } from './actaInicio'
import { CLAUSULAS, CONSIDERACIONES_FINALES, RUBROS_ANTELACION } from './textosLegales'

/**
 * Acta de inicio en el formato oficial INV-IC-FR-017 (V5, 13/MAR/2026): mismo
 * encabezado, numerales y tablas que el documento de la Vicerrectoría, ya
 * diligenciado. Usa el mismo motor de PDF que la exportación del proyecto.
 */

const ENCABEZADO: EncabezadoFormato = {
  titulo: 'ACTA DE INICIO Y COMPROMISOS PROYECTO DE INVESTIGACIÓN',
  codigo: 'INV-IC-FR-017',
  version: '5',
  fecha: '13/MAR/2026',
}

const GRIS = 'D9D9D9'
const ANCHO = 530
const TAM = 10

const celda = (w: number, texto: Texto = '', o: Partial<CeldaSpec> = {}): CeldaSpec => ({ w, texto, size: TAM, ...o })
const etiqueta = (w: number, texto: Texto, o: Partial<CeldaSpec> = {}) => celda(w, texto, { fondo: GRIS, ...o })
const marca = (activa: boolean) => celda(24, activa ? 'X' : '', { align: 'center', negrita: true })
const campo = (w: number, nombre: string, valor: string | null) => celda(w, [{ t: `${nombre} `, b: true }, { t: valor ?? '' }])
const tabla = (filas: CeldaSpec[][], espacioDespues = 0): Bloque => ({ tipo: 'tabla', tabla: { filas, espacioDespues } })
const titulo = (texto: string): Bloque => ({ tipo: 'parrafo', parrafo: { texto, negrita: true, size: TAM, antes: 14, despues: 10 } })
const parrafo = (texto: Texto): Bloque => ({ tipo: 'parrafo', parrafo: { texto, size: TAM, despues: 9 } })

const TIPOS: [TipoProyecto, TipoProyecto | null][] = [
  ['Investigación Científica', 'Innovación Educativa'],
  ['Desarrollo Tecnológico', 'Innovación'],
  ['Creación Artística y Cultural', null],
]

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS_EN_LETRAS = [
  '', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
  'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
  'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve', 'treinta', 'treinta y un',
]

const fechaCorta = (iso: string | null) => {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

const esPrincipal = (rol: string) => rol.toLowerCase().includes('principal')

/** La fecha de suscripción es la de la última firma registrada; sin firmas, queda por diligenciar. */
function fraseSuscripcion(firmas: FirmaActa[]): Texto {
  const inicio =
    'En señal de conformidad y aceptación, y dejando constancia del inicio de actividades dentro del proyecto de investigación relacionado en la parte inicial del presente documento, se firma el presente escrito en la ciudad de Pasto-Colombia, a los '
  const fechas = firmas.filter((f) => f.firmado && f.fecha_firma).map((f) => f.fecha_firma as string).sort()
  const ultima = fechas[fechas.length - 1]
  if (!ultima) return `${inicio}_____ (___) días del mes de __________ de ____.`
  const fecha = new Date(ultima)
  const dia = fecha.getDate()
  return `${inicio}${DIAS_EN_LETRAS[dia]} (${dia}) días del mes de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}.`
}

function bloqueParticipante(p: ParticipanteActa): Bloque {
  const principal = esPrincipal(p.rol)
  return tabla(
    [
      [etiqueta(268, 'Nombre completo del participante', { align: 'center', negrita: true }), etiqueta(262, 'Tipo de participante', { align: 'center', negrita: true })],
      [celda(268, p.nombre), celda(120, 'Investigador Principal'), marca(principal), celda(94, 'Co-Investigador'), marca(!principal)],
      [campo(142, 'Identificación:', p.identificacion), campo(150, 'Teléfono:', p.telefono), campo(238, 'E-mail:', p.correo)],
      [campo(268, 'Programa Académico:', p.programa_academico), campo(262, 'Institución:', p.institucion)],
    ],
    10
  )
}

/** Recuadro de firma: línea, nombre y rol. Si ya firmó, deja constancia de la firma electrónica. */
function celdasFirma(f: FirmaActa | undefined, rol: string): { linea: CeldaSpec; nombre: CeldaSpec; cargo: CeldaSpec } {
  const sinBorde = { bordes: false as const }
  if (!f) return { linea: celda(250, '', sinBorde), nombre: celda(250, '', sinBorde), cargo: celda(250, '', sinBorde) }
  const constancia: Texto = f.firmado
    ? [{ t: `Firmado electrónicamente · ${f.fecha_firma ? new Date(f.fecha_firma).toLocaleString('es-CO') : ''}`, i: true, color: '1E7A46' }]
    : [{ t: 'FIRMA', color: 'BFBFBF' }]
  return {
    linea: celda(250, constancia, { bordes: { b: true }, valign: 'bottom', minH: 46, size: 9 }),
    nombre: celda(250, f.nombre.toUpperCase(), { ...sinBorde, negrita: true }),
    cargo: celda(250, rol, sinBorde),
  }
}

function bloquesFirmas(acta: ActaInicioDetalle): Bloque[] {
  const ordenadas = [...acta.firmas].sort((a, b) => a.orden_firma - b.orden_firma)
  const investigadores = ordenadas.filter((f) => f.rol_firmante !== 'Vicerrector')
  const vicerrector = ordenadas.find((f) => f.rol_firmante === 'Vicerrector')
  // Antes de generar el acta aún no hay firmas: se muestran los participantes como firmantes pendientes.
  const pendientes: FirmaActa[] =
    investigadores.length > 0
      ? investigadores
      : acta.participantes.map((p, i) => ({
          id_firma: -i,
          id_usuario: p.id_usuario,
          nombre: p.nombre,
          rol_firmante: esPrincipal(p.rol) ? 'investigador principal' : 'co-investigador',
          orden_firma: i + 1,
          firmado: false,
          fecha_firma: null,
        }))
  const separador = celda(30, '', { bordes: false })
  const rolDe = (f: FirmaActa | undefined) => (f?.rol_firmante === 'investigador principal' ? 'Investigador Principal' : 'Co-Investigador')

  const bloques: Bloque[] = []
  for (let i = 0; i < pendientes.length; i += 2) {
    const a = celdasFirma(pendientes[i], rolDe(pendientes[i]))
    const b = celdasFirma(pendientes[i + 1], rolDe(pendientes[i + 1]))
    bloques.push(tabla([[a.linea, separador, b.linea], [a.nombre, separador, b.nombre], [a.cargo, separador, b.cargo]], 18))
  }
  const v = celdasFirma(
    vicerrector ?? { id_firma: 0, id_usuario: 0, nombre: 'Vicerrector de Investigación', rol_firmante: 'Vicerrector', orden_firma: 99, firmado: false, fecha_firma: null },
    'Vicerrector de Investigación y Extensión'
  )
  const vacia = celda(250, '', { bordes: false })
  bloques.push(tabla([[v.linea, separador, vacia], [v.nombre, separador, vacia], [v.cargo, separador, vacia]]))
  return bloques
}

export function construirDocumentoActa(acta: ActaInicioDetalle): DocumentoFormato {
  const clausula = (tipo: (typeof CLAUSULAS)[number]['tipo']) => CLAUSULAS.find((c) => c.tipo === tipo)!.parrafos.map(parrafo)
  // El formato trae tres renglones de grupo: se completan en blanco si el proyecto tiene menos.
  const grupos = [...acta.grupos, ...Array.from({ length: Math.max(0, 3 - acta.grupos.length) }, () => ({ grupo: '', entidad: '' }))]

  const bloques: Bloque[] = [
    titulo('1.   INFORMACIÓN GENERAL DEL PROYECTO DE INVESTIGACIÓN'),
    tabla([
      [etiqueta(ANCHO, 'Título del Proyecto', { negrita: true })],
      [celda(ANCHO, acta.titulo, { minH: 34 })],
      [etiqueta(ANCHO, 'Objetivo General', { negrita: true })],
      [celda(ANCHO, acta.objetivo_general, { minH: 34 })],
      [etiqueta(ANCHO, 'Objetivos Específicos', { negrita: true })],
      [celda(ANCHO, acta.objetivos_especificos.map((o, i) => `${i + 1}. ${o}`).join('\n'), { minH: 70 })],
      [etiqueta(292, 'Grupo de Investigación', { negrita: true }), etiqueta(238, 'IES / Entidad', { negrita: true })],
      ...grupos.map((g) => [celda(292, g.grupo, { minH: 20 }), celda(238, g.entidad, { minH: 20 })]),
      [celda(ANCHO, 'Duración del proyecto', { negrita: true })],
      [
        etiqueta(86, 'Fecha de Inicio', { valign: 'middle', minH: 26 }),
        celda(168, fechaCorta(acta.fecha_inicio), { valign: 'middle' }),
        etiqueta(134, 'Duración', { valign: 'middle' }),
        celda(142, acta.duracion_meses ? `${acta.duracion_meses} meses` : '', { valign: 'middle' }),
      ],
    ]),

    titulo('2.   TIPO DE PROYECTO'),
    tabla(
      TIPOS.map(([izq, der]) =>
        der
          ? [celda(245, izq), marca(acta.tipo_proyecto === izq), celda(237, der), marca(acta.tipo_proyecto === der)]
          : [celda(245, izq), marca(acta.tipo_proyecto === izq), celda(261, '')]
      )
    ),

    titulo('3.   APROBACIÓN PROYECTO'),
    tabla([
      [
        etiqueta(56, 'Acta No.'),
        celda(80, acta.numero_acta_aprobacion ?? ''),
        etiqueta(54, 'Fecha'),
        celda(134, fechaCorta(acta.fecha_acta_aprobacion)),
        etiqueta(104, 'Centro de Costos'),
        celda(102, acta.centro_costos ?? ''),
      ],
      [celda(ANCHO, 'Financiación Interna del proyecto', { negrita: true })],
      ...(acta.vigencias.length > 0 ? acta.vigencias : [{ anio: 0, valor_asignado: 0 }]).map((v) => [
        celda(72, v.anio ? `Costo ${v.anio}` : 'Costo'),
        celda(458, v.anio ? formatoPesos(v.valor_asignado) : ''),
      ]),
    ]),

    titulo('4.   INFORMACIÓN GENERAL DE LOS PARTICIPANTES'),
    ...acta.participantes.map(bloqueParticipante),

    titulo('5.   COMPROMISOS DE LOS PARTICIPANTES'),
    ...clausula('compromisos'),

    titulo('6.   SOLICITUDES PARA ASIGNACIÓN DE RUBROS'),
    parrafo(
      'Los rubros susceptibles de financiación establecidos en el proyecto, por los siguientes conceptos, deberán presentarse ante las instancias pertinentes, con la antelación mínima que se relaciona a continuación, para cada caso:'
    ),
    tabla([
      [etiqueta(268, 'Concepto', { align: 'center', negrita: true }), etiqueta(262, 'Tiempo', { align: 'center', negrita: true })],
      ...RUBROS_ANTELACION.map(([concepto, tiempo]) => [celda(268, concepto), celda(262, tiempo)]),
    ]),

    titulo('7.   DERECHOS DE AUTOR:'),
    ...clausula('derechos de autor'),

    titulo('8.   COMPROMISO DE CONFIDENCIALIDAD:'),
    ...clausula('confidencialidad'),

    titulo('9.   TRATAMIENTO DE DATOS PERSONALES'),
    ...clausula('tratamiento de datos'),

    {
      tipo: 'parrafo',
      parrafo: {
        texto: [
          { t: '10.  CONSIDERACIONES FINALES: ', b: true },
          { t: 'Los participantes del proyecto de investigación aceptamos y nos comprometemos a cumplir y acatar lo siguiente:' },
        ],
        size: TAM,
        antes: 14,
        despues: 9,
      },
    },
    ...CONSIDERACIONES_FINALES.map(parrafo),
    parrafo(fraseSuscripcion(acta.firmas)),
    { tipo: 'espacio', pt: 26 },
    ...bloquesFirmas(acta),
  ]

  return { secciones: [{ orientacion: 'vertical', bloques }] }
}

let logoCache: string | null = null
async function obtenerLogo(): Promise<string> {
  if (logoCache) return logoCache
  const blob = await (await fetch(logoUrl)).blob()
  logoCache = await new Promise<string>((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(lector.result as string)
    lector.onerror = () => reject(lector.error)
    lector.readAsDataURL(blob)
  })
  return logoCache
}

/** El formato numera las páginas al pie ("Página 1 de 5"); se escribe al final, cuando ya se sabe el total. */
function numerarPaginas(doc: jsPDF): void {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor('#000000')
    const { width, height } = doc.internal.pageSize
    doc.text(`Página ${i} de ${total}`, width - 68.4, height - 24, { align: 'right' })
  }
}

export async function generarPdfActa(acta: ActaInicioDetalle): Promise<jsPDF> {
  const doc = generarPdf(construirDocumentoActa(acta), await obtenerLogo(), ENCABEZADO)
  numerarPaginas(doc)
  return doc
}
