import * as E from '../etiquetasFormato'
import {
  extraerTablas,
  buscarCeldaConEtiqueta,
  buscarTodasLasCeldasConEtiqueta,
  valorTrasEtiqueta,
  valorEnMismaCeldaOTrasEtiqueta,
  valorEnFilaSiguiente,
  indiceTablaConEtiqueta,
  contenidoDeCaja,
  dividirNombreCompleto,
} from './recorrerDocumento'
import type {
  ExtraccionProyectoDocx,
  ParticipanteTexto,
  EstudianteTexto,
  EgresadoTexto,
  GrupoTexto,
  ImpactoTexto,
  ActividadCronogramaTexto,
  ProductoTexto,
  HojaVidaTexto,
} from './tipos'

function filasDeSubseccion(tabla: string[][], etiquetaInicio: string, etiquetaFin?: string): string[][] {
  const iInicio = tabla.findIndex((fila) => fila.some((c) => c.trim().startsWith(etiquetaInicio)))
  if (iInicio === -1) return []
  let iFin = tabla.length
  if (etiquetaFin) {
    const rel = tabla.slice(iInicio + 1).findIndex((fila) => fila.some((c) => c.trim().startsWith(etiquetaFin)))
    if (rel !== -1) iFin = iInicio + 1 + rel
  }
  return tabla.slice(iInicio + 1, iFin)
}

/** Texto de las etiquetas que tienen una "X" marcada al lado, dentro de una subsección de una tabla. */
function textoMarcadoConX(tabla: string[][], etiquetaInicio: string, etiquetaFin?: string): string[] {
  const filas = filasDeSubseccion(tabla, etiquetaInicio, etiquetaFin)
  const resultado: string[] = []
  for (const fila of filas) {
    for (let i = 1; i < fila.length; i++) {
      if (/^x$/i.test(fila[i].trim())) {
        const etiqueta = fila[i - 1].trim().replace(/[:\s]+$/, '')
        if (etiqueta) resultado.push(etiqueta)
      }
    }
  }
  return resultado
}

/**
 * "3. RESUMEN": a diferencia de las cajas de 4.1 en adelante, el título va en
 * una fila (celda centrada ancha) y el contenido en la fila siguiente, en la
 * misma columna — no en la misma celda separado por un salto de línea.
 */
function valorEnFilaSiguienteTrasPrefijo(tablas: string[][][], prefijo: string): string {
  const encontrada = buscarCeldaConEtiqueta(tablas, prefijo)
  if (!encontrada) return ''
  const filaValor = tablas[encontrada.tabla][encontrada.fila + 1]
  return (filaValor?.[encontrada.indiceCelda] ?? '').trim()
}

function indicesTablasConEtiqueta(tablas: string[][][], etiqueta: string): number[] {
  const vistos = new Set<number>()
  const resultado: number[] = []
  for (const c of buscarTodasLasCeldasConEtiqueta(tablas, etiqueta)) {
    if (!vistos.has(c.tabla)) {
      vistos.add(c.tabla)
      resultado.push(c.tabla)
    }
  }
  return resultado
}

function extraerParticipantesPorRol(tabla1: string[][], etiquetaRol: string): ParticipanteTexto[] {
  const resultado: ParticipanteTexto[] = []
  for (let i = 0; i < tabla1.length; i++) {
    const fila = tabla1[i]
    const iCelda = fila.findIndex((c) => c.trim().startsWith(etiquetaRol))
    if (iCelda === -1) continue
    const nombreCompleto = (fila[iCelda + 1] ?? '').trim()
    if (!nombreCompleto) continue
    const { nombres, apellidos } = dividirNombreCompleto(nombreCompleto)
    const filaOrcid = tabla1[i + 1] ?? []
    const iOrcid = filaOrcid.findIndex((c) => c.trim() === E.ETQ_ORCID)
    const iGoogle = filaOrcid.findIndex((c) => c.trim() === E.ETQ_GOOGLE_ACADEMICO)
    resultado.push({
      nombres,
      apellidos,
      correo: '',
      orcid: iOrcid !== -1 ? (filaOrcid[iOrcid + 1] ?? '').trim() : '',
      googleAcademico: iGoogle !== -1 ? (filaOrcid[iGoogle + 1] ?? '').trim() : '',
    })
  }
  return resultado
}

