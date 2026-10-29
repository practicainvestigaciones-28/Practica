import { generarPdf, type EncabezadoFormato } from '../../proyectos/lib/exportar/pdf'
import type { Bloque, CeldaSpec, DocumentoFormato, Texto } from '../../proyectos/lib/exportar/modelo'
import type { FirmaSeguimiento, ProyectoSeguimiento } from '../api/tipos'
import { INTRO_RESULTADOS, MODALIDADES_CIERRE, TEXTO_PAZ_Y_SALVO, TEXTO_SOPORTES, fraseFirmaCierre, indiceModalidad, resultadosCierre } from './cierre'
import { formatoFecha } from './formato'
import { MARGEN_VERTICAL, bloqueSello, numerarPaginas, obtenerLogo, prepararSelloAdministrador } from './pdfComun'
import { duracionTotal, fechaFin } from './reglas'

/**
 * Acta de cierre en el formato oficial INV-IC-FR-021 (V5, 02/JUN/2026): mismos
 * numerales, tablas, textos y bloque de firmas que el documento de la Vicerrectoría.
 */

const ENCABEZADO: EncabezadoFormato = {
  titulo: 'ACTA DE CIERRE DE PROYECTO DE\nINVESTIGACIÓN',
  codigo: 'INV-IC-FR-021',
  version: '5',
  fecha: '02/JUN/2026',
}

const GRIS = 'D9D9D9'
const AZUL = 'D9E2F3'
const TAM = 9.5
const W_ETQ = 20

const celda = (w: number, texto: Texto = '', o: Partial<CeldaSpec> = {}): CeldaSpec => ({ w, texto, size: TAM, valign: 'middle', ...o })
const etiqueta = (w: number, texto: Texto, o: Partial<CeldaSpec> = {}) => celda(w, texto, { fondo: GRIS, ...o })
const titulo = (texto: string) => etiqueta(100, texto, { align: 'center', negrita: true, minH: 22 })
const cabecera = (w: number, texto: string) => celda(w, texto, { fondo: AZUL, align: 'center', negrita: true })
const marca = (w: number, activa: boolean) => celda(w, activa ? 'X' : '', { align: 'center', negrita: true })
const tabla = (filas: CeldaSpec[][], espacioDespues = 14): Bloque => ({ tipo: 'tabla', tabla: { filas, espacioDespues } })
const parrafo = (texto: Texto, despues = 14): Bloque => ({ tipo: 'parrafo', parrafo: { texto, size: TAM, despues } })

/** Las fechas de adquisición se guardan como yyyy-mm-dd; el resto del texto se deja tal cual. */
const valorCelda = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? formatoFecha(v) : v)

const ANCHOS_ADQ = [29, 14.5, 16, 17, 23.5]

/** Sub-bloque de adquisiciones (3.1 y 3.2): el formato trae dos renglones, se agregan los que hagan falta. */
function filasAdquisiciones(subtitulo: string, instruccion: string, columnas: string[], filas: string[][]): CeldaSpec[][] {
  const renglones = [...filas, ...Array.from({ length: Math.max(0, 2 - filas.length) }, () => ['', '', '', '', ''])]
  return [
    [etiqueta(100, subtitulo, { negrita: true })],
    [celda(100, instruccion, { minH: 20 })],
    columnas.map((c, i) => cabecera(ANCHOS_ADQ[i], c)),
    ...renglones.map((f) => ANCHOS_ADQ.map((w, i) => celda(w, valorCelda(f[i] ?? ''), { minH: 18 }))),
  ]
}

/** En el acta de cierre la línea de firma va arriba y debajo el nombre y el cargo. */
function bloqueFirma(f: FirmaSeguimiento | undefined, nombre: string, cargo: string): CeldaSpec[] {
  const sinBorde = { bordes: false as const, valign: 'top' as const }
  const constancia: Texto = f?.firmado ? [{ t: `Firmado electrónicamente · ${formatoFecha(f.fecha)}`, i: true, color: '1E7A46' }] : ''
  return [
    celda(100, constancia, { bordes: { b: true }, valign: 'bottom', minH: 40 }),
    celda(100, nombre.toUpperCase(), { ...sinBorde, negrita: true }),
    celda(100, cargo, sinBorde),
  ]
}

