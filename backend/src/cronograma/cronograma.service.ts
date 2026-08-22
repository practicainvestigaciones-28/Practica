import { prisma } from "../config/prisma";
import { verificarPermisoProyecto } from "../utils/permisosProyecto";
export { ProyectoNoEncontradoError, NoAutorizadoProyectoError } from "../utils/permisosProyecto";

export class ActividadNoEncontradaError extends Error {
  constructor() {
    super("La actividad indicada no existe en este proyecto");
  }
}

export class MesInvalidoError extends Error {
  constructor() {
    super("El mes debe estar entre 1 y 12");
  }
}

interface UsuarioQueEdita {
  id_usuario: number;
  roles: string[];
}

export async function agregarActividad(
  id_proyecto: number,
  datos: { responsable: number; actividad: string; resultado?: string },
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  return prisma.cronogramaActividad.create({
    data: { id_proyecto, ...datos },
    include: { usuarioResponsable: { select: { id_usuario: true, nombre: true, apellido: true } } },
  });
}

export async function listarActividades(id_proyecto: number) {
  return prisma.cronogramaActividad.findMany({
    where: { id_proyecto },
    include: {
      usuarioResponsable: { select: { id_usuario: true, nombre: true, apellido: true } },
      periodos: { include: { periodo: true } },
    },
  });
}

export async function quitarActividad(id_proyecto: number, id_actividad: number, usuarioQueEdita: UsuarioQueEdita) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const existente = await prisma.cronogramaActividad.findUnique({ where: { id_actividad } });
  if (!existente || existente.id_proyecto !== id_proyecto) throw new ActividadNoEncontradaError();
  await prisma.cronogramaActividad.delete({ where: { id_actividad } });
}

/** Ubica una actividad en un periodo/año/mes específico del cronograma */
export async function programarActividad(
  id_proyecto: number,
  id_actividad: number,
  datos: { id_periodo: number; año: number; mes: number },
  usuarioQueEdita: UsuarioQueEdita
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  const actividad = await prisma.cronogramaActividad.findUnique({ where: { id_actividad } });
  if (!actividad || actividad.id_proyecto !== id_proyecto) throw new ActividadNoEncontradaError();

  if (datos.mes < 1 || datos.mes > 12) throw new MesInvalidoError();

  return prisma.cronogramaPeriodoMes.create({
    data: { id_actividad, ...datos },
    include: { periodo: true },
  });
}
