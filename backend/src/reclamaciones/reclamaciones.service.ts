import { prisma } from "../config/prisma";
import { crearNotificacion } from "../notificaciones/notificaciones.service";

export class ProyectoNoEncontradoError extends Error {
  constructor() {
    super("El proyecto indicado no existe");
  }
}

export class NoAutorizadoReclamacionError extends Error {
  constructor() {
    super("Solo el investigador que registró el proyecto puede reclamar sobre él");
  }
}

export class ProyectoNoRechazadoError extends Error {
  constructor() {
    super("Solo se puede reclamar sobre un proyecto rechazado");
  }
}

export class ReclamacionYaExisteError extends Error {
  constructor() {
    super("Ya hay una reclamación en curso para este proyecto");
  }
}

export class ReclamacionNoEncontradaError extends Error {
  constructor() {
    super("La reclamación indicada no existe");
  }
}

/** Nombre de etapa (catálogo) -> etiqueta legible para la columna "Evaluación". */
const ETIQUETA_ETAPA: Record<string, string> = {
  "General/Inicial": "Revisión inicial",
  Comite_Investigacion: "Comité de Investigación",
  Etica: "Comité de Ética",
  Pares: "Par Evaluador",
};

/**
 * De qué etapa vino el rechazo. Comité de Investigación/Ética sí dejan una
 * EvaluacionEtapa limpia con el resultado; la revisión inicial del
 * Administrador y el consolidado de Pares no (ver HistorialEtapaEstado), así
 * que en esos casos id_evaluacion queda null y basta con la etiqueta.
 */
async function determinarOrigenRechazo(
  id_proyecto: number
): Promise<{ etapa_rechazo: string; id_evaluacion: number | null }> {
  const ultimoHistorial = await prisma.historialEtapaEstado.findFirst({
    where: { id_proyecto },
    include: { etapa: true },
    orderBy: { fecha_cambio: "desc" },
  });
  const nombreEtapa = ultimoHistorial?.etapa.nombre ?? "General/Inicial";
  const etapa_rechazo = ETIQUETA_ETAPA[nombreEtapa] ?? nombreEtapa;

  let id_evaluacion: number | null = null;
  if (nombreEtapa === "Comite_Investigacion" || nombreEtapa === "Etica") {
    const evaluacion = await prisma.evaluacionEtapa.findFirst({
      where: { id_proyecto, etapa: { nombre: nombreEtapa } },
      orderBy: { fecha_evaluacion: "desc" },
    });
    id_evaluacion = evaluacion?.id_evaluacion ?? null;
  }
  return { etapa_rechazo, id_evaluacion };
}

const INCLUDE_RECLAMACION = {
  proyecto: { select: { id_proyecto: true, titulo: true } },
  usuarioReclamante: { select: { id_usuario: true, nombre: true, apellido: true } },
  usuarioRespuesta: { select: { id_usuario: true, nombre: true, apellido: true } },
} as const;

/** RQF60 - El investigador presenta una reclamación sobre su proyecto rechazado. */
export async function crearReclamacion(id_proyecto: number, id_usuario: number, motivo: string) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();
  if (proyecto.creado_por !== id_usuario) throw new NoAutorizadoReclamacionError();
  if (proyecto.estado_actual !== "rechazado" && proyecto.estado_actual !== "no_cumple") {
    throw new ProyectoNoRechazadoError();
  }

  const yaTieneUnaEnCurso = await prisma.reclamacion.findFirst({
    where: { id_proyecto, estado: { in: ["pendiente", "en_revision"] } },
  });
  if (yaTieneUnaEnCurso) throw new ReclamacionYaExisteError();

  const { etapa_rechazo, id_evaluacion } = await determinarOrigenRechazo(id_proyecto);

  const reclamacion = await prisma.reclamacion.create({
    data: {
      id_proyecto,
      id_evaluacion,
      etapa_rechazo,
      id_usuario_reclamante: id_usuario,
      motivo_reclamacion: motivo,
    },
    include: INCLUDE_RECLAMACION,
  });

  const administradores = await prisma.usuario.findMany({
    where: { activo: true, roles: { some: { rol: { nombre: "Administrador" } } } },
    select: { id_usuario: true },
  });
  await Promise.all(
    administradores.map((admin) =>
      crearNotificacion(admin.id_usuario, {
        titulo: "Nueva reclamación",
        mensaje: `${reclamacion.usuarioReclamante.nombre} ${reclamacion.usuarioReclamante.apellido} presentó una reclamación sobre el proyecto "${reclamacion.proyecto.titulo}" (${etapa_rechazo}).`,
        enlace: "/formatos-evaluacion",
      })
    )
  );

  return reclamacion;
}

/** RQF62 - Listado para el Administrador (todas) o para el investigador (solo las propias). */
export async function listarReclamaciones(filtro: { id_usuario_reclamante?: number } = {}) {
  return prisma.reclamacion.findMany({
    where: filtro,
    include: INCLUDE_RECLAMACION,
    orderBy: { fecha_reclamacion: "desc" },
  });
}

/** Para que el investigador sepa, desde el detalle de su proyecto, si ya reclamó y en qué quedó. */
export async function obtenerReclamacionDeProyecto(id_proyecto: number, id_usuario: number) {
  return prisma.reclamacion.findFirst({
    where: { id_proyecto, id_usuario_reclamante: id_usuario },
    include: INCLUDE_RECLAMACION,
    orderBy: { fecha_reclamacion: "desc" },
  });
}

/** El Administrador marca que ya empezó a revisarla (sin responder todavía). */
export async function marcarEnRevision(id_reclamacion: number) {
  const existente = await prisma.reclamacion.findUnique({ where: { id_reclamacion } });
  if (!existente) throw new ReclamacionNoEncontradaError();

  return prisma.reclamacion.update({
    where: { id_reclamacion },
    data: { estado: "en_revision" },
    include: INCLUDE_RECLAMACION,
  });
}

/** RQF63 - El Administrador responde la reclamación; queda resuelta y se notifica al investigador. */
export async function responderReclamacion(id_reclamacion: number, id_usuario_respuesta: number, respuesta: string) {
  const existente = await prisma.reclamacion.findUnique({
    where: { id_reclamacion },
    include: { proyecto: { select: { titulo: true, creado_por: true } } },
  });
  if (!existente) throw new ReclamacionNoEncontradaError();

  const actualizado = await prisma.reclamacion.update({
    where: { id_reclamacion },
    data: { respuesta, estado: "resuelta", fecha_respuesta: new Date(), id_usuario_respuesta },
    include: INCLUDE_RECLAMACION,
  });

  await crearNotificacion(existente.proyecto.creado_por, {
    titulo: "Respuesta a tu reclamación",
    mensaje: `Tu reclamación sobre el proyecto "${existente.proyecto.titulo}" fue respondida: ${respuesta}`,
    enlace: "/proyectos",
  });

  return actualizado;
}