function extraerEgresadosSeccion1(tabla1: string[][]): EgresadoTexto[] {
  const resultado: EgresadoTexto[] = []
  for (const fila of tabla1) {
    const iCelda = fila.findIndex((c) => c.trim().startsWith(E.ROL_EGRESADO))
    if (iCelda === -1) continue
    const nombreCompleto = (fila[iCelda + 1] ?? '').trim()
    if (!nombreCompleto) continue
    const { nombres, apellidos } = dividirNombreCompleto(nombreCompleto)
    const celdaCedula = fila.find((c) => c.trim().startsWith(E.ETQ_CEDULA))
    const cedula = celdaCedula ? celdaCedula.slice(celdaCedula.indexOf(':') + 1).trim() : ''
    resultado.push({ nombres, apellidos, cedula, facultad: '', programa: '', empresa: '', horasSemanales: '' })
  }
  return resultado
}

/** Datos complementarios de egresados (facultad, programa, empresa, dedicación), que viven en tablas aparte. */
function extraerInfoEgresados(tablas: string[][][]): { facultad: string; programa: string; empresa: string; horasSemanales: string }[] {
  const indices = indicesTablasConEtiqueta(tablas, E.TITULO_EGRESADOS)
  return indices.map((idx) => {
    const t = tablas[idx]
    const facultad = valorTrasEtiqueta([t], E.ETQ_FACULTAD)
    const programa = valorTrasEtiqueta([t], E.ETQ_PROGRAMA_ACADEMICO_EGRESADO)
    const empresa = valorTrasEtiqueta([t], E.ETQ_EMPRESA_ENTIDAD)
    const iEncabezado = t.findIndex((fila) => fila.some((c) => c.trim() === E.ETQ_COINV_EGRESADO))
    const filaValor = iEncabezado !== -1 ? t[iEncabezado + 1] : undefined
    const horasSemanales = (filaValor?.[1] ?? '').trim()
    return { facultad, programa, empresa, horasSemanales }
  })
}

function extraerEstudiantes(tabla1: string[][]): EstudianteTexto[] {
  const resultado: EstudianteTexto[] = []
  for (let i = 0; i < tabla1.length; i++) {
    const fila = tabla1[i]
    const iCelda = fila.findIndex((c) => c.trim().startsWith(E.ROL_ESTUDIANTE))
    if (iCelda === -1) continue
    const nombreCompleto = (fila[iCelda + 1] ?? '').trim()
    if (!nombreCompleto) continue
    const { nombres, apellidos } = dividirNombreCompleto(nombreCompleto)
    const iCod = fila.findIndex((c) => c.trim() === E.ETQ_CODIGO_ESTUDIANTIL)
    const iAux = fila.findIndex((c) => c.trim() === 'Auxiliar')
    const iAsist = fila.findIndex((c) => c.trim() === 'Asistente')
    const filaValores = tabla1[i + 1] ?? []
    const codigo = iCod !== -1 ? (filaValores[iCod] ?? '').trim() : ''
    const marcaAux = iAux !== -1 ? (filaValores[iAux] ?? '').trim() : ''
    const marcaAsist = iAsist !== -1 ? (filaValores[iAsist] ?? '').trim() : ''
    const rol: EstudianteTexto['rol'] = /^x$/i.test(marcaAux) ? 'auxiliar' : /^x$/i.test(marcaAsist) ? 'asistente' : ''
    resultado.push({ nombres, apellidos, correo: '', codigo, rol })
  }
  return resultado
}

/** Como indiceTablaConEtiqueta, pero por "contiene" en vez de "empieza por" — el primer grupo interno trae el prefijo "2. " delante del título, que no es parte de la etiqueta. */
function indiceTablaQueContiene(tablas: string[][][], texto: string): number {
  for (let t = 0; t < tablas.length; t++) {
    for (const fila of tablas[t]) {
      if (fila.some((c) => c.includes(texto))) return t
    }
  }
  return -1
}

