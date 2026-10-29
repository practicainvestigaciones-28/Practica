import { prisma } from "../config/prisma";

export class NotificacionNoEncontradaError extends Error {
  constructor() {
    super("La notificación indicada no existe");
  }
}

export const ROL_ADMINISTRADOR = "Administrador";
export const ROL_INVESTIGADOR = "Investigador";

/**
 * Qué acción pide cada notificación (tipo_evento). Las de acción se borran
 * cuando están leídas y esa acción ya se hizo sobre su proyecto (ver
 * resolverNotificaciones); las informativas, DIAS_INFORMATIVA días después
 * de leídas.
 */
export const TIPO_NOTIFICACION = {
  /** Admin: revisar un proyecto en Proyectos Postulados (visto bueno del líder, o corregido tras un rechazo). */
  ADMIN_REVISAR_POSTULADO: "admin_revisar_postulado",
  /** Admin: asignar el proyecto a la siguiente etapa (aprobado por un comité, o correcciones reenviadas). */
  ADMIN_ASIGNAR_ETAPA: "admin_asignar_etapa",
  /** Admin: responder una reclamación. */
  ADMIN_RESPONDER_RECLAMACION: "admin_responder_reclamacion",
  /** Admin: habilitar (o rechazar) un informe de avance o el informe final que solicitó el investigador en Seguimiento. */
  ADMIN_HABILITAR_INFORME: "admin_habilitar_informe",
  /** Investigador: corregir y reenviar su proyecto (rechazado o con correcciones). */
  INVESTIGADOR_CORREGIR: "investigador_corregir",
  /** Investigador: aceptar y firmar el acta de inicio. */
  INVESTIGADOR_FIRMAR_ACTA: "investigador_firmar_acta",
  INFORMATIVA: "informativa",
} as const;

const DIAS_INFORMATIVA = 7;

export async function crearNotificacion(
  id_usuario: number,
  datos: {
    titulo: string;
    mensaje: string;
    enlace?: string;
    rol_destino?: string | null;
    tipo_evento?: string;
    id_proyecto?: number;
  }
) {
  return prisma.notificacion.create({ data: { id_usuario, ...datos } });
}

/**
 * La acción que pedían estas notificaciones ya se hizo: las que ya se
 * habían visto se borran de una vez; las que aún no, quedan "resueltas" y
 * se borran en cuanto se marquen como leídas.
 */
export async function resolverNotificaciones(
  id_proyecto: number,
  tipos: string[],
  soloUsuario?: number
): Promise<void> {
  const where = {
    id_proyecto,
    tipo_evento: { in: tipos },
    ...(soloUsuario !== undefined ? { id_usuario: soloUsuario } : {}),
  };
  await prisma.notificacion.deleteMany({ where: { ...where, leida: true } });
  await prisma.notificacion.updateMany({ where: { ...where, leida: false }, data: { resuelta: true } });
}

/** Sin rol activo se ven todas; con rol, solo las de ese rol y las genéricas (sin rol_destino). */
function filtroPorRol(id_usuario: number, rolActivo?: string) {
  return rolActivo
    ? { id_usuario, OR: [{ rol_destino: null }, { rol_destino: rolActivo }] }
    : { id_usuario };
}

/**
 * Informativas (y las viejas sin tipo) ya leídas hace más de
 * DIAS_INFORMATIVA días. Las viejas no tienen fecha_leida: se usa la fecha
 * en que se crearon.
 */
async function limpiarInformativasViejas(id_usuario: number): Promise<void> {
  const limite = new Date(Date.now() - DIAS_INFORMATIVA * 24 * 60 * 60 * 1000);
  await prisma.notificacion.deleteMany({
    where: {
      id_usuario,
      leida: true,
      OR: [{ tipo_evento: TIPO_NOTIFICACION.INFORMATIVA }, { tipo_evento: null }],
      AND: [{ OR: [{ fecha_leida: { lt: limite } }, { fecha_leida: null, fecha_notificacion: { lt: limite } }] }],
    },
  });
}

export async function listarNotificaciones(id_usuario: number, rolActivo?: string) {
  await limpiarInformativasViejas(id_usuario);
  return prisma.notificacion.findMany({
    where: filtroPorRol(id_usuario, rolActivo),
    orderBy: { fecha_notificacion: "desc" },
  });
}

export async function contarNoLeidas(id_usuario: number, rolActivo?: string) {
  return prisma.notificacion.count({ where: { ...filtroPorRol(id_usuario, rolActivo), leida: false } });
}

/** Si la acción que pedía ya se había hecho, verla es lo último que faltaba: se borra. */
export async function marcarLeida(id_notificacion: number, id_usuario: number) {
  const existente = await prisma.notificacion.findUnique({ where: { id_notificacion } });
  if (!existente || existente.id_usuario !== id_usuario) throw new NotificacionNoEncontradaError();

  if (existente.resuelta) {
    await prisma.notificacion.delete({ where: { id_notificacion } });
    return null;
  }
  return prisma.notificacion.update({ where: { id_notificacion }, data: { leida: true, fecha_leida: new Date() } });
}
