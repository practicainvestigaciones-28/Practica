import { emparejarContraCatalogo } from '../../../../shared/lib/emparejarTexto'
import { DEPARTAMENTOS_COLOMBIA, MUNICIPIOS_POR_DEPARTAMENTO } from '../ubicaciones'
import { enumerarAntecedentes, separarAntecedentes } from '../antecedentes'
import type {
  ModalidadProyectoItem,
  AreaConocimientoItem,
  TipoProyectoItem,
  ProgramaItem,
  CatalogoItem,
} from '../../../catalogos/api/catalogos'
import type { GrupoInvestigacionItem } from '../../api/grupos'
import type { CategoriaProductoLocal } from '../productosInvestigacion'
import type { ExtraccionProyectoDocx, ParticipanteTexto, GrupoTexto } from './tipos'

export interface CatalogosParaImportar {
  modalidades: ModalidadProyectoItem[]
  areas: AreaConocimientoItem[]
  tiposProyecto: TipoProyectoItem[]
  programas: ProgramaItem[]
  categoriasProducto: CategoriaProductoLocal[]
  gruposInternos: GrupoInvestigacionItem[]
  lineasInvestigacion: CatalogoItem[]
  ods: CatalogoItem[]
  rolesEstudiante: CatalogoItem[]
}

// ---------- Tipos del borrador: mismo nombre de campo que CrearProyecto.tsx ----------
// (No se importan desde ahí porque no están exportados; el borrador viaja
// como JSON por localStorage, así que basta con que la forma coincida.)

interface ParticipanteManualBorrador {
  nombres: string
  apellidos: string
  correo: string
  idDedicacion: number | null
  orcid: string
  googleAcademico: string
}

interface BorradorCompleto {
  datosGeneral: {
    titulo: string
    idModalidad: number | null
    idArea: number | null
    idProgramas: number[]
    pais: string
    otroPais: string
    ciudad: string
    departamento: string
    idTipoProyecto: number | null
    valorSolicitado: string
    valorContrapartida: string
    duracion: string
  }
  participantesPorGrupo: {
    id: number
    principal: ParticipanteManualBorrador
    coInvestigador: ParticipanteManualBorrador
    externo1: ParticipanteManualBorrador
    externo2: ParticipanteManualBorrador
    egresado1: ParticipanteManualBorrador
    egresado2: ParticipanteManualBorrador
    cedulaEgresado1: string
    cedulaEgresado2: string
  }[]
  estudiantesInvestigadores: { nombres: string; apellidos: string; correo: string; idRolEstudiante: number | null; codigo: string }[]
  gruposCesmagSel: GrupoSeleccionadoBorrador[]
  gruposExternosSel: GrupoSeleccionadoBorrador[]
  egresadosInfo: { id: number; nombres: string; apellidos: string; correo: string; idFacultad: number | null; idPrograma: number | null; empresa: string; horasSemanales: string }[]
  hojasVida: {
    id: number
    nombres: string
    apellidos: string
    correo: string
    lugarNacimiento: string
    fechaNacimiento: string
    nacionalidad: string
    tipoDocumento: string
    numeroDocumento: string
    direccion: string
    telefono: string
    celular: string
    orcid: string
    googleAcademico: string
    categoriaMinciencias: string
    cargoActual: string
    cargosDesempenados: string
    titulosAcademicos: string
    produccionCientifica: string
  }[]
  objetivosEspecificos: { id: number; texto: string }[]
  datosTexto: {
    resumen: string
    planteamiento: string
    pregunta: string
    justificacion: string
    objetivoGeneral: string
    antecedentes: string
    marcoTeorico: string
    metodologia: string
    componenteEtico: string
    implicacionesEticas: string
    fuentesFinanciacion: string
    permisosLicencias: string
    funcionesEstudiante: string
    referencias: string
  }
  impactos: Record<number, { impactoEsperado: string; beneficiarioPotencial: string; indicadorVerificable: string }>
  cronogramas: { id: number; actividades: { id: number; actividad: string; resultado: string; responsable: string; anio: string; meses: boolean[] }[] }[]
  cantidadesProducto: Record<number, string>
  idResponsableAsignado: number
  // Todas las pestañas quedan disponibles para revisar de una vez: el
  // bloqueo secuencial tiene sentido cuando la persona diligencia desde
  // cero, no cuando ya hay datos precargados que solo hay que revisar.
  tabsDesbloqueadas: string[]
}

