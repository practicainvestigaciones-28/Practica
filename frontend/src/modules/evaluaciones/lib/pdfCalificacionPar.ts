import { generarPdf, type EncabezadoFormato } from '../../proyectos/lib/exportar/pdf'
import type { Bloque, CeldaSpec, DocumentoFormato, Run, Texto } from '../../proyectos/lib/exportar/modelo'
import { MARGEN_VERTICAL, numerarPaginas, obtenerLogo } from '../../seguimiento/lib/pdfComun'
import * as evaluacionesApi from '../api/evaluaciones'
import { criteriosEvaluacion, parsearComentariosPar } from './parEvaluador'

/**
 * Calificación del Par Evaluador en el formato INV-IC-FR-008: la rúbrica con
 * el puntaje y las observaciones de cada criterio, el total, las
 * observaciones generales y la firma electrónica del par (ID de transacción y
 * hash). Lo descargan el propio par y el Administrador.
 */

const ENCABEZADO: EncabezadoFormato = {
  titulo: 'EVALUACIÓN DE PROYECTOS DE INVESTIGACIÓN\nPAR EVALUADOR',
  codigo: 'INV-IC-FR-008',
  version: '',
  fecha: '',
}

const GRIS = 'D9D9D9'
const TAM = 9

const celda = (w: number, texto: Texto = '', o: Partial<CeldaSpec> = {}): CeldaSpec => ({ w, texto, size: TAM, valign: 'middle', ...o })
const etiqueta = (w: number, texto: Texto, o: Partial<CeldaSpec> = {}) => celda(w, texto, { fondo: GRIS, negrita: true, ...o })

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function construirDocumento(c: evaluacionesApi.CalificacionParFirmada): DocumentoFormato {
  const { criterios, observacionesGenerales } = parsearComentariosPar(c.comentarios)
  const nombrePar = `${c.evaluador.nombre} ${c.evaluador.apellido}`.trim()

  const ficha: CeldaSpec[][] = [
    [etiqueta(24, 'Título del proyecto'), celda(76, c.proyecto.titulo)],
    [etiqueta(24, 'Convocatoria'), celda(76, c.proyecto.convocatoria)],
    [etiqueta(24, 'Fecha de evaluación'), celda(76, fechaHora(c.fecha_evaluacion))],
  ]

  const rubrica: CeldaSpec[][] = [
    [etiqueta(46, 'CRITERIO', { align: 'center' }), etiqueta(14, 'PUNTAJE', { align: 'center' }), etiqueta(40, 'OBSERVACIONES', { align: 'center' })],
    ...criteriosEvaluacion.map((crit) => {
      const fila = criterios.find((x) => x.numero === crit.numero)
      return [
        celda(46, [{ t: `${crit.numero}. ${crit.titulo}`, b: true }, { t: ` (máximo ${crit.maximoPuntos} puntos)\n` }, { t: crit.descripcion, i: true }], {
          valign: 'top',
        }),
        celda(14, fila?.puntaje && fila.puntaje !== '—' ? `${fila.puntaje} / ${crit.maximoPuntos}` : '—', { align: 'center' }),
        celda(40, fila?.observacion ?? '', { valign: 'top' }),
      ]
    }),
    [etiqueta(46, 'TOTAL ACUMULADO', { align: 'right' }), etiqueta(14, c.puntaje != null ? `${c.puntaje}` : '—', { align: 'center' }), etiqueta(40, '')],
  ]

  const observaciones: CeldaSpec[][] = [
    [etiqueta(100, 'OBSERVACIONES GENERALES')],
    [celda(100, observacionesGenerales ?? 'Sin observaciones generales.', { valign: 'top', minH: 40 })],
  ]

  const lineaFirma: Run[] = c.firma
    ? [{ t: `Firmado electrónicamente el ${fechaHora(c.firma.fecha_firma)}`, b: true, color: '1E7A3C' }]
    : [{ t: 'Calificación registrada antes de la firma electrónica', b: true, color: 'B26A00' }]
  const evidencia = c.firma ? `ID de transacción: ${c.firma.id_transaccion}\nHash: ${c.firma.hash_firma}` : ''
  const firma: CeldaSpec[][] = [
    [celda(100, lineaFirma, { bordes: { b: true }, valign: 'bottom', minH: 30 })],
    [celda(100, [{ t: nombrePar.toUpperCase(), b: true }, { t: '\nPar Evaluador' }], { bordes: false, valign: 'top' })],
    ...(evidencia ? [[celda(100, evidencia, { bordes: false, size: 7.5, valign: 'top' })]] : []),
  ]

  const bloques: Bloque[] = [
    { tipo: 'espacio', pt: 18 },
    { tipo: 'tabla', tabla: { filas: ficha, espacioDespues: 12 } },
    { tipo: 'tabla', tabla: { filas: rubrica, espacioDespues: 12 } },
    { tipo: 'tabla', tabla: { filas: observaciones, espacioDespues: 30 } },
    { tipo: 'tabla', tabla: { filas: firma.map((fila) => [{ ...fila[0], w: 60 }, celda(40, '', { bordes: false })]) } },
  ]
  return { secciones: [{ orientacion: 'vertical', bloques }] }
}

async function generarPdfCalificacion(id_evaluacion: number) {
  const calificacion = await evaluacionesApi.obtenerCalificacionPar(id_evaluacion)
  const doc = generarPdf(construirDocumento(calificacion), await obtenerLogo(), ENCABEZADO)
  numerarPaginas(doc, MARGEN_VERTICAL)
  return { doc, calificacion }
}

/** Descarga el PDF de la calificación firmada de un par. */
export async function descargarPdfCalificacionPar(id_evaluacion: number): Promise<void> {
  const { doc, calificacion } = await generarPdfCalificacion(id_evaluacion)
  doc.save(`calificacion-par-proyecto-${calificacion.proyecto.id_proyecto}.pdf`)
}

/**
 * Muestra el PDF en el visor del navegador sin descargarlo. La pestaña se abre
 * en el mismo clic, antes de generar el documento: si se abriera después de
 * esperar, el navegador la bloquearía como ventana emergente.
 */
export async function verPdfCalificacionPar(id_evaluacion: number): Promise<void> {
  const ventana = window.open('', '_blank')
  try {
    const { doc } = await generarPdfCalificacion(id_evaluacion)
    const url = URL.createObjectURL(doc.output('blob'))
    if (ventana) ventana.location.href = url
    else window.open(url, '_blank')
  } catch (error) {
    ventana?.close()
    throw error
  }
}
