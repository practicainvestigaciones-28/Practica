// Reglas del acta de inicio (formato INV-IC-FR-017 v5), sin acceso a la base de
// datos para poder probarlas solas. El frontend aplica las mismas reglas para
// avisar antes de guardar; esta es la validación que vale.

export const TIPOS_CLAUSULA = ["compromisos", "derechos de autor", "confidencialidad", "tratamiento de datos"] as const;
export type TipoClausula = (typeof TIPOS_CLAUSULA)[number];

/** Numeral 2 del formato. */
export const TIPOS_PROYECTO = [
  "Investigación Científica",
  "Innovación Educativa",
  "Desarrollo Tecnológico",
  "Innovación",
  "Creación Artística y Cultural",
] as const;
export type TipoProyecto = (typeof TIPOS_PROYECTO)[number];

/** Cada "periodo" de la formulación del proyecto es un semestre. */
export const MESES_POR_PERIODO = 6;

export interface VigenciaActa {
  anio: number;
  valor_asignado: number;
}

export interface DatosActa {
  tipo_proyecto: string;
  numero_acta_aprobacion: string;
  fecha_acta_aprobacion: string; // yyyy-mm-dd
  centro_costos: string;
  fecha_inicio: string; // yyyy-mm-dd
  duracion_meses: number;
  vigencias: VigenciaActa[];
}

export interface ContactoParticipante {
  identificacion: string | null;
  telefono: string | null;
  correo: string | null;
  programa_academico: string | null;
  institucion: string | null;
}

const SOLO_DIGITOS = /^\d+$/;

export const esCorreoValido = (correo: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Tipo del formato que corresponde a la modalidad con que se aprobó el proyecto (null si no coincide). */
export function tipoProyectoDesdeModalidad(modalidad: string | null | undefined): TipoProyecto | null {
  if (!modalidad) return null;
  return TIPOS_PROYECTO.find((t) => normalizar(t) === normalizar(modalidad)) ?? null;
}

/** HU-84: fecha fin = fecha inicio + duración en meses (menos un día). yyyy-mm-dd, o "" si faltan datos. */
export function calcularFechaFin(fechaInicio: string, duracionMeses: number): string {
  if (!fechaInicio || !duracionMeses || duracionMeses < 1) return "";
  const [a, m, d] = fechaInicio.split("-").map(Number);
  const fin = new Date(Date.UTC(a, m - 1 + duracionMeses, d));
  fin.setUTCDate(fin.getUTCDate() - 1);
  return fin.toISOString().slice(0, 10);
}

/** Años calendario que cubre la ejecución: del año de la fecha de inicio al de la fecha de fin. */
export function aniosDeEjecucion(fechaInicio: string, duracionMeses: number): number[] {
  const fin = calcularFechaFin(fechaInicio, duracionMeses);
  if (!fin) return [];
  const desde = Number(fechaInicio.slice(0, 4));
  const hasta = Number(fin.slice(0, 4));
  return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
}

export function sumaVigencias(vigencias: { valor_asignado: number }[]): number {
  return vigencias.reduce((t, v) => t + (Number(v.valor_asignado) || 0), 0);
}

/** Problemas de los numerales 2 y 3 (y fecha/duración). Vacío = se puede guardar. */
export function validarDatosActa(datos: DatosActa, valorSolicitado: number, hoy = new Date().toISOString().slice(0, 10)): string[] {
  const errores: string[] = [];
  if (!datos.tipo_proyecto) errores.push("Selecciona el tipo de proyecto.");
  else if (!(TIPOS_PROYECTO as readonly string[]).includes(datos.tipo_proyecto)) errores.push("El tipo de proyecto no es válido.");

  const numero = (datos.numero_acta_aprobacion ?? "").trim();
  if (!numero) errores.push("Falta el número del acta de aprobación.");
  else if (!SOLO_DIGITOS.test(numero)) errores.push("El número del acta debe contener solo números.");

  if (!datos.fecha_acta_aprobacion) errores.push("Falta la fecha del acta de aprobación.");
  else if (datos.fecha_acta_aprobacion > hoy) errores.push("La fecha del acta de aprobación no puede ser futura.");

  const centro = (datos.centro_costos ?? "").trim();
  if (!centro) errores.push("Falta el centro de costos.");
  else if (!SOLO_DIGITOS.test(centro)) errores.push("El centro de costos debe contener solo números.");

  if (!datos.fecha_inicio) errores.push("Falta la fecha de inicio.");
  if (!datos.duracion_meses || datos.duracion_meses < 1) errores.push("La duración debe ser de al menos 1 mes.");

  if (datos.vigencias.length === 0) errores.push("Registra al menos una vigencia.");
  const anios = datos.vigencias.map((v) => v.anio);
  if (new Set(anios).size !== anios.length) errores.push("No puede haber dos vigencias con el mismo año.");

  const permitidos = aniosDeEjecucion(datos.fecha_inicio, datos.duracion_meses);
  if (permitidos.length > 0) {
    for (const a of [...new Set(anios)].filter((x) => !permitidos.includes(x))) {
      errores.push(`El año ${a} no está dentro de la ejecución del proyecto (${permitidos[0]}–${permitidos[permitidos.length - 1]}).`);
    }
  }
  if (datos.vigencias.length > 0 && sumaVigencias(datos.vigencias) !== valorSolicitado) {
    errores.push("La suma de las vigencias debe coincidir con el valor solicitado a UNICESMAG.");
  }
  return errores;
}

const CAMPOS_CONTACTO: { clave: keyof ContactoParticipante; etiqueta: string }[] = [
  { clave: "identificacion", etiqueta: "identificación" },
  { clave: "telefono", etiqueta: "teléfono" },
  { clave: "correo", etiqueta: "correo" },
  { clave: "programa_academico", etiqueta: "programa académico" },
  { clave: "institucion", etiqueta: "institución" },
];

/** HU-86: campos de contacto que le faltan a un participante. */
export function faltantesContacto(c: ContactoParticipante): string[] {
  return CAMPOS_CONTACTO.filter(({ clave }) => !String(c[clave] ?? "").trim()).map((x) => x.etiqueta);
}

/** ¿Todos los participantes aceptaron todos los numerales? */
export function aceptacionCompleta(
  idsParticipantes: number[],
  aceptaciones: { id_usuarioproyecto: number; tipo_clausula: string; aceptado: boolean }[]
): boolean {
  if (idsParticipantes.length === 0) return false;
  const aceptadas = new Set(aceptaciones.filter((a) => a.aceptado).map((a) => `${a.id_usuarioproyecto}|${a.tipo_clausula}`));
  return idsParticipantes.every((id) => TIPOS_CLAUSULA.every((t) => aceptadas.has(`${id}|${t}`)));
}
