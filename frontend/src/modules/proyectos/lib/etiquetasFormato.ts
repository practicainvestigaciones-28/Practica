/**
 * Etiquetas literales del formato institucional INV-IC-FR-001, copiadas de
 * frontend/src/modules/proyectos/lib/exportar/contenido.ts (que genera este
 * mismo documento en Word/PDF). Es la fuente de verdad que usa
 * lib/importar/ para reconocer cada campo al leer un .docx diligenciado.
 *
 * Se mantiene como archivo aparte (no se tocó contenido.ts) para no arriesgar
 * el exportador, que ya está en uso real. Si el formato institucional cambia
 * de redacción, hay que actualizar ambos archivos.
 */

export const CODIGO_FORMATO = 'INV-IC-FR-001'
export const VERSION_FORMATO = '7'

export const ROL_PRINCIPAL = 'Investigador(a) Principal UNICESMAG'
export const ROL_COINV_UNICESMAG = 'Co investigador(a) UNICESMAG'
export const ROL_EXTERNO = 'Co investigador(a) Externo(a)'
export const ROL_EGRESADO = 'Co investigador(a) Egresado(a) UNICESMAG'
export const ROL_ESTUDIANTE = 'Estudiante Investigador(a)'

// ---------- 1. Información general ----------

export const TITULO_SECCION_1 = '1. INFORMACIÓN GENERAL DEL PROYECTO'
export const ETQ_TITULO_PROYECTO = 'Título:'
export const ETQ_ORCID = 'ORCID'
export const ETQ_GOOGLE_ACADEMICO = 'Google Académico'
export const ETQ_DEDICACION = 'Dedicación:'
export const ETQ_CEDULA = 'Cédula:'
export const ETQ_CODIGO_ESTUDIANTIL = 'Código estudiantil'
export const ETQ_MODALIDAD = 'Modalidad del proyecto'
export const ETQ_AREA_CONOCIMIENTO = 'Área de conocimiento a la que aplica'
export const ETQ_PROGRAMAS = 'Programa(s) de pregrado o posgrado al que se articula.'
export const ETQ_LUGAR_EJECUCION = 'Lugar de Ejecución del Proyecto'
export const ETQ_CIUDAD = 'Ciudad:'
export const ETQ_DEPARTAMENTO = 'Departamento:'
export const ETQ_DURACION = 'Duración del proyecto (en periodos):'
export const ETQ_TIPO_PROYECTO = 'Tipo de Proyecto'
export const ETQ_FINANCIACION = 'Financiación Total Solicitada'
export const ETQ_VALOR_SOLICITADO = 'Valor solicitado UNICESMAG'
export const ETQ_VALOR_CONTRAPARTIDA = 'Valor contrapartida'
export const ETQ_VALOR_TOTAL = 'Valor total'

// ---------- 2. Grupos y egresados ----------

export const TITULO_SECCION_2 = 'INFORMACIÓN GENERAL DEL GRUPO DE INVESTIGACIÓN AL CUAL ESTÁ ADSCRITO EL PROYECTO EN UNICESMAG'
export const TITULO_SECCION_2_EXTERNO = 'INFORMACIÓN GENERAL DEL GRUPO DE INVESTIGACIÓN EXTERNO'
export const ETQ_FACULTAD_DEPARTAMENTO = 'Facultad/Departamento:'
export const ETQ_UNIVERSIDAD_ENTIDAD = 'Universidad / Entidad'
export const ETQ_PROGRAMA_ACADEMICO = 'Programa Académico:'
export const ETQ_PROGRAMA_DEPENDENCIA = 'Programa Académico/ Dependencia'
export const ETQ_NOMBRE_GRUPO = 'Nombre del Grupo:'
export const ETQ_LIDER_GRUPO = 'Líder del grupo:'
export const ETQ_DIRECTOR_GRUPO = 'Director del Grupo:'
export const ETQ_COD_GRUPLAC = 'Código GrupLac:'
export const ETQ_RECONOCIDO_MINCIENCIAS = 'Reconocido por MINCIENCIAS'
export const ETQ_CATEGORIA = 'Categoría'
export const ETQ_ACUERDO_INSTITUCIONAL = 'Acuerdo Institucional'
export const ETQ_LINEA_INTERNA = 'Línea activa de investigación a la cual está vinculado el proyecto'
export const ETQ_LINEA_EXTERNA = 'Línea activa de Investigación en la cual está vinculado el proyecto'
export const ETQ_ODS_PROYECTO = 'Objetivo(s) de Desarrollo Sostenible ODS en el (los) cual(es) está asociado el proyecto'
export const ETQ_LINEA_MEDULAR = 'Línea medular Institucional en la cual está asociado el proyecto'
export const ETQ_INVESTIGADORES_UNICESMAG = 'Investigadores UNICESMAG del proyecto'
export const ETQ_INVESTIGADORES_EXTERNOS = 'Investigadores externos del proyecto'
export const ETQ_DEDICACION_COL = 'Dedicación'