function extraerGrupo(tablas: string[][][], tituloSeccion: string, externo: boolean): GrupoTexto | null {
  const idx = indiceTablaQueContiene(tablas, tituloSeccion)
  if (idx === -1) return null
  const t = tablas[idx]
  const nombre = valorTrasEtiqueta([t], E.ETQ_NOMBRE_GRUPO)
  if (!nombre) return null
  const facultadOProgramaTexto = valorTrasEtiqueta([t], externo ? E.ETQ_UNIVERSIDAD_ENTIDAD : E.ETQ_FACULTAD_DEPARTAMENTO)
  const programaTexto = valorTrasEtiqueta([t], externo ? E.ETQ_PROGRAMA_DEPENDENCIA : E.ETQ_PROGRAMA_ACADEMICO)
  const lider = valorTrasEtiqueta([t], externo ? E.ETQ_DIRECTOR_GRUPO : E.ETQ_LIDER_GRUPO)
  // "Código GrupLac:" encabeza su columna; el valor va en la fila de abajo (igual que Reconocido por MINCIENCIAS).
  const codGruplac = valorEnFilaSiguiente([t], E.ETQ_COD_GRUPLAC)
  // La fila SI/NO de "Reconocido por MINCIENCIAS" va justo después de la fila de encabezados de esa subtabla.
  const iEncabezado = t.findIndex((fila) => fila.some((c) => c.trim() === E.ETQ_RECONOCIDO_MINCIENCIAS))
  const filaSiNo = iEncabezado !== -1 ? t[iEncabezado + 1] : undefined
  const iSi = filaSiNo?.findIndex((c) => c.trim() === 'SI') ?? -1
  const reconocidoMinciencias = iSi !== -1 && /^x$/i.test((filaSiNo?.[iSi + 1] ?? '').trim())
  const categoria = valorEnFilaSiguiente([t], E.ETQ_CATEGORIA)
  const acuerdoInstitucional = valorEnFilaSiguiente([t], E.ETQ_ACUERDO_INSTITUCIONAL)
  const lineaOTexto = valorTrasEtiqueta([t], externo ? E.ETQ_LINEA_EXTERNA : E.ETQ_LINEA_INTERNA)
  const odsOLineaMedularTexto = valorTrasEtiqueta([t], externo ? E.ETQ_LINEA_MEDULAR : E.ETQ_ODS_PROYECTO)
  return {
    nombre,
    facultadOProgramaTexto,
    programaTexto,
    lider,
    codGruplac,
    reconocidoMinciencias,
    categoria,
    acuerdoInstitucional,
    lineaOTexto,
    odsOLineaMedularTexto,
  }
}

/** "Objetivo general: X\n\nObjetivos específicos:\n1. A\n2. B" (o texto libre sin esa estructura). */
function separarObjetivos(textoCaja: string, advertencias: string[]): { general: string; especificos: string[] } {
  if (!textoCaja) return { general: '', especificos: [] }
  const matchGeneral = /objetivo\s+general\s*:?\s*([\s\S]*?)(?:\n\s*objetivos?\s+espec[ií]ficos?\s*:?|$)/i.exec(textoCaja)
  const matchEspecificos = /objetivos?\s+espec[ií]ficos?\s*:?\s*([\s\S]*)/i.exec(textoCaja)
  if (matchGeneral && matchEspecificos) {
    const especificos = matchEspecificos[1]
      .split('\n')
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean)
    return { general: matchGeneral[1].trim(), especificos }
  }
  advertencias.push('No se pudo separar "Objetivo general" de "Objetivos específicos" en 4.3 — quedó todo como objetivo general, revísalo.')
  return { general: textoCaja.trim(), especificos: [] }
}

function separarLista(textoCaja: string): string[] {
  if (!textoCaja) return []
  return textoCaja
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean)
}

function extraerImpactos(tablas: string[][][]): ImpactoTexto[] {
  const encontrada = buscarTodasLasCeldasConEtiqueta(tablas, E.ETQ_IMPACTO_ESPERADO)[0]
  if (!encontrada) return []
  const t = tablas[encontrada.tabla]
  const iEncabezado = encontrada.fila
  const resultado: ImpactoTexto[] = []
  for (let f = iEncabezado + 1; f < t.length; f++) {
    const [impactoEsperado, beneficiarioPotencial, indicadorVerificable] = t[f]
    if (!impactoEsperado?.trim()) continue
    resultado.push({
      impactoEsperado: impactoEsperado.trim(),
      beneficiarioPotencial: (beneficiarioPotencial ?? '').trim(),
      indicadorVerificable: (indicadorVerificable ?? '').trim(),
    })
  }
  return resultado
}

