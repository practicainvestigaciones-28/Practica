import { generarPdf, type EncabezadoFormato } from '../../proyectos/lib/exportar/pdf'
import type { Bloque, CeldaSpec, DocumentoFormato, Texto } from '../../proyectos/lib/exportar/modelo'
import type { FirmaSeguimiento, PeriodoInforme, ProyectoSeguimiento } from '../api/tipos'
import { etiquetaEvidencia } from './archivos'
import { formatoFecha } from './formato'
import { MARGEN_HORIZONTAL, bloqueRevisionAdministrador, numerarPaginas, obtenerLogo } from './pdfComun'
import { MESES_POR_PERIODO, SEMANAS_POR_MES, SEMANAS_POR_PERIODO, anioPeriodo, duracionTotal } from './reglas'

/**
 * Informe de avance en el formato oficial INV-IC-FR-018 (V2, 22/NOV/2023):
 * hoja horizontal con la ficha del proyecto, el equipo investigador y el
 * cronograma de 6 meses x 4 semanas por actividad. Usa el mismo motor de PDF
 * que la exportación del proyecto y el acta de inicio.
 */

const ENCABEZADO: EncabezadoFormato = {
  titulo: 'INFORME DE AVANCE\nPROYECTO DE INVESTIGACIÓN',
  codigo: 'INV-IC-FR-018',
  version: '2',
  fecha: '22/NOV/2023',
}

const GRIS = 'D9D9D9'
const MARCA = '595959'
const TAM = 8.5

// Anchos relativos de las columnas (suman 100), tomados del formato.
const W_ETIQUETA = 23.5
const W_META = 11
const W_ACTIVIDAD = 15
const W_RESPONSABLE = 10
const W_CRONOGRAMA = 100 - W_ETIQUETA - W_META - W_ACTIVIDAD - W_RESPONSABLE
const W_SEMANA = W_CRONOGRAMA / SEMANAS_POR_PERIODO

const celda = (w: number, texto: Texto = '', o: Partial<CeldaSpec> = {}): CeldaSpec => ({ w, texto, size: TAM, valign: 'middle', ...o })
const etiqueta = (w: number, texto: Texto, o: Partial<CeldaSpec> = {}) =>
  celda(w, texto, { fondo: GRIS, align: 'center', negrita: true, ...o })

/** El formato trae dos renglones por tipo de integrante; se agregan más si el equipo es mayor. */
const renglones = (...listas: string[][]) => Math.max(2, ...listas.map((l) => l.length))

function bloqueFirma(f: FirmaSeguimiento | undefined, nombre: string, cargo: string): CeldaSpec[][] {
  const sinBorde = { bordes: false as const, valign: 'top' as const }
  const constancia: Texto = f?.firmado ? [{ t: 'Firmado electrónicamente', i: true, color: '1E7A46' }] : [{ t: 'FIRMA', color: 'BFBFBF', b: true }]
  return [
    [celda(100, constancia, { bordes: { b: true }, valign: 'bottom', minH: 34 })],
    [celda(100, nombre.toUpperCase(), { ...sinBorde, negrita: true })],
    [celda(100, cargo, { ...sinBorde, negrita: true })],
    [celda(100, [{ t: 'Fecha: ', b: true }, { t: f?.firmado ? formatoFecha(f.fecha) : '' }], sinBorde)],
  ]
}