export function construirDocumentoCierre(p: ProyectoSeguimiento): DocumentoFormato {
  const c = p.cierre
  const { info } = p.informe_final
  const modalidad = indiceModalidad(p.modalidad)
  const estudiantes = [...info.apoyos, ...Array.from({ length: Math.max(0, 2 - info.apoyos.length) }, () => null)]
  const coinvestigador = info.co_investigador_interno.nombre ? info.co_investigador_interno : info.co_investigador_externo
  const anchosModalidad = [12, 10, 12, 12, 14]

  const informacion = tabla([
    [titulo('1.    INFORMACIÓN GENERAL DEL PROYECTO')],
    [etiqueta(W_ETQ, 'Título del proyecto:', { minH: 22 }), celda(80, p.titulo)],
    [etiqueta(W_ETQ, 'Centro de costos'), celda(33, p.centro_costos), etiqueta(21, 'Convocatoria interna'), celda(26, p.convocatoria)],
    [
      etiqueta(W_ETQ, 'Fecha de inicio'),
      celda(18, formatoFecha(p.fecha_inicio)),
      etiqueta(22, 'Fecha de finalización'),
      celda(16, formatoFecha(c.fecha_fin_real || fechaFin(p))),
      etiqueta(12, 'Duración'),
      celda(12, `${duracionTotal(p)} meses`),
    ],
    [
      etiqueta(W_ETQ, 'Modalidad del proyecto'),
      ...MODALIDADES_CIERRE.flatMap((m, i) => [celda(anchosModalidad[i], m, { size: 8, minH: 30 }), marca(4, i === modalidad)]),
    ],
    [etiqueta(W_ETQ, 'Nombre investigador(a) principal'), celda(33, info.investigador_principal.nombre), etiqueta(21, 'Programa académico'), celda(26, info.investigador_principal.programa)],
    [etiqueta(W_ETQ, 'Grupo de investigación'), celda(33, info.investigador_principal.grupo), etiqueta(21, 'Línea de investigación'), celda(26, c.linea_investigacion_principal)],
    [etiqueta(W_ETQ, 'Nombre coinvestigador(a)'), celda(33, coinvestigador.nombre), etiqueta(21, 'Programa académico'), celda(26, coinvestigador.programa)],
    [etiqueta(W_ETQ, 'Grupo de investigación'), celda(33, coinvestigador.grupo), etiqueta(21, 'Línea de investigación'), celda(26, c.linea_investigacion_co)],
    // Cada estudiante ocupa dos renglones: uno por casilla de rol.
    ...estudiantes.flatMap((e, i) => [
      [
        etiqueta(W_ETQ, 'Nombre estudiante investigador(a)', { rowSpan: 2 }),
        celda(26, e?.nombre ?? '', { rowSpan: 2 }),
        etiqueta(14, 'Programa académico', { rowSpan: 2 }),
        celda(22, e ? c.programas_estudiantes[i] ?? '' : '', { rowSpan: 2 }),
        etiqueta(6, 'Rol', { rowSpan: 2, align: 'center' }),
        celda(9, 'Auxiliar', { size: 8.5 }),
        marca(3, e?.tipo === 'Auxiliar'),
      ],
      [celda(9, 'Asistente', { size: 8.5 }), marca(3, e?.tipo === 'Asistente')],
    ]),
  ])

  const resultados: Bloque[] = resultadosCierre(p).map((cat, i) =>
    tabla([
      ...(i === 0 ? [[titulo('2.    RESULTADOS')], [celda(100, INTRO_RESULTADOS, { minH: 24 })]] : []),
      [
        etiqueta(
          100,
          cat.opcional ? [{ t: `${cat.codigo} ${cat.nombre} `, b: true }, { t: '(Productos opcionales)', i: true }] : [{ t: `${cat.codigo} ${cat.nombre}`, b: true }]
        ),
      ],
      [cabecera(30, 'Concepto'), cabecera(14, 'Resultados proyectados'), cabecera(14, 'Resultados obtenidos'), cabecera(18.5, 'Soporte'), cabecera(23.5, 'Observaciones')],
      ...cat.filas.map((f) => [
        celda(30, f.concepto, { minH: 24 }),
        celda(14, String(f.proyectado), { align: 'center' }),
        celda(14, f.obtenido != null ? String(f.obtenido) : '', { align: 'center' }),
        celda(18.5, f.soporte, { size: 8 }),
        celda(23.5, f.observacion, { size: 8.5 }),
      ]),
    ])
  )

  const adquisiciones = tabla(
    [
      [titulo('3.    ADQUISICIÓN DE MATERIALES Y EQUIPOS')],
      ...filasAdquisiciones(
        '3.1   Equipos – Software - Licencias',
        'Se relacionan los equipos adquiridos con los recursos presupuestales del proyecto de investigación.',
        ['Equipo / Software / Licencia', 'Fecha de adquisición', 'Estado', 'Código Inventario', 'Observaciones'],
        p.informe_final.equipos
      ),
      ...filasAdquisiciones(
        '3.2   Material bibliográfico',
        'Se relaciona el material bibliográfico adquirido con los recursos presupuestales del proyecto de investigación.',
        ['Nombre del material', 'Fecha de adquisición', 'ISBN / ISSN', 'Código Inventario', 'Observaciones'],
        p.informe_final.materiales
      ),
    ],
    18
  )

  const firmaDe = (rol: FirmaSeguimiento['rol']) => c.firmas.find((x) => x.rol === rol)
  const firmantes = [
    bloqueFirma(firmaDe('Investigador principal'), info.investigador_principal.nombre || p.investigador_principal, 'Investigador(a) Principal'),
    bloqueFirma(firmaDe('Co-investigadores'), coinvestigador.nombre || 'Nombre co-investigador(a)', 'Co-Investigador(a)'),
    bloqueFirma(firmaDe('Líder del grupo'), 'Líder grupo de investigación', `Líder Grupo de Investigación ${p.grupo}`),
    bloqueFirma(firmaDe('Vicerrector'), 'Vicerrector de Investigación', 'Vicerrector de Investigación y Extensión'),
    // De último, el Administrador firma como quien elaboró el acta de cierre.
  ]
  const hueco = celda(16, '', { bordes: false })
  const filaFirmas = (a: CeldaSpec[], b: CeldaSpec[]): Bloque =>
    tabla(a.map((x, i) => [{ ...x, w: 40 }, hueco, { ...b[i], w: 40 }, { ...hueco, w: 4 }]), 26)

  const bloques: Bloque[] = [
    informacion,
    ...resultados,
    adquisiciones,
    parrafo([{ t: 'Soportes: ', b: true }, { t: TEXTO_SOPORTES }]),
    parrafo(TEXTO_PAZ_Y_SALVO),
    parrafo(fraseFirmaCierre(c.ciudad, c.fecha_acta), 30),
    filaFirmas(firmantes[0], firmantes[1]),
    filaFirmas(firmantes[2], firmantes[3]),
    bloqueSello('Elaborado por:', !!firmaDe('Administrador')?.firmado),
  ]

  return { secciones: [{ orientacion: 'vertical', bloques }] }
}

export async function descargarPdfCierre(p: ProyectoSeguimiento): Promise<void> {
  await prepararSelloAdministrador()
  const doc = generarPdf(construirDocumentoCierre(p), await obtenerLogo(), ENCABEZADO)
  numerarPaginas(doc, MARGEN_VERTICAL)
  doc.save(`acta-cierre-${p.id_proyecto}.pdf`)
}
