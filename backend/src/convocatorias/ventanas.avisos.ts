import { prisma } from "../config/prisma";
import { crearNotificacion, ROL_ADMINISTRADOR, ROL_INVESTIGADOR, TIPO_NOTIFICACION } from "../notificaciones/notificaciones.service";
import { FASES_VENTANA, NOMBRE_FASE, type FaseVentana } from "./convocatoria-ventanas.service";

const NOMBRE_ETAPA_POR_FASE: Record<string, string> = { comite: "Comite_Investigacion", etica: "Etica", pares: "Pares" };
const ROL_POR_FASE: Record<string, string> = { comite: "Comité de Investigación", etica: "Comité de Ética", pares: "Par Evaluador" };

const ENLACE_POR_FASE: Record<string, string> = { comite: "/comite-investigacion", etica: "/comite-etica", pares: "/evaluaciones/calificar", reclamaciones: "/proyectos" };

const formatoFecha = (f: Date) => f.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });

/** Proyectos de la convocatoria que quedaron sin revisar en la fase (revisiones abiertas, o reclamaciones sin responder). */
async function pendientesDeLaFase(id_convocatoria: number, fase: FaseVentana): Promise<number> {
  if (fase === "reclamaciones") {
    return prisma.reclamacion.count({ where: { estado: { in: ["pendiente", "en_revision"] }, proyecto: { id_convocatoria } } });
  }
  return prisma.asignacionRevision.count({
    where: { fecha_finalizacion: null, etapa: { nombre: NOMBRE_ETAPA_POR_FASE[fase] }, proyecto: { id_convocatoria } },
  });
}

/** A quién le toca actuar cuando abre la fase: evaluadores con revisiones abiertas, o dueños de proyectos rechazados. */
async function destinatariosDeApertura(id_convocatoria: number, fase: FaseVentana): Promise<number[]> {
  if (fase === "reclamaciones") {
    const proyectos = await prisma.proyecto.findMany({
      where: { id_convocatoria, estado_actual: { in: ["rechazado", "no_cumple"] }, es_historico: false },
      select: { creado_por: true },
    });
    return [...new Set(proyectos.map((p) => p.creado_por))];
  }
  const asignaciones = await prisma.asignacionRevision.findMany({
    where: { fecha_finalizacion: null, asignado_a: { not: null }, etapa: { nombre: NOMBRE_ETAPA_POR_FASE[fase] }, proyecto: { id_convocatoria } },
    select: { asignado_a: true },
  });
  return [...new Set(asignaciones.map((a) => a.asignado_a as number))];
}

/**
 * Avisa las ventanas que ya abrieron o cerraron y aún no se habían avisado (cada aviso se manda una sola vez; al cambiar
 * las fechas de una fase se vuelve a avisar). Apertura: a quien le toca actuar. Cierre: a los Administradores, con cuántos
 * proyectos quedaron sin revisar y que pueden reabrirla.
 */
export async function procesarAvisosVentanas(ahora: Date = new Date()): Promise<void> {
  const porAbrir = await prisma.convocatoriaVentana.findMany({
    where: { avisado_apertura: false, abre_en: { lte: ahora }, cierra_en: { gt: ahora } },
    include: { convocatoria: { select: { nombre: true } } },
  });
  for (const v of porAbrir) {
    const fase = v.fase as FaseVentana;
    if (!FASES_VENTANA.includes(fase)) continue;
    // Se marca primero: si algo falla al notificar, mejor perder un aviso que repetirlo cada minuto.
    await prisma.convocatoriaVentana.update({
      where: { id_convocatoria_fase: { id_convocatoria: v.id_convocatoria, fase: v.fase } },
      data: { avisado_apertura: true },
    });
    const destinatarios = await destinatariosDeApertura(v.id_convocatoria, fase);
    await Promise.all(
      destinatarios.map((id_usuario) =>
        crearNotificacion(id_usuario, {
          titulo: `Se abrió el plazo de ${NOMBRE_FASE[fase]}`,
          mensaje: `En la convocatoria "${v.convocatoria.nombre}", ${NOMBRE_FASE[fase]} está habilitado hasta el ${formatoFecha(v.cierra_en)}.`,
          enlace: ENLACE_POR_FASE[fase],
          rol_destino: fase === "reclamaciones" ? ROL_INVESTIGADOR : ROL_POR_FASE[fase],
          tipo_evento: TIPO_NOTIFICACION.INFORMATIVA,
        })
      )
    );
  }

  const porCerrar = await prisma.convocatoriaVentana.findMany({
    where: { avisado_cierre: false, cierra_en: { lte: ahora }, reabierta: false },
    include: { convocatoria: { select: { nombre: true } } },
  });
  if (porCerrar.length === 0) return;
  const administradores = await prisma.usuario.findMany({
    where: { activo: true, roles: { some: { rol: { nombre: ROL_ADMINISTRADOR } } } },
    select: { id_usuario: true },
  });
  for (const v of porCerrar) {
    const fase = v.fase as FaseVentana;
    if (!FASES_VENTANA.includes(fase)) continue;
    await prisma.convocatoriaVentana.update({
      where: { id_convocatoria_fase: { id_convocatoria: v.id_convocatoria, fase: v.fase } },
      data: { avisado_cierre: true },
    });
    const pendientes = await pendientesDeLaFase(v.id_convocatoria, fase);
    const resumen =
      pendientes === 0
        ? "No quedó nada pendiente."
        : fase === "reclamaciones"
          ? `Quedan ${pendientes} reclamación(es) sin responder.`
          : `Quedan ${pendientes} proyecto(s) sin revisar.`;
    await Promise.all(
      administradores.map((a) =>
        crearNotificacion(a.id_usuario, {
          titulo: `Cerró el plazo de ${NOMBRE_FASE[fase]}`,
          mensaje: `Convocatoria "${v.convocatoria.nombre}": ${resumen} Puedes reabrir el plazo desde la convocatoria.`,
          enlace: "/convocatorias",
          rol_destino: ROL_ADMINISTRADOR,
          tipo_evento: TIPO_NOTIFICACION.INFORMATIVA,
        })
      )
    );
  }
}

const CADA_MS = 60 * 1000;

/** Revisa cada minuto si alguna ventana abrió o cerró. Un fallo se registra y no detiene el servidor. */
export function iniciarProgramadorVentanas(): void {
  const tick = () => procesarAvisosVentanas().catch((e) => console.error("Avisos de ventanas de revisión:", e));
  setInterval(tick, CADA_MS).unref();
  tick();
}
