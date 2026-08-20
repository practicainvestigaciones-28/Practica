import { prisma } from "../config/prisma";

export class ProyectoNoEncontradoError extends Error {
  constructor() {
    super("El proyecto no existe");
  }
}

export class NoAutorizadoProyectoError extends Error {
  constructor() {
    super("Solo el creador del proyecto o un administrador pueden gestionar esta información");
  }
}

/**
 * Usado por todos los sub-recursos del proyecto (participantes, áreas,
 * programas, financiación, grupos): solo el dueño del proyecto o un
 * Administrador pueden agregar/editar/quitar información asociada.
 */
export async function verificarPermisoProyecto(
  id_proyecto: number,
  usuarioQueEdita: { id_usuario: number; roles: string[] }
): Promise<void> {
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  const esDueno = proyecto.creado_por === usuarioQueEdita.id_usuario;
  const esAdmin = usuarioQueEdita.roles.includes("Administrador");
  if (!esDueno && !esAdmin) throw new NoAutorizadoProyectoError();
}