export const TITULO_EGRESADOS = 'INFORMACIÓN GENERAL DE EGRESADOS(AS)'
export const ETQ_FACULTAD = 'Facultad'
export const ETQ_PROGRAMA_ACADEMICO_EGRESADO = 'Programa Académico'
export const ETQ_EMPRESA_ENTIDAD = 'Empresa o Entidad'
export const ETQ_COINV_EGRESADO = 'Co Investigador(a) Egresado(a)'
export const ETQ_DEDICACION_HORAS = 'Dedicación (Horas semanales)'

// ---------- 3 y 4. Resumen y descripción ----------

export const TITULO_RESUMEN = '3. RESUMEN'
export const TITULO_PLANTEAMIENTO = '4.1. PLANTEAMIENTO DEL PROBLEMA'
export const TITULO_PREGUNTA = '4.1.1 PREGUNTA DE INVESTIGACIÓN'
export const TITULO_JUSTIFICACION = '4.2 JUSTIFICACIÓN'
export const TITULO_OBJETIVOS = '4.3 OBJETIVOS GENERAL Y ESPECÍFICOS'
export const TITULO_ANTECEDENTES = '4.4 ANTECEDENTES'
export const TITULO_MARCO_TEORICO = '4.5 MARCO TEORICO PRELIMINAR'
export const TITULO_METODOLOGIA = '4.6 METODOLOGÍA PRELIMINAR PROPUESTA'
export const TITULO_IMPACTO = '4.7  IMPACTO'
export const ETQ_IMPACTO_ESPERADO = 'IMPACTO ESPERADO'
export const ETQ_BENEFICIARIO_POTENCIAL = 'BENEFICIARIO POTENCIAL'
export const ETQ_INDICADOR_VERIFICABLE = 'INDICADOR VERIFICABLE'
export const TITULO_REFERENCIAS = '4.8  REFERENCIAS'

export const TITULO_CRONOGRAMA = '4.9 CRONOGRAMA DE ACTIVIDADES'
export const ETQ_ACTIVIDAD = 'Actividad'
export const ETQ_RESULTADO = 'Resultado'
export const ETQ_RESPONSABLE = 'Responsable'

export const TITULO_RESULTADOS_ESPERADOS = '4.10   RESULTADOS ESPERADOS:'
export const ETQ_NUMERO_PRODUCTOS = 'Número de productos'

export const TITULO_COMPONENTE_ETICO = '4.11  COMPONENTE ÉTICO'
export const TITULO_IMPLICACIONES_ETICAS = '4.12  IMPLICACIONES ÉTICAS'
export const TITULO_FUENTES_FINANCIACION = '4.13  FUENTES DE FINANCIACIÓN'
export const TITULO_PERMISOS_LICENCIAS = '4.14  PERMISOS O LICENCIAS PERTINENTES'
export const TITULO_FUNCIONES_ESTUDIANTE = '4.15  FUNCIONES DEL ESTUDIANTE AUXILIAR O ASISTENTE EN LA INVESTIGACIÓN'

// ---------- Anexo 1: hojas de vida ----------

export const TITULO_ANEXO = 'Anexo 1'
export const TITULO_HOJA_VIDA = 'HOJA DE VIDA'
export const ETQ_NOMBRES = 'Nombres'
export const ETQ_APELLIDOS = 'Apellidos'
export const ETQ_LUGAR_FECHA_NACIMIENTO = 'Lugar y fecha de Nacimiento'
export const ETQ_NACIONALIDAD = 'Nacionalidad'
export const ETQ_TIPO_DOCUMENTO = 'Tipo documento de identidad'
export const ETQ_NUMERO_DOCUMENTO = 'No. Documento de identidad'
export const ETQ_DIRECCION_RESIDENCIA = 'Dirección de residencia'
export const ETQ_CORREO_ELECTRONICO = 'Correo electrónico'
export const ETQ_TELEFONO = 'Teléfono'
export const ETQ_CELULAR = 'Celular'
export const ETQ_CARGO_ACTUAL = 'Cargo actual'
export const ETQ_CARGOS_DESEMPENADOS = 'Cargos desempeñados'
export const ETQ_TITULOS_ACADEMICOS = 'Títulos académicos obtenidos'
export const ETQ_PRODUCCION_CIENTIFICA = 'Producción científica y académica'

/** Anclajes mínimos: si no aparece ninguno, el documento no tiene la estructura esperada. */
export const ANCLAJES_MINIMOS = [TITULO_SECCION_1, TITULO_RESUMEN, TITULO_COMPONENTE_ETICO, TITULO_HOJA_VIDA]
