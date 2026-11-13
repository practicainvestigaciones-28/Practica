import { prisma } from "../config/prisma";
import { emitirCambio } from "../ws/socket";

export class NotificacionNoEncontradaError extends Error {
  constructor() {
    super("La notificación indicada no existe");
  }
}

export const ROL_ADMINISTRADOR = "Administrador";
export const ROL_INVESTIGADOR = "Investigador";

/**
 * Qué acción pide cada notificación (tipo_evento). Las de acción se borran en
 * cuanto esa acción se hace sobre su proyecto (ver resolverNotificaciones),
 * estén leídas o no; las informativas, DIAS_INFORMATIVA días después de leídas.
 */
export const TIPO_NOTIFICACION = {
  /** Admin: revisar un proyecto en Proyectos Postulados (visto bueno del líder, o corregido tras un rechazo). */
  ADMIN_REVISAR_POSTULADO: "admin_revisar_postulado",
  /** Admin: asignar el proyecto a la siguiente etapa (aprobado por un comité, o correcciones reenviadas). */
  ADMIN_ASIGNAR_ETAPA: "admin_asignar_etapa",
  /** Admin: los pares terminaron de revisar un proyecto: revisar sus calificaciones y enviar el resultado al investigador. */
  ADMIN_ENVIAR_RESULTADO_PARES: "admin_enviar_resultado_pares",
  /** Admin: responder una reclamación. */
  ADMIN_RESPONDER_RECLAMACION: "admin_responder_reclamacion",
  /** Investigador: corregir y reenviar su proyecto (rechazado o con correcciones). */
  INVESTIGADOR_CORREGIR: "investigador_corregir",
  /** Investigador: aceptar y firmar el acta de inicio. */
  INVESTIGADOR_FIRMAR_ACTA: "investigador_firmar_acta",
  /** Investigador: firmar como Investigador(a) Principal un proyecto que el Administrador registró a su nombre. */
  INVESTIGADOR_FIRMAR_PROYECTO: "investigador_firmar_proyecto",
  /** Investigador: diligenciar, firmar y radicar un informe (de avance o final) que el Administrador le solicitó. */
  INVESTIGADOR_PRESENTAR_INFORME: "investigador_presentar_informe",
  /** Líder de investigación: dar el visto bueno (o rechazar) a un proyecto de su grupo que el investigador acaba de registrar o corregir. */
  LIDER_DAR_VISTO_BUENO: "lider_dar_visto_bueno",
  /** Integrante de comité o Par Evaluador: revisar el proyecto que el Administrador le asignó. */
  EVALUADOR_REVISAR_PROYECTO: "evaluador_revisar_proyecto",
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
  const creada = await prisma.notificacion.create({ data: { id_usuario, ...datos } });
  avisarCambioNotificaciones();
  return creada;
}

/** Avisa a los navegadores abiertos que las notificaciones cambiaron, para que la campana se actualice sola. */
export function avisarCambioNotificaciones(): void {
  emitirCambio("notificaciones");
}

/**
 * La acción que pedían estas notificaciones ya se hizo: se borran de una vez (se hayan visto o no) y se avisa a los
 * navegadores para que la campana se actualice sin recargar. `titulo` limita el borrado a los avisos con ese título (por
 * ejemplo, el de un informe en particular, entre varios del mismo proyecto).
 */
export async function resolverNotificaciones(
  id_proyecto: number,
  tipos: string[],
  soloUsuario?: number,
  filtro: { titulo?: string } = {}
): Promise<void> {
  await prisma.notificacion.deleteMany({
    where: {
      id_proyecto,
      tipo_evento: { in: tipos },
      ...(soloUsuario !== undefined ? { id_usuario: soloUsuario } : {}),
      ...(filtro.titulo !== undefined ? { titulo: filtro.titulo } : {}),
    },
  });
  avisarCambioNotificaciones();
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
