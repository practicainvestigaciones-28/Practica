/** Datos crudos extraídos del .docx, en texto, sin resolver todavía contra catálogos reales. */

export interface ParticipanteTexto {
  nombres: string
  apellidos: string
  correo: string
  orcid: string
  googleAcademico: string
}

export interface EstudianteTexto {
  nombres: string
  apellidos: string
  correo: string
  codigo: string
  rol: 'auxiliar' | 'asistente' | ''
}

export interface EgresadoTexto {
  nombres: string
  apellidos: string
  cedula: string
  facultad: string
  programa: string
  empresa: string
  horasSemanales: string
}

export interface GrupoTexto {
  nombre: string
  facultadOProgramaTexto: string
  programaTexto: string
  lider: string
  codGruplac: string
  reconocidoMinciencias: boolean
  categoria: string
  acuerdoInstitucional: string
  lineaOTexto: string
  odsOLineaMedularTexto: string
}

export interface ImpactoTexto {
  impactoEsperado: string
  beneficiarioPotencial: string
  indicadorVerificable: string
}

export interface ActividadCronogramaTexto {
  actividad: string
  resultado: string
  responsable: string
  periodo: string
  anio: string
  meses: number[]
}

export interface ProductoTexto {
  nombre: string
  cantidad: number
}

export interface HojaVidaTexto {
  nombres: string
  apellidos: string
  lugarNacimiento: string
  fechaNacimiento: string
  nacionalidad: string
  tipoDocumento: string
  numeroDocumento: string
  direccion: string
  correo: string
  telefono: string
  celular: string
  cargoActual: string
  cargosDesempenados: string
  titulosAcademicos: string
  produccionCientifica: string
}

export interface ExtraccionProyectoDocx {
  titulo: string
  principal: ParticipanteTexto
  coinvestigador: ParticipanteTexto | null
  externos: ParticipanteTexto[]
  egresados: EgresadoTexto[]
  estudiantes: EstudianteTexto[]

  modalidadTexto: string
  areaTexto: string
  programasTexto: string[]
  ciudad: string
  departamento: string
  duracionTexto: string
  tipoProyectoTexto: string
  valorSolicitadoTexto: string
  valorContrapartidaTexto: string

  grupoCesmag: GrupoTexto | null
  grupoExterno: GrupoTexto | null

  resumen: string
  planteamiento: string
  pregunta: string
  justificacion: string
  objetivoGeneralTexto: string
  objetivosEspecificosTexto: string[]
  antecedentesTexto: string[]
  marcoTeorico: string
  metodologia: string
  impactos: ImpactoTexto[]
  referenciasTexto: string[]

  cronograma: ActividadCronogramaTexto[]
  productos: ProductoTexto[]

  componenteEtico: string
  implicacionesEticas: string
  fuentesFinanciacion: string
  permisosLicencias: string
  funcionesEstudiante: string

  hojasVida: HojaVidaTexto[]
}

export interface ResultadoImportacionDocx {
  extraccion: ExtraccionProyectoDocx | null
  advertencias: string[]
  error?: string
}

export class DocxInvalidoError extends Error {}
