import { prisma } from "../config/prisma";

export class ConvocatoriaNoEncontradaError extends Error {
  constructor() {
    super("La convocatoria no existe");
  }
}

export class ConvocatoriaCerradaError extends Error {
  constructor() {
    super("No se pueden registrar proyectos en una convocatoria que no está activa");
  }
}

export class ProyectoNoEncontradoError extends Error {
  constructor() {
    super("El proyecto no existe");
  }
}

export class NoAutorizadoError extends Error {
  constructor() {
    super("Solo el creador del proyecto o un administrador pueden editarlo");
  }
}

export interface DatosProyecto {
  id_convocatoria: number;
  id_modalidad_proyecto: number;
  id_tipo_proyecto: number;
  titulo: string;
  ciudad?: string;
  departamento?: string;
  resumen?: string;
  planteamiento_problema?: string;
  pregunta_investigacion?: string;
  justificacion?: string;
  marco_teorico?: string;
  metodologia_preliminar?: string;
  componente_etico?: string;
  funciones_estudiante_auxiliar?: string;
}

/** RQF13 - Registro de proyecto por investigador */
export async function crearProyecto(datos: DatosProyecto, creado_por: number) {
  const convocatoria = await prisma.convocatoria.findUnique({
    where: { id_convocatoria: datos.id_convocatoria },
  });

  if (!convocatoria) throw new ConvocatoriaNoEncontradaError();
  if (convocatoria.estado !== "activa") throw new ConvocatoriaCerradaError();

  return prisma.proyecto.create({
    data: { ...datos, creado_por },
  });
}

/** RQF15 / RQF75 - Consulta y listado de proyectos, con filtros y búsqueda */
export async function listarProyectos(filtros: { estado?: string; id_convocatoria?: number; q?: string }) {
  return prisma.proyecto.findMany({
    where: {
      ...(filtros.estado ? { estado_actual: filtros.estado } : {}),
      ...(filtros.id_convocatoria ? { id_convocatoria: filtros.id_convocatoria } : {}),
      ...(filtros.q ? { titulo: { contains: filtros.q, mode: "insensitive" } } : {}),
    },
    include: {
      convocatoria: { select: { nombre: true } },
      modalidad: { select: { nombre: true } },
      tipoProyecto: { select: { nombre: true } },
      creador: { select: { id_usuario: true, nombre: true, apellido: true } },
    },
    orderBy: { fecha_registro: "desc" },
  });
}

/** RQF15 - Consulta de detalle */
export async function obtenerProyecto(id_proyecto: number) {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id_proyecto },
    include: {
      convocatoria: true,
      modalidad: true,
      tipoProyecto: true,
      creador: { select: { id_usuario: true, nombre: true, apellido: true, correo: true } },
    },
  });

  if (!proyecto) throw new ProyectoNoEncontradoError();
  return proyecto;
}

const CAMPOS_EDITABLES = [
  "titulo",
  "ciudad",
  "departamento",
  "resumen",
  "planteamiento_problema",
  "pregunta_investigacion",
  "justificacion",
  "marco_teorico",
  "metodologia_preliminar",
  "componente_etico",
  "funciones_estudiante_auxiliar",
] as const;

/**
 * RQF14 - Edición del proyecto según etapa. Por ahora valida que solo el
 * creador o un administrador puedan editar; la restricción fina por
 * etapa/estado se ampliará cuando se modele el flujo de evaluación.
 */
export async function actualizarProyecto(
  id_proyecto: number,
  cambios: Partial<Record<(typeof CAMPOS_EDITABLES)[number], string>>,
  usuarioQueEdita: { id_usuario: number; roles: string[] }
) {
  const existente = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!existente) throw new ProyectoNoEncontradoError();

  const esDueno = existente.creado_por === usuarioQueEdita.id_usuario;
  const esAdmin = usuarioQueEdita.roles.includes("Administrador");
  if (!esDueno && !esAdmin) throw new NoAutorizadoError();

  const data: Record<string, string> = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (cambios[campo] !== undefined) data[campo] = cambios[campo] as string;
  }

  return prisma.proyecto.update({ where: { id_proyecto }, data });
}