export function construirDocumentoAvance(p: ProyectoSeguimiento, pe: PeriodoInforme): DocumentoFormato {
  const { equipo } = p
  const nInv = renglones(equipo.co_investigadores_internos, equipo.co_investigadores_externos)
  const nApoyo = renglones(equipo.auxiliares, equipo.asistentes)
  const wDatos = 100 - W_ETIQUETA

  const filas: CeldaSpec[][] = [
    [etiqueta(W_ETIQUETA, 'Título de la investigación', { minH: 26 }), celda(wDatos, p.titulo)],
    [
      etiqueta(W_ETIQUETA, 'Programa académico / Departamento'),
      celda(26.5, p.programa_academico),
      etiqueta(15, 'Duración del proyecto'),
      celda(9, `${duracionTotal(p)} meses`),
      etiqueta(10, 'Convocatoria'),
      celda(16, p.convocatoria),
    ],
    // Equipo investigador: la etiqueta abarca todos los renglones del bloque.
    [
      etiqueta(W_ETIQUETA, 'Equipo investigador', { rowSpan: nInv + nApoyo + 2 }),
      etiqueta(27.7, 'Investigador principal'),
      etiqueta(28.5, 'Co-investigadores internos'),
      etiqueta(20.3, 'Co-investigadores externos'),
    ],
    ...Array.from({ length: nInv }, (_, i) => [
      ...(i === 0 ? [celda(27.7, p.investigador_principal, { rowSpan: nInv })] : []),
      celda(28.5, equipo.co_investigadores_internos[i] ?? ''),
      celda(20.3, equipo.co_investigadores_externos[i] ?? ''),
    ]),
    [etiqueta(41.5, 'Auxiliar de investigación'), etiqueta(35, 'Asistente de investigación')],
    ...Array.from({ length: nApoyo }, (_, i) => [celda(41.5, equipo.auxiliares[i] ?? ''), celda(35, equipo.asistentes[i] ?? '')]),
    // Cronograma
    [
      etiqueta(W_ETIQUETA, 'Objetivos específicos', { rowSpan: 2 }),
      etiqueta(W_META, 'Meta', { rowSpan: 2 }),
      etiqueta(W_ACTIVIDAD, 'Actividades', { rowSpan: 2 }),
      etiqueta(W_RESPONSABLE, 'Responsable', { rowSpan: 2 }),
      etiqueta(W_CRONOGRAMA, `Período ${pe.numero} Año ${anioPeriodo(pe)}`),
    ],
    Array.from({ length: MESES_POR_PERIODO }, (_, m) => etiqueta(W_SEMANA * SEMANAS_POR_MES, `Mes ${m + 1}`)),
    ...p.metas.map((meta, i) => [
      celda(W_ETIQUETA, meta.objetivo),
      celda(W_META, meta.meta),
      celda(W_ACTIVIDAD, meta.actividad),
      celda(W_RESPONSABLE, meta.responsable),
      ...Array.from({ length: SEMANAS_POR_PERIODO }, (_, s) => celda(W_SEMANA, '', pe.detalle[i]?.semanas[s] ? { fondo: MARCA } : {})),
    ]),
  ]

  const evidencias = [...new Set(pe.detalle.flatMap((d) => d.evidencias.map(etiquetaEvidencia)))]
  const firmaDe = (rol: FirmaSeguimiento['rol']) => pe.firmas.find((f) => f.rol === rol)
  const coInvestigadores = [...equipo.co_investigadores_internos, ...equipo.co_investigadores_externos].join(', ') || 'Nombre co investigador(a)'
  const vacio = celda(100, '', { bordes: false })
  const izq = bloqueFirma(firmaDe('Investigador principal'), p.investigador_principal, 'Investigador(a) principal')
  const der = bloqueFirma(firmaDe('Co-investigadores'), coInvestigadores, 'Co Investigador(a)')

  const bloques: Bloque[] = [
    { tipo: 'espacio', pt: 26 },
    { tipo: 'tabla', tabla: { filas, espacioDespues: 10 } },
    {
      tipo: 'parrafo',
      parrafo: {
        texto: [
          { t: 'Nota: ', b: true },
          { t: 'Adjuntar las evidencias del avance de actividades según el cronograma.' },
          ...(evidencias.length > 0 ? [{ t: ` Evidencias adjuntas: ${evidencias.join(', ')}.` }] : []),
        ],
        size: TAM,
        despues: 30,
      },
    },
    // Dos firmas lado a lado, con una columna vacía a la derecha como en el formato.
    {
      tipo: 'tabla',
      tabla: {
        filas: izq.map((fila, i) => [{ ...fila[0], w: 29 }, { ...vacio, w: 11 }, { ...der[i][0], w: 27 }, { ...vacio, w: 33 }]),
      },
    },
    { tipo: 'espacio', pt: 22 },
    bloqueRevisionAdministrador(pe.estado === 'Aprobado', TAM),
  ]

  return { secciones: [{ orientacion: 'horizontal', bloques }] }
}

export async function descargarPdfAvance(p: ProyectoSeguimiento, pe: PeriodoInforme): Promise<void> {
  const doc = generarPdf(construirDocumentoAvance(p, pe), await obtenerLogo(), ENCABEZADO)
  numerarPaginas(doc, MARGEN_HORIZONTAL)
  doc.save(`informe-avance-${p.id_proyecto}-periodo-${pe.numero}.pdf`)
}