interface GrupoSeleccionadoBorrador {
  id: number
  nombre: string
  idGrupoExistente: number | null
  facultad: string
  idFacultad: number | null
  programa: string
  idPrograma: number | null
  lider: string
  codGruplac: string
  reconocidoMinciencias: boolean
  categoria: string
  acuerdoInstitucional: string
  idsLinea: number[]
  lineasExternas: string[]
  lineasMedulares: string[]
  idsOds: number[]
  investigadoresExtra: { usuario: null; horasSemanales: string; orcid: string; googleAcademico: string }[]
}

function participanteVacio(): ParticipanteManualBorrador {
  return { nombres: '', apellidos: '', correo: '', idDedicacion: null, orcid: '', googleAcademico: '' }
}

function participanteDesdeTexto(p: ParticipanteTexto | null | undefined): ParticipanteManualBorrador {
  if (!p) return participanteVacio()
  return { nombres: p.nombres, apellidos: p.apellidos, correo: p.correo, idDedicacion: null, orcid: p.orcid, googleAcademico: p.googleAcademico }
}

/**
 * Si el Word trae los antecedentes enumerados en el texto, se separan por esa
 * numeración (un antecedente de varios párrafos queda en uno solo). Si la
 * numeración es automática de Word (no llega como texto), cada párrafo es uno.
 */
function antecedentesImportados(parrafos: string[]): string[] {
  const unido = parrafos.join('\n')
  const separados = separarAntecedentes(unido)
  return separados.length > 1 ? separados : parrafos.map((p) => p.trim()).filter(Boolean)
}

function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '')
}

function grupoVacio(id: number): GrupoSeleccionadoBorrador {
  return {
    id,
    nombre: '',
    idGrupoExistente: null,
    facultad: '',
    idFacultad: null,
    programa: '',
    idPrograma: null,
    lider: '',
    codGruplac: '',
    reconocidoMinciencias: false,
    categoria: '',
    acuerdoInstitucional: '',
    idsLinea: [],
    lineasExternas: [''],
    lineasMedulares: [''],
    idsOds: [],
    investigadoresExtra: [{ usuario: null, horasSemanales: '', orcid: '', googleAcademico: '' }],
  }
}

function emparejarVariosContraCatalogo(textoConComas: string, catalogo: CatalogoItem[], obtenerId: (c: CatalogoItem) => number | undefined): number[] {
  const resultado: number[] = []
  for (const parte of textoConComas.split(',')) {
    const r = emparejarContraCatalogo(parte.trim(), catalogo, (c) => c.nombre)
    if (r.tipo !== 'no_encontrado') {
      const id = obtenerId(r.item)
      if (typeof id === 'number') resultado.push(id)
    }
  }
  return resultado
}

function construirGrupoInterno(
  grupoTexto: GrupoTexto | null,
  catalogos: CatalogosParaImportar,
  advertencias: string[]
): GrupoSeleccionadoBorrador {
  const base = grupoVacio(1)
  if (!grupoTexto) return base

  const r = emparejarContraCatalogo(grupoTexto.nombre, catalogos.gruposInternos, (g) => g.nombre)
  if (r.tipo === 'no_encontrado') {
    advertencias.push(`El grupo "${grupoTexto.nombre}" no coincide con ningún grupo de investigación interno — selecciónalo manualmente.`)
    return base
  }
  const g = r.item
  return {
    ...base,
    idGrupoExistente: g.id_grupo,
    nombre: g.nombre,
    idFacultad: g.id_facultad,
    idPrograma: g.id_programa,
    lider: g.lider_grupo ?? '',
    codGruplac: g.cod_gruplac ?? '',
    reconocidoMinciencias: g.reconocido_minciencias,
    categoria: g.categoria ?? '',
    acuerdoInstitucional: g.acuerdo_institucional ?? '',
    idsLinea: emparejarVariosContraCatalogo(grupoTexto.lineaOTexto, catalogos.lineasInvestigacion, (c) => c.id_linea),
    idsOds: emparejarVariosContraCatalogo(grupoTexto.odsOLineaMedularTexto, catalogos.ods, (c) => c.id_ods),
  }
}

