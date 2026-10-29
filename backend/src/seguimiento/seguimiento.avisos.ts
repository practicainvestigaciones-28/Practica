import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { enviarAvisoSeguimiento } from "../auth/email.service";
import { ROL_ADMINISTRADOR, ROL_INVESTIGADOR, TIPO_NOTIFICACION, crearNotificacion, resolverNotificaciones } from "../notificaciones/notificaciones.service";

// ---------------------------------------------------------------------------
// Avisos de las solicitudes de informes. El investigador solicita el informe de avance de un periodo o el informe final; el
// Administrador los habilita o los rechaza, y hasta entonces el investigador no puede diligenciarlos ni seguir con el
// proyecto. Cada paso se avisa dentro del sistema (notificación con el rol que corresponde) y por correo.
// ---------------------------------------------------------------------------

export type TipoInformeSolicitado = "avance" | "final";
export type EventoSolicitudInforme = "solicitada" | "habilitada" | "rechazada";

export class AvisoNoAutorizadoError extends Error {}
export class AvisoInvalidoError extends Error {}

const ROLES_INVESTIGADORES = ["Investigador(a) Principal UNICESMAG", "Co investigador(a) UNICESMAG"];

const urlApp = () => env.FRONTEND_LOGIN_URL.replace(/\/$/, "");

const documentoDe = (tipo: TipoInformeSolicitado, numero?: number) => (tipo === "avance" ? `informe de avance ${numero ?? ""}`.trim() : "informe técnico final");

/** Envía el correo sin que un fallo del SMTP rompa la solicitud (la notificación dentro del sistema ya quedó). */
async function correoSeguro(fn: () => Promise<void>, destino: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(`No se pudo enviar el aviso de Seguimiento a ${destino}:`, error);
  }
}

export async function avisarSolicitudInforme(
  id_proyecto: number,
  usuario: { id_usuario: number; roles: string[] },
  datos: { tipo: TipoInformeSolicitado; numero?: number; evento: EventoSolicitudInforme; observacion?: string }
): Promise<{ notificados: number }> {
  if (datos.tipo !== "avance" && datos.tipo !== "final") throw new AvisoInvalidoError("El tipo de informe no es válido.");
  if (!["solicitada", "habilitada", "rechazada"].includes(datos.evento)) throw new AvisoInvalidoError("El evento no es válido.");

  const proyecto = await prisma.proyecto.findUnique({
    where: { id_proyecto },
    select: {
      titulo: true,
      participantes: {
        where: { rolProyecto: { nombre: { in: ROLES_INVESTIGADORES } }, usuario: { isNot: null } },
        select: { usuario: { select: { id_usuario: true, nombre: true, apellido: true, correo: true, hojaVida: { select: { correo_personal: true } } } } },
      },
    },
  });
  if (!proyecto) throw new AvisoInvalidoError("El proyecto no existe.");
  const investigadores = proyecto.participantes.flatMap((p) => (p.usuario ? [p.usuario] : []));
  const documento = documentoDe(datos.tipo, datos.numero);
  const esAdmin = usuario.roles.includes(ROL_ADMINISTRADOR);

  if (datos.evento === "solicitada") {
    // Solo un investigador del proyecto solicita el informe; el aviso va a todos los Administradores.
    const solicitante = investigadores.find((i) => i.id_usuario === usuario.id_usuario);
    if (!solicitante) throw new AvisoNoAutorizadoError("Solo los investigadores del proyecto solicitan sus informes.");
    const nombre = `${solicitante.nombre} ${solicitante.apellido}`.trim();
    const administradores = await prisma.usuario.findMany({
      where: { activo: true, roles: { some: { rol: { nombre: ROL_ADMINISTRADOR } } } },
      select: { id_usuario: true, nombre: true, apellido: true, correo: true },
    });
    const mensaje = `${nombre} solicitó el ${documento} del proyecto "${proyecto.titulo}". Habilítalo o recházalo para que pueda diligenciarlo y continuar con el proyecto.`;
    for (const admin of administradores) {
      await crearNotificacion(admin.id_usuario, {
        titulo: `Solicitud del ${documento}`,
        mensaje,
        enlace: "/seguimiento/bandejas",
        rol_destino: ROL_ADMINISTRADOR,
        tipo_evento: TIPO_NOTIFICACION.ADMIN_HABILITAR_INFORME,
        id_proyecto,
      });
      await correoSeguro(
        () =>
          enviarAvisoSeguimiento(
            admin.correo,
            `${admin.nombre} ${admin.apellido}`.trim(),
            `Solicitud del ${documento} — ${proyecto.titulo}`,
            `Un investigador solicitó un informe de Seguimiento y espera tu respuesta para poder continuar con el proyecto.`,
            [
              ["Proyecto", proyecto.titulo],
              ["Informe solicitado", documento],
              ["Solicitado por", nombre],
            ],
            "Revisar la solicitud",
            `${urlApp()}/seguimiento/bandejas`
          ),
        admin.correo
      );
    }
    return { notificados: administradores.length };
  }

  // Habilitar o rechazar: solo el Administrador, y el aviso va a los investigadores del proyecto.
  if (!esAdmin) throw new AvisoNoAutorizadoError("Solo el Administrador habilita o rechaza los informes solicitados.");
  await resolverNotificaciones(id_proyecto, [TIPO_NOTIFICACION.ADMIN_HABILITAR_INFORME]);
  const habilitada = datos.evento === "habilitada";
  const mensaje = habilitada
    ? `El Administrador habilitó el ${documento} del proyecto "${proyecto.titulo}". Ya puedes diligenciarlo.`
    : `El Administrador rechazó la solicitud del ${documento} del proyecto "${proyecto.titulo}"${datos.observacion?.trim() ? `: ${datos.observacion.trim()}` : "."} Puedes volver a solicitarlo.`;
  for (const inv of investigadores) {
    await crearNotificacion(inv.id_usuario, {
      titulo: habilitada ? `${documento[0].toUpperCase()}${documento.slice(1)} habilitado` : `Solicitud del ${documento} rechazada`,
      mensaje,
      enlace: `/seguimiento/${id_proyecto}`,
      rol_destino: ROL_INVESTIGADOR,
      tipo_evento: TIPO_NOTIFICACION.INFORMATIVA,
      id_proyecto,
    });
    const destino = inv.hojaVida?.correo_personal?.trim() || inv.correo;
    await correoSeguro(
      () =>
        enviarAvisoSeguimiento(
          destino,
          `${inv.nombre} ${inv.apellido}`.trim(),
          `${habilitada ? "Informe habilitado" : "Solicitud rechazada"}: ${documento} — ${proyecto.titulo}`,
          mensaje,
          [
            ["Proyecto", proyecto.titulo],
            ["Informe", documento],
          ],
          habilitada ? "Diligenciar el informe" : "Ver el proyecto",
          `${urlApp()}/seguimiento/${id_proyecto}`
        ),
      destino
    );
  }
  return { notificados: investigadores.length };
}
