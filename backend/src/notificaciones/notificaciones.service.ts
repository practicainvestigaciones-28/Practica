import { prisma } from "../config/prisma";

export class NotificacionNoEncontradaError extends Error {
  constructor() {
    super("La notificación indicada no existe");
  }
}

export async function crearNotificacion(
  id_usuario: number,
  datos: { titulo: string; mensaje: string; enlace?: string }
) {
  return prisma.notificacion.create({ data: { id_usuario, ...datos } });
}

export async function listarNotificaciones(id_usuario: number) {
  return prisma.notificacion.findMany({
    where: { id_usuario },
    orderBy: { fecha_notificacion: "desc" },
  });
}

export async function contarNoLeidas(id_usuario: number) {
  return prisma.notificacion.count({ where: { id_usuario, leida: false } });
}

export async function marcarLeida(id_notificacion: number, id_usuario: number) {
  const existente = await prisma.notificacion.findUnique({ where: { id_notificacion } });
  if (!existente || existente.id_usuario !== id_usuario) throw new NotificacionNoEncontradaError();

  return prisma.notificacion.update({ where: { id_notificacion }, data: { leida: true } });
}