function construirGrupoExterno(grupoTexto: GrupoTexto | null): GrupoSeleccionadoBorrador {
  const base = grupoVacio(1)
  if (!grupoTexto) return base
  return {
    ...base,
    nombre: grupoTexto.nombre,
    facultad: grupoTexto.facultadOProgramaTexto,
    programa: grupoTexto.programaTexto,
    lider: grupoTexto.lider,
    codGruplac: grupoTexto.codGruplac,
    reconocidoMinciencias: grupoTexto.reconocidoMinciencias,
    categoria: grupoTexto.categoria,
    acuerdoInstitucional: grupoTexto.acuerdoInstitucional,
    lineasExternas: [grupoTexto.lineaOTexto || ''],
    lineasMedulares: [grupoTexto.odsOLineaMedularTexto || ''],
  }
}

export function construirBorradorDesdeExtraccion(
  extraccion: ExtraccionProyectoDocx,
  catalogos: CatalogosParaImportar,
  idResponsableAsignado: number
): { borrador: BorradorCompleto; advertencias: string[] } {
  const advertencias: string[] = []

  const modalidad = emparejarContraCatalogo(extraccion.modalidadTexto, catalogos.modalidades, (m) => m.nombre)
  if (modalidad.tipo === 'no_encontrado' && extraccion.modalidadTexto) {
    advertencias.push(`La modalidad "${extraccion.modalidadTexto}" no coincide con el catálogo — selecciónala manualmente.`)
  }
  const area = emparejarContraCatalogo(extraccion.areaTexto, catalogos.areas, (a) => a.nombre)
  if (area.tipo === 'no_encontrado' && extraccion.areaTexto) {
    advertencias.push(`El área "${extraccion.areaTexto}" no coincide con el catálogo — selecciónala manualmente.`)
  }
  const tipoProyecto = emparejarContraCatalogo(extraccion.tipoProyectoTexto, catalogos.tiposProyecto, (t) => t.nombre)
  if (tipoProyecto.tipo === 'no_encontrado' && extraccion.tipoProyectoTexto) {
    advertencias.push(`El tipo de proyecto "${extraccion.tipoProyectoTexto}" no coincide con el catálogo — selecciónalo manualmente.`)
  }

  const idProgramas: number[] = []
  for (const texto of extraccion.programasTexto) {
    const r = emparejarContraCatalogo(texto, catalogos.programas, (p) => p.nombre)
    if (r.tipo === 'no_encontrado') {
      advertencias.push(`El programa "${texto}" no coincide con el catálogo — agrégalo manualmente.`)
    } else {
      idProgramas.push(r.item.id_programa)
    }
  }

  const departamentoMatch = emparejarContraCatalogo(extraccion.departamento, DEPARTAMENTOS_COLOMBIA, (d) => d)
  const departamento = departamentoMatch.tipo !== 'no_encontrado' ? departamentoMatch.item : ''
  if (!departamento && extraccion.departamento) advertencias.push(`El departamento "${extraccion.departamento}" no coincide con el catálogo — selecciónalo manualmente.`)
  const municipios = departamento ? (MUNICIPIOS_POR_DEPARTAMENTO[departamento] ?? []) : []
  const ciudadMatch = emparejarContraCatalogo(extraccion.ciudad, municipios, (c) => c)
  const ciudad = ciudadMatch.tipo !== 'no_encontrado' ? ciudadMatch.item : ''
  if (!ciudad && extraccion.ciudad) advertencias.push(`La ciudad "${extraccion.ciudad}" no coincide con el catálogo — selecciónala manualmente.`)

  const datosGeneral = {
    titulo: extraccion.titulo,
    idModalidad: modalidad.tipo !== 'no_encontrado' ? modalidad.item.id_modalidad : null,
    idArea: area.tipo !== 'no_encontrado' ? area.item.id_area_conocimiento : null,
    idProgramas,
    pais: 'Colombia',
    otroPais: '',
    ciudad,
    departamento,
    idTipoProyecto: tipoProyecto.tipo !== 'no_encontrado' ? tipoProyecto.item.id_tipo_proyecto : null,
    valorSolicitado: soloDigitos(extraccion.valorSolicitadoTexto),
    valorContrapartida: soloDigitos(extraccion.valorContrapartidaTexto),
    duracion: soloDigitos(extraccion.duracionTexto),
  }

  const participantesPorGrupo: BorradorCompleto['participantesPorGrupo'] = [
    {
      id: 1,
      principal: participanteDesdeTexto(extraccion.principal),
      coInvestigador: participanteDesdeTexto(extraccion.coinvestigador),
      externo1: participanteDesdeTexto(extraccion.externos[0]),
      externo2: participanteDesdeTexto(extraccion.externos[1]),
      egresado1: extraccion.egresados[0]
        ? { ...participanteVacio(), nombres: extraccion.egresados[0].nombres, apellidos: extraccion.egresados[0].apellidos }
        : participanteVacio(),
      egresado2: extraccion.egresados[1]
        ? { ...participanteVacio(), nombres: extraccion.egresados[1].nombres, apellidos: extraccion.egresados[1].apellidos }
        : participanteVacio(),
      cedulaEgresado1: extraccion.egresados[0]?.cedula ?? '',
      cedulaEgresado2: extraccion.egresados[1]?.cedula ?? '',
    },
  ]

  const estudiantesInvestigadores = extraccion.estudiantes.map((est) => {
    const rolTexto = est.rol === 'auxiliar' ? 'Auxiliar' : est.rol === 'asistente' ? 'Asistente' : ''
    const r = rolTexto ? emparejarContraCatalogo(rolTexto, catalogos.rolesEstudiante, (c) => c.nombre) : null
    if (rolTexto && (!r || r.tipo === 'no_encontrado')) {
      advertencias.push(`No se pudo determinar si "${est.nombres} ${est.apellidos}" es auxiliar o asistente — revísalo.`)
    }
    return {
      nombres: est.nombres,
      apellidos: est.apellidos,
      correo: '',
      idRolEstudiante: r && r.tipo !== 'no_encontrado' ? (r.item.id_rolestudiante ?? null) : null,
      codigo: est.codigo,
    }
  })

  const gruposCesmagSel = [construirGrupoInterno(extraccion.grupoCesmag, catalogos, advertencias)]
  const gruposExternosSel = [construirGrupoExterno(extraccion.grupoExterno)]

  const egresadosInfo = extraccion.egresados.map((eg, i) => ({
    id: i + 1,
    nombres: eg.nombres,
    apellidos: eg.apellidos,
    correo: '',
    idFacultad: null,
    idPrograma: null,
    empresa: eg.empresa,
    horasSemanales: eg.horasSemanales,
  }))

  const hojasVida = extraccion.hojasVida.slice(0, 2).map((hv, i) => ({
    id: Date.now() + i,
    nombres: hv.nombres,
    apellidos: hv.apellidos,
    correo: hv.correo,
    lugarNacimiento: hv.lugarNacimiento,
    fechaNacimiento: hv.fechaNacimiento,
    nacionalidad: hv.nacionalidad,
    tipoDocumento: hv.tipoDocumento,
    numeroDocumento: hv.numeroDocumento,
    direccion: hv.direccion,
    telefono: hv.telefono,
    celular: hv.celular,
    orcid: '',
    googleAcademico: '',
    categoriaMinciencias: '',
    cargoActual: hv.cargoActual,
    cargosDesempenados: hv.cargosDesempenados,
    titulosAcademicos: hv.titulosAcademicos,
    produccionCientifica: hv.produccionCientifica,
  }))
  if (extraccion.hojasVida.length > 2) {
    advertencias.push(`El documento trae ${extraccion.hojasVida.length} hojas de vida, pero el formulario solo admite 2 (principal y un co-investigador) — completa las demás manualmente si hace falta.`)
  }

  const objetivosEspecificos = extraccion.objetivosEspecificosTexto.map((texto, i) => ({ id: i + 1, texto }))

  const datosTexto = {
    resumen: extraccion.resumen,
    planteamiento: extraccion.planteamiento,
    pregunta: extraccion.pregunta,
    justificacion: extraccion.justificacion,
    objetivoGeneral: extraccion.objetivoGeneralTexto,
    antecedentes: enumerarAntecedentes(antecedentesImportados(extraccion.antecedentesTexto)),
    marcoTeorico: extraccion.marcoTeorico,
    metodologia: extraccion.metodologia,
    componenteEtico: extraccion.componenteEtico,
    implicacionesEticas: extraccion.implicacionesEticas,
    fuentesFinanciacion: extraccion.fuentesFinanciacion,
    permisosLicencias: extraccion.permisosLicencias,
    funcionesEstudiante: extraccion.funcionesEstudiante,
    referencias: extraccion.referenciasTexto.join('\n'),
  }

  const impactos: BorradorCompleto['impactos'] = {}
  objetivosEspecificos.forEach((obj, i) => {
    const im = extraccion.impactos[i]
    if (im) impactos[obj.id] = im
  })

  const bloquesPorClave = new Map<string, { anio: string; actividades: ExtraccionProyectoDocx['cronograma'] }>()
  for (const act of extraccion.cronograma) {
    const clave = `${act.periodo}|${act.anio}`
    const existente = bloquesPorClave.get(clave)
    if (existente) existente.actividades.push(act)
    else bloquesPorClave.set(clave, { anio: act.anio, actividades: [act] })
  }
  const cronogramas: BorradorCompleto['cronogramas'] = [...bloquesPorClave.values()].map((bloque, i) => ({
    id: Date.now() + i,
    actividades: bloque.actividades.map((act, j) => {
      const meses = Array(12).fill(false)
      act.meses.forEach((m) => {
        if (m >= 1 && m <= 12) meses[m - 1] = true
      })
      return { id: Date.now() + i * 100 + j, actividad: act.actividad, resultado: act.resultado, responsable: act.responsable, anio: act.anio, meses }
    }),
  }))

  const tiposProductoPlanos = catalogos.categoriasProducto.flatMap((c) => c.subcategorias.flatMap((s) => s.tipos))
  const cantidadesProducto: Record<number, string> = {}
  for (const prod of extraccion.productos) {
    const r = emparejarContraCatalogo(prod.nombre, tiposProductoPlanos, (t) => t.nombre)
    if (r.tipo === 'no_encontrado') {
      advertencias.push(`El producto "${prod.nombre}" no coincide con el catálogo — regístralo manualmente.`)
      continue
    }
    if (r.item.idReal != null) cantidadesProducto[r.item.idReal] = String(prod.cantidad)
  }

  const borrador: BorradorCompleto = {
    datosGeneral,
    participantesPorGrupo,
    estudiantesInvestigadores,
    gruposCesmagSel,
    gruposExternosSel,
    egresadosInfo,
    hojasVida,
    objetivosEspecificos,
    datosTexto,
    impactos,
    cronogramas,
    cantidadesProducto,
    idResponsableAsignado,
    tabsDesbloqueadas: ['hojasvida', 'general', 'grupos', 'formulacion', 'marco', 'cronograma', 'resultados', 'etico', 'firmas'],
  }

  return { borrador, advertencias }
}
