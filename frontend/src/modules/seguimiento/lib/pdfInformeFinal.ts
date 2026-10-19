import { generarPdf, type EncabezadoFormato } from '../../proyectos/lib/exportar/pdf'
import type { Bloque, CeldaSpec, DocumentoFormato, Texto } from '../../proyectos/lib/exportar/modelo'
import type { FirmaSeguimiento, PersonaInforme, ProyectoSeguimiento } from '../api/tipos'
import { etiquetaEvidencia } from './archivos'
import { formatoFecha, formatoPesos } from './formato'
import { MARGEN_VERTICAL, bloqueRevisionAdministrador, numerarPaginas, obtenerLogo } from './pdfComun'
import { soportesRegistrados, totalAsignado } from './reglas'
import { CATEGORIAS_RESULTADOS } from './resultados'

/**
 * Informe técnico final en el formato oficial INV-IC-FR-019 (V1, 05/MAY/2023):
 * mismos numerales, tablas y bloque de firmas que el documento de la
 * Vicerrectoría, ya diligenciado.
 */

const ENCABEZADO: EncabezadoFormato = {
  titulo: 'INFORME TÉCNICO FINAL DE\nPROYECTO DE INVESTIGACIÓN',
  codigo: 'INV-IC-FR-019',
  version: '1',
  fecha: '05/MAY/2023',
}

const GRIS = 'D9D9D9'
const AZUL = 'D9E2F3'
const TAM = 9.5
const W_ETQ = 21.5

const celda = (w: number, texto: Texto = '', o: Partial<CeldaSpec> = {}): CeldaSpec => ({ w, texto, size: TAM, valign: 'middle', ...o })
const etiqueta = (w: number, texto: Texto, o: Partial<CeldaSpec> = {}) => celda(w, texto, { fondo: GRIS, ...o })
const titulo = (texto: string) => etiqueta(100, texto, { align: 'center', negrita: true, minH: 22 })
const cabecera = (w: number, texto: string) => celda(w, texto, { fondo: AZUL, align: 'center', negrita: true })
const tabla = (filas: CeldaSpec[][], espacioDespues = 14): Bloque => ({ tipo: 'tabla', tabla: { filas, espacioDespues } })

/** Las fechas de adquisición se guardan como yyyy-mm-dd; el resto del texto se deja tal cual. */
const valorCelda = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? formatoFecha(v) : v)

function filasPersona(rotulo: string, p: PersonaInforme): CeldaSpec[][] {
  return [
    [etiqueta(W_ETQ, rotulo), celda(100 - W_ETQ, p.nombre)],
    [etiqueta(W_ETQ, 'Grupo de investigación'), celda(33, p.grupo), etiqueta(17, 'Programa académico'), celda(28.5, p.programa)],
    [etiqueta(W_ETQ, 'Correo electrónico'), celda(33, p.correo), etiqueta(17, 'Teléfono'), celda(28.5, p.telefono)],
  ]
}

/** Tabla de adquisiciones (numerales 5 y 6): el formato trae dos renglones, se agregan los que hagan falta. */
function tablaAdquisiciones(tituloSeccion: string, instruccion: string, columnas: string[], filas: string[][]): Bloque {
  const anchos = [29, 14.5, 16, 17, 23.5]
  const renglones = [...filas, ...Array.from({ length: Math.max(0, 2 - filas.length) }, () => ['', '', '', '', ''])]
  return tabla([
    [titulo(tituloSeccion)],
    [celda(100, instruccion, { minH: 20 })],
    columnas.map((c, i) => cabecera(anchos[i], c)),
    ...renglones.map((f) => anchos.map((w, i) => celda(w, valorCelda(f[i] ?? ''), { minH: 18 }))),
  ])
}

function bloqueFirma(f: FirmaSeguimiento | undefined, nombre: string, cargo: string): CeldaSpec[] {
  const sinBorde = { bordes: false as const, valign: 'top' as const }
  const constancia: Texto = f?.firmado
    ? [{ t: `Firmado electrónicamente · ${formatoFecha(f.fecha)}`, i: true, color: '1E7A46' }]
    : [{ t: 'FIRMA', color: 'BFBFBF' }]
  return [
    celda(100, constancia, { bordes: { b: true }, valign: 'bottom', minH: 44 }),
    celda(100, nombre.toUpperCase(), { ...sinBorde, negrita: true }),
    celda(100, cargo, sinBorde),
  ]
}