function extraerCronograma(tablas: string[][][]): ActividadCronogramaTexto[] {
  const resultado: ActividadCronogramaTexto[] = []
  for (const tabla of tablas) {
    const iEncabezado = tabla.findIndex((fila) => fila.some((c) => /periodo\s*\d+/i.test(c)))
    if (iEncabezado === -1) continue
    const celdaPeriodo = tabla[iEncabezado].find((c) => /periodo\s*\d+/i.test(c)) ?? ''
    const matchPeriodo = /periodo\s*(\d+)/i.exec(celdaPeriodo)
    const matchAnio = /(\d{4})/.exec(celdaPeriodo)
    const periodo = matchPeriodo ? `Periodo ${matchPeriodo[1]}` : 'Periodo 1'
    const anio = matchAnio ? matchAnio[1] : String(new Date().getFullYear())
    // La fila siguiente al encabezado suele ser la numeración de meses (1 a 12); las de actividades vienen después.
    for (let f = iEncabezado + 1; f < tabla.length; f++) {
      const fila = tabla[f]
      const esFilaDeMeses = fila.every((c) => c.trim() === '' || /^\d{1,2}$/.test(c.trim()))
      if (esFilaDeMeses) continue
      const [actividad, resultadoTxt, responsable, ...resto] = fila
      if (!actividad?.trim()) continue
      const meses: number[] = []
      resto.forEach((c, i) => {
        if (/^x$/i.test(c.trim())) meses.push(i + 1)
      })
      resultado.push({
        actividad: actividad.trim(),
        resultado: (resultadoTxt ?? '').trim(),
        responsable: (responsable ?? '').trim(),
        periodo,
        anio,
        meses,
      })
    }
  }
  return resultado
}

function extraerProductos(tablas: string[][][]): ProductoTexto[] {
  const idxInicio = indiceTablaConEtiqueta(tablas, E.TITULO_RESULTADOS_ESPERADOS)
  const idxFin = indiceTablaConEtiqueta(tablas, E.TITULO_COMPONENTE_ETICO)
  if (idxInicio === -1) return []
  const rango = tablas.slice(idxInicio, idxFin !== -1 ? idxFin : undefined)
  const resultado: ProductoTexto[] = []
  for (const tabla of rango) {
    for (const fila of tabla) {
      for (let i = 1; i < fila.length; i++) {
        const texto = fila[i].trim()
        if (!/^\d+$/.test(texto)) continue
        const cantidad = Number(texto)
        if (cantidad <= 0) continue
        // El nombre del producto es la celda no vacía más cercana antes de la cantidad.
        let nombre = ''
        for (let j = i - 1; j >= 0; j--) {
          if (fila[j].trim()) {
            nombre = fila[j].trim()
            break
          }
        }
        if (nombre) resultado.push({ nombre, cantidad })
      }
    }
  }
  return resultado
}

function extraerHojasVida(tablas: string[][][]): HojaVidaTexto[] {
  const indices = indicesTablasConEtiqueta(tablas, E.TITULO_HOJA_VIDA)
  return indices.map((idx) => {
    const t = [tablas[idx]]
    // Nombres/Apellidos/Teléfono/Celular: etiqueta y valor en la misma fila.
    const nombres = valorTrasEtiqueta(t, E.ETQ_NOMBRES)
    const apellidos = valorTrasEtiqueta(t, E.ETQ_APELLIDOS)
    const telefono = valorTrasEtiqueta(t, E.ETQ_TELEFONO)
    const celular = valorTrasEtiqueta(t, E.ETQ_CELULAR)
    // El resto son encabezados de columna, con el valor en la fila de abajo.
    const lugarFecha = valorEnFilaSiguiente(t, E.ETQ_LUGAR_FECHA_NACIMIENTO)
    const nacionalidad = valorEnFilaSiguiente(t, E.ETQ_NACIONALIDAD)
    const tipoDocumento = valorEnFilaSiguiente(t, E.ETQ_TIPO_DOCUMENTO)
    const numeroDocumento = valorEnFilaSiguiente(t, E.ETQ_NUMERO_DOCUMENTO)
    const direccion = valorEnFilaSiguiente(t, E.ETQ_DIRECCION_RESIDENCIA)
    const correo = valorEnFilaSiguiente(t, E.ETQ_CORREO_ELECTRONICO)
    const cargoActual = contenidoDeCaja(t, E.ETQ_CARGO_ACTUAL)
    const cargosDesempenados = contenidoDeCaja(t, E.ETQ_CARGOS_DESEMPENADOS)
    const titulosAcademicos = contenidoDeCaja(t, E.ETQ_TITULOS_ACADEMICOS)
    const produccionCientifica = contenidoDeCaja(t, E.ETQ_PRODUCCION_CIENTIFICA)
    return {
      nombres,
      apellidos,
      lugarNacimiento: lugarFecha.split('—')[0]?.trim() ?? '',
      fechaNacimiento: '',
      nacionalidad,
      tipoDocumento,
      numeroDocumento,
      direccion,
      correo,
      telefono,
      celular,
      cargoActual,
      cargosDesempenados,
      titulosAcademicos,
      produccionCientifica,
    }
  })
}

