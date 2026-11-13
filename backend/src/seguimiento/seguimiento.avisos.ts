import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { enviarAvisoSeguimiento } from "../auth/email.service";
import { correoParaCodigoDeFirma } from "../firmas-codigo/firmas-codigo.service";
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
        select: { usuario: { select: { id_usuario: true, nombre: true, apellido: true, correo: true } } },
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
    // El correo llega al correo con el que inicia sesión: el personal de la hoja de vida es solo para las firmas.
    const destino = inv.correo;
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

// ---------------------------------------------------------------------------
// Firma del co-investigador: es personal (solo su cuenta la da), así que el investigador principal le envía la solicitud y a él le
// llega una notificación dentro del sistema y un correo con el enlace para iniciar sesión y firmar.
// ---------------------------------------------------------------------------

/** Título del aviso de firma pendiente: sirve también para borrarlo cuando esa firma se registra. */
export const tituloAvisoFirma = (documento: string) => `Tu firma está pendiente en el ${documento}`;

export async function avisarFirmaSolicitada(
  id_proyecto: number,
  destinatario: number,
  documento: string,
  solicitante: { nombre: string }
): Promise<{ correo_enmascarado: string }> {
  const [proyecto, usuario] = await Promise.all([
    prisma.proyecto.findUnique({ where: { id_proyecto }, select: { titulo: true } }),
    prisma.usuario.findUnique({ where: { id_usuario: destinatario }, select: { nombre: true, apellido: true, correo: true } }),
  ]);
  if (!proyecto || !usuario) throw new AvisoInvalidoError("No se encontró a quien debe firmar.");
  const mensaje = `${solicitante.nombre} te solicitó firmar el ${documento} del proyecto "${proyecto.titulo}". Inicia sesión y fírmalo desde el proyecto en Seguimiento.`;
  await crearNotificacion(destinatario, {
    titulo: tituloAvisoFirma(documento),
    mensaje,
    enlace: `/seguimiento/${id_proyecto}`,
    rol_destino: ROL_INVESTIGADOR,
    tipo_evento: TIPO_NOTIFICACION.INVESTIGADOR_PRESENTAR_INFORME,
    id_proyecto,
  });
  // Como en el acta de inicio, el aviso de una firma llega al correo personal de quien firma (el de su hoja de vida o el de la ficha
  // del proyecto); si no tiene, al de su cuenta.
  const destino = (await correoParaCodigoDeFirma(destinatario, id_proyecto)).correo ?? usuario.correo;
  await correoSeguro(
    () =>
      enviarAvisoSeguimiento(
        destino,
        `${usuario.nombre} ${usuario.apellido}`.trim(),
        `Tu firma está pendiente en el ${documento} — ${proyecto.titulo}`,
        mensaje,
        [
          ["Proyecto", proyecto.titulo],
          ["Documento", documento],
          ["Tu firma", "Co-investigador"],
        ],
        "Iniciar sesión para firmar",
        `${urlApp()}/seguimiento/${id_proyecto}`
      ),
    destino
  );
  const [local, dominio] = destino.split("@");
  return { correo_enmascarado: dominio ? `${local.slice(0, 2)}***@${dominio}` : "" };
}