export function construirDocumentoInformeFinal(p: ProyectoSeguimiento): DocumentoFormato {
  const f = p.informe_final
  const { info } = f
  const interna = totalAsignado(p)
  const apoyos = [...info.apoyos, ...Array.from({ length: Math.max(0, 2 - info.apoyos.length) }, () => null)]
  const [general, ...especificos] = f.objetivos
  const marca = (activa: boolean) => celda(4, activa ? 'X' : '', { align: 'center', negrita: true })

  const informacion = tabla([
    [titulo('1.    INFORMACIÓN GENERAL DEL PROYECTO')],
    [etiqueta(W_ETQ, 'Título del proyecto:', { minH: 28 }), celda(46, p.titulo), etiqueta(14, 'Convocatoria'), celda(18.5, p.convocatoria)],
    [etiqueta(W_ETQ, 'Centro de costos'), celda(12, p.centro_costos), etiqueta(22, 'Área de conocimiento a la que aplica:'), celda(44.5, info.area_conocimiento)],
    ...filasPersona('Nombre investigador principal', info.investigador_principal),
    ...filasPersona('Nombre co-investigador interno', info.co_investigador_interno),
    ...filasPersona('Nombre co-investigador externo', info.co_investigador_externo),
    ...apoyos.map((a) => [
      etiqueta(W_ETQ, 'Auxiliar o asistente de investigación'),
      celda(14, a?.nombre ?? ''),
      etiqueta(12, 'Código estudiantil'),
      celda(11, a?.codigo_estudiantil ?? ''),
      etiqueta(11.5, 'Correo electrónico'),
      celda(30, a?.correo ?? '', { size: 8.5 }),
    ]),
    [etiqueta(W_ETQ, 'Lugar de ejecución', { minH: 24 }), etiqueta(9.5, 'Ciudad'), celda(26, info.ciudad), etiqueta(15.5, 'Departamento'), celda(27.5, info.departamento)],
    [
      etiqueta(W_ETQ, 'Recursos'),
      celda(27, [{ t: 'Financiación interna\n', b: true }, { t: `Valor ${formatoPesos(interna)}` }]),
      celda(25, [{ t: 'Financiación externa\n', b: true }, { t: `Valor ${formatoPesos(info.financiacion_externa)}` }]),
      celda(26.5, [{ t: 'Valor total\n', b: true }, { t: formatoPesos(interna + info.financiacion_externa) }]),
    ],
  ])

  const objetivos = tabla([
    [titulo('3.    CUMPLIMIENTO DE OBJETIVOS')],
    [cabecera(45.5, 'Objetivo General (planteado)'), cabecera(54.5, 'Descripción cumplimiento')],
    [celda(45.5, general?.descripcion ?? '', { minH: 30, valign: 'top' }), celda(54.5, general?.cumplimiento ?? '', { valign: 'top' })],
    [cabecera(45.5, 'Objetivos específicos (planteados)'), cabecera(54.5, 'Descripción cumplimiento')],
    ...especificos.map((o) => [celda(45.5, o.descripcion, { minH: 30, valign: 'top' }), celda(54.5, o.cumplimiento, { valign: 'top' })]),
    [celda(100, [{ t: 'Observaciones: ', b: true }, { t: f.observaciones_objetivos }], { minH: 44, valign: 'top' })],
  ])

  const resultados: Bloque[] = CATEGORIAS_RESULTADOS.map((cat, i) =>
    tabla([
      ...(i === 0 ? [[titulo('4.    RESULTADOS')]] : []),
      [etiqueta(100, `${cat.codigo} ${cat.nombre}`, { negrita: true })],
      [cabecera(30, 'Concepto'), cabecera(14, 'Resultados proyectados'), cabecera(14, 'Resultados obtenidos'), cabecera(18.5, 'Soporte'), cabecera(23.5, 'Observaciones')],
      ...cat.conceptos.map((concepto) => {
        const x = p.productos.find((prod) => prod.nombre === concepto)
        return [
          celda(30, concepto, { minH: 26 }),
          celda(14, x ? String(x.proyectado) : '', { align: 'center' }),
          celda(14, x?.obtenido != null ? String(x.obtenido) : '', { align: 'center' }),
          celda(18.5, x ? soportesRegistrados(x).map(etiquetaEvidencia).join('\n') : '', { size: 8 }),
          celda(23.5, x?.observacion ?? '', { size: 8.5 }),
        ]
      }),
    ])
  )

  const participacion = tabla([
    [titulo('7.    Participación de auxiliares o asistentes de investigación')],
    ...apoyos.map((a) => [
      etiqueta(22.5, 'Nombres y Apellidos'),
      celda(48.5, a?.nombre ?? ''),
      etiqueta(10, 'Asistente'),
      marca(a?.tipo === 'Asistente'),
      etiqueta(11, 'Auxiliar'),
      marca(a?.tipo === 'Auxiliar'),
    ]),
    [etiqueta(100, 'Actividades desarrolladas', { align: 'center', negrita: true })],
    [celda(100, f.actividades_apoyos, { minH: 50, valign: 'top' })],
    [etiqueta(100, 'Evidencias', { align: 'center', negrita: true })],
    [celda(100, f.evidencias_apoyos, { minH: 60, valign: 'top' })],
  ], 22)

  const firmaDe = (rol: FirmaSeguimiento['rol']) => f.firmas.find((x) => x.rol === rol)
  const co = firmaDe('Co-investigadores')
  const firmantes = [
    bloqueFirma(firmaDe('Investigador principal'), info.investigador_principal.nombre || 'Nombre investigador(a) principal', 'Investigador(a) Principal'),
    bloqueFirma(co, info.co_investigador_interno.nombre || 'Nombre co-investigador(a)', 'Co-Investigador(a)'),
    // El segundo co-investigador solo firma si el proyecto tiene uno externo.
    bloqueFirma(info.co_investigador_externo.nombre ? co : undefined, info.co_investigador_externo.nombre || 'Nombre co-investigador(a)', 'Co-Investigador(a)'),
    bloqueFirma(firmaDe('Líder del grupo'), 'Líder grupo de investigación', `Líder Grupo de Investigación ${p.grupo}`),
  ]
  const hueco = celda(16, '', { bordes: false })
  const filaFirmas = (a: CeldaSpec[], b: CeldaSpec[]): Bloque =>
    tabla(a.map((c, i) => [{ ...c, w: 40 }, hueco, { ...b[i], w: 40 }, { ...hueco, w: 4 }]), 34)

  const bloques: Bloque[] = [
    informacion,
    tabla([[titulo('2.    RESUMEN DEL PROYECTO')], [celda(100, f.resumen, { minH: 90, valign: 'top' })]]),
    objetivos,
    ...resultados,
    tablaAdquisiciones(
      '5.    Equipos – Software - Licencias',
      'Relacionar los equipos adquiridos con los recursos presupuestales del proyecto de investigación.',
      ['Equipo / Software / Licencia', 'Fecha de adquisición', 'Estado', 'Código Inventario', 'Observaciones'],
      f.equipos
    ),
    tablaAdquisiciones(
      '6.    Material bibliográfico',
      'Relacionar el material bibliográfico adquirido con los recursos presupuestales del proyecto de investigación.',
      ['Nombre del material', 'Fecha de adquisición', 'ISBN / ISSN', 'Código Inventario', 'Observaciones'],
      f.materiales
    ),
    participacion,
    {
      tipo: 'parrafo',
      parrafo: {
        texto: [
          { t: 'Soportes: ', b: true },
          {
            t: 'Las evidencias del proyecto correspondientes a los productos de generación de nuevo conocimiento, apropiación social del conocimiento, formación del recurso humano y desarrollo tecnológico e innovación, deben reposar en el drive del correo del grupo de investigación.',
          },
        ],
        size: TAM,
        despues: 22,
      },
    },
    { tipo: 'parrafo', parrafo: { texto: `Fecha de entrega de Informe Técnico Final: ${f.fecha_entrega ? formatoFecha(f.fecha_entrega) : ''}`, size: TAM, despues: 40 } },
    filaFirmas(firmantes[0], firmantes[1]),
    filaFirmas(firmantes[2], firmantes[3]),
    bloqueRevisionAdministrador(f.estado === 'Aprobado', TAM),
  ]

  return { secciones: [{ orientacion: 'vertical', bloques }] }
}

export async function descargarPdfInformeFinal(p: ProyectoSeguimiento): Promise<void> {
  const doc = generarPdf(construirDocumentoInformeFinal(p), await obtenerLogo(), ENCABEZADO)
  numerarPaginas(doc, MARGEN_VERTICAL)
  doc.save(`informe-tecnico-final-${p.id_proyecto}.pdf`)
}