export function extraerProyectoDeDocx(doc: Document): { extraccion: ExtraccionProyectoDocx | null; advertencias: string[]; error?: string } {
  const advertencias: string[] = []
  const tablas = extraerTablas(doc)

  const hayAlgunAnclaje = E.ANCLAJES_MINIMOS.some((et) => indiceTablaConEtiqueta(tablas, et) !== -1)
  if (!hayAlgunAnclaje) {
    return { extraccion: null, advertencias, error: 'Este documento no tiene la estructura del formato INV-IC-FR-001. Verifica que sea el archivo correcto.' }
  }

  const idxTabla1 = indiceTablaConEtiqueta(tablas, E.TITULO_SECCION_1)
  const tabla1 = idxTabla1 !== -1 ? tablas[idxTabla1] : []
  if (idxTabla1 === -1) advertencias.push('No se encontró la sección "1. Información general del proyecto".')

  const titulo = valorEnMismaCeldaOTrasEtiqueta([tabla1], E.ETQ_TITULO_PROYECTO)
  if (!titulo) advertencias.push('No se encontró el título del proyecto.')

  const principal = extraerParticipantesPorRol(tabla1, E.ROL_PRINCIPAL)[0] ?? {
    nombres: '',
    apellidos: '',
    correo: '',
    orcid: '',
    googleAcademico: '',
  }
  const coinvestigador = extraerParticipantesPorRol(tabla1, E.ROL_COINV_UNICESMAG)[0] ?? null
  const externos = extraerParticipantesPorRol(tabla1, E.ROL_EXTERNO).slice(0, 2)
  const estudiantes = extraerEstudiantes(tabla1)

  const egresadosBase = extraerEgresadosSeccion1(tabla1)
  const infoEgresados = extraerInfoEgresados(tablas)
  const egresados: EgresadoTexto[] = egresadosBase.map((eg, i) => ({ ...eg, ...(infoEgresados[i] ?? {}) })).slice(0, 2)

  const modalidadTexto = textoMarcadoConX(tabla1, E.ETQ_MODALIDAD, E.ETQ_AREA_CONOCIMIENTO)[0] ?? ''
  const areaTexto = textoMarcadoConX(tabla1, E.ETQ_AREA_CONOCIMIENTO, E.ETQ_PROGRAMAS)[0] ?? ''
  const tipoProyectoTexto = textoMarcadoConX(tabla1, E.ETQ_TIPO_PROYECTO, E.ETQ_FINANCIACION)[0] ?? ''
  if (!modalidadTexto) advertencias.push('No se encontró la modalidad del proyecto marcada con X.')
  if (!areaTexto) advertencias.push('No se encontró el área de conocimiento marcada con X.')
  if (!tipoProyectoTexto) advertencias.push('No se encontró el tipo de proyecto marcado con X.')

  const iProgramas = tabla1.findIndex((fila) => fila.some((c) => c.trim().startsWith(E.ETQ_PROGRAMAS)))
  const programasTexto: string[] = []
  if (iProgramas !== -1) {
    const iCeldaProg = tabla1[iProgramas].findIndex((c) => c.trim().startsWith(E.ETQ_PROGRAMAS))
    for (let f = iProgramas; f < tabla1.length; f++) {
      const valor = (tabla1[f][iCeldaProg + 1] ?? '').trim()
      if (!valor) {
        if (f > iProgramas) break
        continue
      }
      programasTexto.push(valor)
      if (tabla1[f].some((c) => c.trim().startsWith(E.ETQ_LUGAR_EJECUCION))) break
    }
  }

  const ciudad = valorEnMismaCeldaOTrasEtiqueta([tabla1], E.ETQ_CIUDAD)
  const departamento = valorEnMismaCeldaOTrasEtiqueta([tabla1], E.ETQ_DEPARTAMENTO)
  const duracionTexto = valorEnMismaCeldaOTrasEtiqueta([tabla1], E.ETQ_DURACION)
  const valorSolicitadoTexto = valorTrasEtiqueta([tabla1], E.ETQ_VALOR_SOLICITADO)
  const valorContrapartidaTexto = valorTrasEtiqueta([tabla1], E.ETQ_VALOR_CONTRAPARTIDA)

  const grupoCesmag = extraerGrupo(tablas, E.TITULO_SECCION_2, false)
  const grupoExterno = extraerGrupo(tablas, E.TITULO_SECCION_2_EXTERNO, true)

  const resumen = valorEnFilaSiguienteTrasPrefijo(tablas, E.TITULO_RESUMEN)
  const planteamiento = contenidoDeCaja(tablas, E.TITULO_PLANTEAMIENTO)
  const pregunta = contenidoDeCaja(tablas, E.TITULO_PREGUNTA)
  const justificacion = contenidoDeCaja(tablas, E.TITULO_JUSTIFICACION)
  const antecedentesTexto = separarLista(contenidoDeCaja(tablas, E.TITULO_ANTECEDENTES))
  const marcoTeorico = contenidoDeCaja(tablas, E.TITULO_MARCO_TEORICO)
  const metodologia = contenidoDeCaja(tablas, E.TITULO_METODOLOGIA)
  const referenciasTexto = separarLista(contenidoDeCaja(tablas, E.TITULO_REFERENCIAS))
  const { general: objetivoGeneralTexto, especificos: objetivosEspecificosTexto } = separarObjetivos(
    contenidoDeCaja(tablas, E.TITULO_OBJETIVOS),
    advertencias
  )
  const impactos = extraerImpactos(tablas)
  const cronograma = extraerCronograma(tablas)
  const productos = extraerProductos(tablas)

  const componenteEtico = contenidoDeCaja(tablas, E.TITULO_COMPONENTE_ETICO)
  const implicacionesEticas = contenidoDeCaja(tablas, E.TITULO_IMPLICACIONES_ETICAS)
  const fuentesFinanciacion = contenidoDeCaja(tablas, E.TITULO_FUENTES_FINANCIACION)
  const permisosLicencias = contenidoDeCaja(tablas, E.TITULO_PERMISOS_LICENCIAS)
  const funcionesEstudiante = contenidoDeCaja(tablas, E.TITULO_FUNCIONES_ESTUDIANTE)

  const hojasVida = extraerHojasVida(tablas)
  if (hojasVida.length === 0) advertencias.push('No se encontraron hojas de vida en el Anexo 1.')

  const extraccion: ExtraccionProyectoDocx = {
    titulo,
    principal,
    coinvestigador,
    externos,
    egresados,
    estudiantes,
    modalidadTexto,
    areaTexto,
    programasTexto,
    ciudad,
    departamento,
    duracionTexto,
    tipoProyectoTexto,
    valorSolicitadoTexto,
    valorContrapartidaTexto,
    grupoCesmag,
    grupoExterno,
    resumen,
    planteamiento,
    pregunta,
    justificacion,
    objetivoGeneralTexto,
    objetivosEspecificosTexto,
    antecedentesTexto,
    marcoTeorico,
    metodologia,
    impactos,
    referenciasTexto,
    cronograma,
    productos,
    componenteEtico,
    implicacionesEticas,
    fuentesFinanciacion,
    permisosLicencias,
    funcionesEstudiante,
    hojasVida,
  }

  return { extraccion, advertencias }
}
