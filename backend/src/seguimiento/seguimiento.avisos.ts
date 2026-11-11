import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { enviarAvisoSeguimiento } from "../auth/email.service";
import { ROL_ADMINISTRADOR, ROL_INVESTIGADOR, TIPO_NOTIFICACION, crearNotificacion } from "../notificaciones/notificaciones.service";

// ---------------------------------------------------------------------------
// El Administrador solicita al investigador cada informe (el de avance de un periodo y el informe final): hasta que lo solicita, el
// investigador no puede diligenciarlo ni seguir con el proyecto. Al solicitarlo, el investigador recibe una notificación dentro del
// sistema y un correo.
// ---------------------------------------------------------------------------

export type TipoInformeSolicitado = "avance" | "final";

export class AvisoNoAutorizadoError extends Error {}
export class AvisoInvalidoError extends Error {}

const ROLES_INVESTIGADORES = ["Investigador(a) Principal UNICESMAG", "Co investigador(a) UNICESMAG"];

const urlApp = () => env.FRONTEND_LOGIN_URL.replace(/\/$/, "");

const documentoDe = (tipo: TipoInformeSolicitado, numero?: number) => (tipo === "avance" ? `informe de avance ${numero ?? ""}`.trim() : "informe técnico final");

/** Título del aviso de que se solicitó un informe: sirve también para borrarlo cuando ese informe se radica. */
export const tituloAvisoInforme = (tipo: TipoInformeSolicitado, numero?: number) => `Se te solicitó el ${documentoDe(tipo, numero)}`;

/** Envía el correo sin que un fallo del SMTP rompa la solicitud (la notificación dentro del sistema ya quedó). */
async function correoSeguro(fn: () => Promise<void>, destino: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(`No se pudo enviar el aviso de Seguimiento a ${destino}:`, error);
  }
}

/** Avisa a los investigadores del proyecto (principal y co-investigadores con cuenta) que el Administrador les solicitó un informe. */
export async function avisarInformeSolicitado(
  id_proyecto: number,
  usuario: { id_usuario: number; roles: string[] },
  datos: { tipo: TipoInformeSolicitado; numero?: number }
): Promise<{ notificados: number }> {
  if (datos.tipo !== "avance" && datos.tipo !== "final") throw new AvisoInvalidoError("El tipo de informe no es válido.");
  if (!usuario.roles.includes(ROL_ADMINISTRADOR)) throw new AvisoNoAutorizadoError("Solo el Administrador solicita los informes al investigador.");

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
  const mensaje = `El Administrador te solicitó el ${documento} del proyecto "${proyecto.titulo}". Ya puedes diligenciarlo, firmarlo y radicarlo para poder continuar con el proyecto.`;

  for (const inv of investigadores) {
    await crearNotificacion(inv.id_usuario, {
      titulo: tituloAvisoInforme(datos.tipo, datos.numero),
      mensaje,
      enlace: `/seguimiento/${id_proyecto}`,
      rol_destino: ROL_INVESTIGADOR,
      tipo_evento: TIPO_NOTIFICACION.INVESTIGADOR_PRESENTAR_INFORME,
      id_proyecto,
    });
    // El correo llega al correo personal de la hoja de vida; si no lo tiene, al de la cuenta.
    const destino = inv.hojaVida?.correo_personal?.trim() || inv.correo;
    await correoSeguro(
      () =>
        enviarAvisoSeguimiento(
          destino,
          `${inv.nombre} ${inv.apellido}`.trim(),
          `Se te solicitó el ${documento} — ${proyecto.titulo}`,
          mensaje,
          [
            ["Proyecto", proyecto.titulo],
            ["Informe solicitado", documento],
          ],
          "Diligenciar el informe",
          `${urlApp()}/seguimiento/${id_proyecto}`
        ),
      destino
    );
  }
  return { notificados: investigadores.length };
}
