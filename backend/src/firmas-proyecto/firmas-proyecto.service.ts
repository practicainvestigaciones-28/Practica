import crypto from "node:crypto";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { enviarCodigoFirmaActa, enviarSolicitudFirmaProyecto } from "../auth/email.service";
import {
  CODIGO_INTERVALO_SEG,
  CODIGO_MAX_INTENTOS,
  CODIGO_VIGENCIA_MIN,
  CodigoFirmaEsperaError,
  CodigoFirmaInvalidoError,
  CorreoPersonalFaltanteError,
  coincideCodigo,
  consumirVerificacionFirma,
  enmascararCorreoFirma,
  generarCodigo,
  hashCodigoFirma,
  limpiarCodigo,
} from "../firmas-codigo/firmas-codigo.service";
import { verificarPermisoProyecto, ProyectoNoEncontradoError } from "../utils/permisosProyecto";

export { ProyectoNoEncontradoError };

// Nombres tal como están sembrados en RolProyecto (ver seed.ts) — deben
// coincidir exactamente, no hay columna "requiere_firma"/"bloquea" en ese
// catálogo todavía.
const ROL_PRINCIPAL = "Investigador(a) Principal UNICESMAG";
const ROL_COINVESTIGADOR_UNICESMAG = "Co investigador(a) UNICESMAG";
const ROL_ESTUDIANTE = "Estudiante Investigador(a)";
const ROLES_OBLIGATORIOS = [ROL_PRINCIPAL, ROL_COINVESTIGADOR_UNICESMAG] as const;

const VIGENCIA_DIAS = 7;

export class EnlaceFirmaProyectoInvalidoError extends Error {
  constructor(mensaje = "El enlace no es válido o ya no está vigente") {
    super(mensaje);
  }
}

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

interface ParticipanteParaFirma {
  id_usuarioproyecto: number;
  usuario: { nombre: string; apellido: string; correo: string } | null;
  nombre_manual: string | null;
  apellido_manual: string | null;
  correo_manual: string | null;
  rolProyecto: { nombre: string };
}

function nombreYCorreoDe(p: ParticipanteParaFirma): { nombre: string; correo: string | null } {
  if (p.usuario) return { nombre: `${p.usuario.nombre} ${p.usuario.apellido}`.trim(), correo: p.usuario.correo };
  const nombre = [p.nombre_manual, p.apellido_manual].filter(Boolean).join(" ").trim();
  return { nombre: nombre || "—", correo: p.correo_manual };
}

async function hayObligatoriaPendiente(id_proyecto: number): Promise<boolean> {
  // Solo cuentan las firmas VINCULADAS a un participante actual — una
  // huérfana (de un participante que se quitó del proyecto en una edición)
  // no debe seguir bloqueando el paso al líder.
  const count = await prisma.firmaProyecto.count({
    where: { id_proyecto, obligatoria: true, firmado: false, id_usuarioproyecto: { not: null } },
  });
  return count > 0;
}

/** Correo al que llegan el enlace y el código de una firma: el personal de la hoja de vida si el firmante tiene cuenta; si no, el capturado. */
async function correoDeFirma(firma: { id_usuarioproyecto?: number | null; correo: string | null }): Promise<string | null> {
  if (firma.id_usuarioproyecto) {
    const p = await prisma.usuarioProyecto.findUnique({
      where: { id_usuarioproyecto: firma.id_usuarioproyecto },
      select: { usuario: { select: { hojaVida: { select: { correo_personal: true } } } } },
    });
    if (p?.usuario) return p.usuario.hojaVida?.correo_personal?.trim() || null;
  }
  return firma.correo;
}

/** Genera el token, lo guarda (solo el hash) y manda el correo con el enlace de esa firma puntual. */
async function enviarSolicitud(
  firma: { id_firma: number; id_usuarioproyecto?: number | null; nombre: string; correo: string | null; rol_firmante: string },
  proyecto: { titulo: string; convocatoria: { nombre: string } }
): Promise<void> {
  // El enlace llega al correo personal de la hoja de vida de quien tiene cuenta; quien no la tiene (externo) solo tiene
  // el correo con que lo registraron.
  const destino = await correoDeFirma(firma);
  if (!destino) {
    console.warn(`[firmas-proyecto] ${firma.rol_firmante} "${firma.nombre}" no tiene correo personal: no se envió el enlace de firma.`);
    return;
  }
  const token = crypto.randomBytes(32).toString("hex");
  const vence = new Date(Date.now() + VIGENCIA_DIAS * 24 * 60 * 60 * 1000);
  await prisma.firmaProyecto.update({
    where: { id_firma: firma.id_firma },
    data: { token_hash: hashToken(token), token_expira: vence, fecha_envio: new Date() },
  });
  const enlace = `${env.FRONTEND_FIRMA_PROYECTO_URL.replace(/\/$/, "")}/${token}`;
  try {
    await enviarSolicitudFirmaProyecto(destino, firma.nombre, firma.rol_firmante, enlace, vence, {
      titulo: proyecto.titulo,
      convocatoria: proyecto.convocatoria.nombre,
    });
  } catch (error) {
    console.error(`No se pudo enviar la solicitud de firma de proyecto a ${destino}:`, error);
  }
}

export async function obtenerEstadoFirmas(id_proyecto: number) {
  const firmas = await prisma.firmaProyecto.findMany({
    // Una huérfana (ver iniciarFirmas) es un detalle interno para no perder
    // el progreso al re-emparejar — nunca se muestra como si fuera la firma
    // de un participante actual.
    where: { id_proyecto, id_usuarioproyecto: { not: null } },
    orderBy: { id_firma: "asc" },
    select: {
      id_firma: true,
      id_usuarioproyecto: true,
      nombre: true,
      correo: true,
      rol_firmante: true,
      obligatoria: true,
      firmado: true,
      fecha_firma: true,
      fecha_envio: true,
    },
  });
  return { firmas };
}

/**
 * Se dispara cuando el Investigador(a) Principal confirma su propia firma al
 * terminar de diligenciar el proyecto (botón "Hacer clic para firmar" en
 * Firmas y anexos), y también en CADA guardado posterior de un proyecto ya
 * existente ("Guardar cambios" en edición) — así que, a diferencia de la
 * versión anterior, NO es un "crear una sola vez y listo": el formulario no
 * tiene manera de "actualizar" un participante, así que cada guardado borra
 * todos los UsuarioProyecto y los vuelve a crear desde cero (con un
 * id_usuarioproyecto nuevo). Esa recreación desvincula (SetNull, no
 * Cascade — ver schema.prisma) la FirmaProyecto de cada uno, dejándola
 * "huérfana" en vez de borrarla.
 *
 * Por cada participante actual se busca primero si ya tiene una firma
 * vinculada (nada que hacer); si no, se busca una huérfana con el MISMO
 * correo+rol — si existe, se re-vincula conservando firmado/fecha_firma/
 * token (no se le vuelve a pedir la firma a quien ya firmó solo por guardar
 * otro cambio del formulario); si no hay huérfana que calce, es un
 * participante nuevo (o alguien cuyo correo cambió a propósito) y se crea
 * una firma en blanco.
 *
 * Los demás participantes NO reciben su correo aquí todavía: los que firman
 * en paralelo (externo, egresado) sí se mandan de una vez si es la primera
 * vez (nunca se les envió), pero quien BLOQUEA (Co-investigador(a)
 * UNICESMAG) espera un paso explícito del Principal (ver
 * enviarFirmaPendienteObligatoria) — así puede revisar que el correo
 * capturado sea el correcto antes de disparar el enlace.
 *
 * Los estudiantes no entran aquí: su compromiso ya queda cubierto por el
 * Acta de compromiso que se anexa como documento, no por una firma digital.
 */
export async function iniciarFirmas(id_proyecto: number, usuarioQueEdita: { id_usuario: number; roles: string[] }) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  const proyecto = await prisma.proyecto.findUnique({
    where: { id_proyecto },
    include: { convocatoria: { select: { nombre: true } } },
  });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  const participantes = await prisma.usuarioProyecto.findMany({
    where: { id_proyecto, rolProyecto: { nombre: { not: ROL_ESTUDIANTE } } },
    include: { usuario: { select: { nombre: true, apellido: true, correo: true } }, rolProyecto: { select: { nombre: true } } },
  });

  const huerfanas = await prisma.firmaProyecto.findMany({ where: { id_proyecto, id_usuarioproyecto: null } });
  const huerfanasUsadas = new Set<number>();

  // La firma del Principal es inmediata: quien la hace comprobó antes el código enviado a su correo personal. Solo se exige
  // cuando se crea (cada guardado posterior vuelve a llamar a esta función y no repite la firma).
  let firmaPrincipalNueva = false;
  for (const p of participantes) {
    if (p.rolProyecto.nombre !== ROL_PRINCIPAL) continue;
    const vinculada = await prisma.firmaProyecto.findUnique({ where: { id_usuarioproyecto: p.id_usuarioproyecto } });
    if (!vinculada && !huerfanas.some((h) => h.rol_firmante === p.rolProyecto.nombre && h.correo === nombreYCorreoDe(p).correo)) {
      firmaPrincipalNueva = true;
    }
  }
  if (firmaPrincipalNueva) await consumirVerificacionFirma(usuarioQueEdita.id_usuario, [id_proyecto, 0]);

  for (const p of participantes) {
    const yaVinculada = await prisma.firmaProyecto.findUnique({ where: { id_usuarioproyecto: p.id_usuarioproyecto } });
    if (yaVinculada) continue;

    const { nombre, correo } = nombreYCorreoDe(p);
    const esPrincipal = p.rolProyecto.nombre === ROL_PRINCIPAL;

    const huerfana = huerfanas.find(
      (h) => !huerfanasUsadas.has(h.id_firma) && h.rol_firmante === p.rolProyecto.nombre && h.correo === correo
    );
    if (huerfana) {
      huerfanasUsadas.add(huerfana.id_firma);
      await prisma.firmaProyecto.update({
        where: { id_firma: huerfana.id_firma },
        data: { id_usuarioproyecto: p.id_usuarioproyecto, nombre },
      });
      continue;
    }

    await prisma.firmaProyecto.create({
      data: {
        id_proyecto,
        id_usuarioproyecto: p.id_usuarioproyecto,
        nombre,
        correo,
        rol_firmante: p.rolProyecto.nombre,
        obligatoria: (ROLES_OBLIGATORIOS as readonly string[]).includes(p.rolProyecto.nombre),
        // El Principal está autenticado ahí mismo: su firma queda registrada
        // al instante, sin necesitar un correo con enlace.
        firmado: esPrincipal,
        fecha_firma: esPrincipal ? new Date() : null,
      },
    });
  }

  // Las huérfanas que no se reutilizaron son de participantes que ya no
  // están en el proyecto (se quitaron en una edición) — no sirven de nada
  // dejarlas ahí y, si eran obligatorias, bloquearían el paso al líder.
  const huerfanasSobrantes = huerfanas.filter((h) => !huerfanasUsadas.has(h.id_firma));
  if (huerfanasSobrantes.length > 0) {
    await prisma.firmaProyecto.deleteMany({ where: { id_firma: { in: huerfanasSobrantes.map((h) => h.id_firma) } } });
  }

  // Solo los que firman EN PARALELO (no bloquean nada) y nunca se les envió
  // nada todavía: externo, egresado. El/los obligatorio(s) distinto(s) del
  // Principal (Co-investigador(a) UNICESMAG) se mandan aparte, con
  // enviarFirmaPendienteObligatoria.
  const pendientesParalelo = await prisma.firmaProyecto.findMany({
    where: { id_proyecto, firmado: false, obligatoria: false, fecha_envio: null },
  });
  for (const f of pendientesParalelo) await enviarSolicitud(f, proyecto);

  // Si nadie más tiene firma obligatoria pendiente (no hay Co-investigador(a)
  // UNICESMAG en este proyecto), pasa directo al líder. Si sí hay alguien
  // obligatorio pendiente, queda esperando a que se le envíe y firme.
  //
  // Esto SOLO debe tocar estado_actual mientras el proyecto está realmente
  // en la fase de firmas (recién creado, con estado_actual todavía en el
  // valor por defecto "pendiente_lider", o ya en "pendiente_firmas"). Esta
  // función se vuelve a llamar en CADA guardado posterior de la edición —
  // si para entonces el proyecto ya avanzó a otra fase (ej. "revision" por
  // un reenvío de correcciones, "aprobado_con_correcciones", "aprobado"...),
  // no hay que pisarla: solo se mantienen al día las filas de FirmaProyecto.
  const proyectoActual = await prisma.proyecto.findUnique({ where: { id_proyecto }, select: { estado_actual: true } });
  if (proyectoActual?.estado_actual === "pendiente_lider" || proyectoActual?.estado_actual === "pendiente_firmas") {
    const siguePendiente = await hayObligatoriaPendiente(id_proyecto);
    await prisma.proyecto.update({
      where: { id_proyecto },
      data: { estado_actual: siguePendiente ? "pendiente_firmas" : "pendiente_lider" },
    });
  }

  return obtenerEstadoFirmas(id_proyecto);
}

/**
 * El Investigador(a) Principal dispara el envío del enlace a quien todavía
 * le falta firmar y SÍ bloquea (Co-investigador(a) UNICESMAG) — paso
 * explícito y separado de iniciarFirmas para que pueda revisar el correo
 * capturado antes de mandar el enlace. También sirve para REENVIAR (botón
 * "Reenviar firma al co-investigador" en el frontend): no se filtra por
 * fecha_envio, así que un segundo llamado genera un token nuevo y manda el
 * correo de nuevo (el enlace viejo deja de servir, ver enviarSolicitud). No
 * hace nada (sin error) si no hay nadie pendiente: ya firmó, o este
 * proyecto no tiene ese rol.
 */
export async function enviarFirmaPendienteObligatoria(
  id_proyecto: number,
  usuarioQueEdita: { id_usuario: number; roles: string[] }
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  const proyecto = await prisma.proyecto.findUnique({
    where: { id_proyecto },
    include: { convocatoria: { select: { nombre: true } } },
  });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  const pendientes = await prisma.firmaProyecto.findMany({
    where: {
      id_proyecto,
      obligatoria: true,
      firmado: false,
      rol_firmante: { not: ROL_PRINCIPAL },
      id_usuarioproyecto: { not: null },
    },
  });
  for (const f of pendientes) await enviarSolicitud(f, proyecto);

  return obtenerEstadoFirmas(id_proyecto);
}

/** GET /proyectos/:id/firmas — el dueño del proyecto o un Administrador consultan quién falta por firmar. */
export async function listarFirmas(id_proyecto: number, usuarioQueEdita: { id_usuario: number; roles: string[] }) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  return obtenerEstadoFirmas(id_proyecto);
}

async function firmaDeEnlace(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new EnlaceFirmaProyectoInvalidoError();
  const firma = await prisma.firmaProyecto.findUnique({
    where: { token_hash: hashToken(token) },
    include: { proyecto: { select: { id_proyecto: true, titulo: true, estado_actual: true } } },
  });
  if (!firma) throw new EnlaceFirmaProyectoInvalidoError();
  if (!firma.firmado && firma.token_expira && firma.token_expira < new Date()) {
    throw new EnlaceFirmaProyectoInvalidoError("El enlace de firma venció. Pide al investigador que reenvíe la solicitud.");
  }
  return firma;
}

export interface InfoFirmaProyectoEnlace {
  titulo: string;
  nombre: string;
  rol_firmante: string;
  ya_firmado: boolean;
  correo_enmascarado: string | null;
}

/** GET /firmar-proyecto/:token (público) — a quién corresponde el enlace; la firma se confirma con un código de verificación. */
export async function infoFirmaPorEnlace(token: string): Promise<InfoFirmaProyectoEnlace> {
  const firma = await firmaDeEnlace(token);
  return {
    titulo: firma.proyecto.titulo,
    nombre: firma.nombre,
    rol_firmante: firma.rol_firmante,
    ya_firmado: firma.firmado,
    correo_enmascarado: enmascararCorreoFirma(await correoDeFirma(firma)),
  };
}

/** POST /firmar-proyecto/:token/codigo (público) — envía el código de verificación al correo personal de quien firma. */
export async function solicitarCodigoPorEnlace(token: string): Promise<{ correo_enmascarado: string; vence_en_minutos: number }> {
  const firma = await firmaDeEnlace(token);
  if (firma.firmado) throw new CodigoFirmaInvalidoError("Esta firma ya está registrada.");
  const correo = await correoDeFirma(firma);
  if (!correo) throw new CorreoPersonalFaltanteError();
  const espera = Math.ceil(((firma.codigo_enviado?.getTime() ?? 0) + CODIGO_INTERVALO_SEG * 1000 - Date.now()) / 1000);
  if (espera > 0) throw new CodigoFirmaEsperaError(`Espera ${espera} segundos antes de pedir otro código.`);

  const codigo = generarCodigo();
  await prisma.firmaProyecto.update({
    where: { id_firma: firma.id_firma },
    data: {
      codigo_hash: hashCodigoFirma(-firma.id_firma, firma.id_proyecto, codigo),
      codigo_expira: new Date(Date.now() + CODIGO_VIGENCIA_MIN * 60 * 1000),
      codigo_enviado: new Date(),
      codigo_intentos: 0,
    },
  });
  try {
    await enviarCodigoFirmaActa(correo, firma.nombre, codigo, CODIGO_VIGENCIA_MIN, firma.proyecto.titulo, "registro del proyecto");
  } catch (error) {
    console.error(`No se pudo enviar el código de firma a ${correo}:`, error);
    throw new CodigoFirmaEsperaError("No se pudo enviar el código al correo personal. Intenta de nuevo en unos minutos.");
  }
  return { correo_enmascarado: enmascararCorreoFirma(correo) ?? "", vence_en_minutos: CODIGO_VIGENCIA_MIN };
}

/** POST /firmar-proyecto/:token (público, sin sesión) — firma con el enlace del correo y el código de verificación. */
export async function firmarPorEnlace(
  token: string,
  codigo?: string
): Promise<{ nombre: string; rol_firmante: string; titulo: string; ya_firmado: boolean }> {
  const firma = await firmaDeEnlace(token);

  const yaFirmado = firma.firmado;
  if (!yaFirmado) {
    const limpio = limpiarCodigo(codigo);
    if (!limpio) throw new CodigoFirmaInvalidoError("Escribe el código de verificación que llegó a tu correo personal.");
    if (!firma.codigo_hash || !firma.codigo_expira) throw new CodigoFirmaInvalidoError("Primero solicita el código de verificación.");
    if (firma.codigo_expira < new Date()) throw new CodigoFirmaInvalidoError("El código venció. Solicita uno nuevo.");
    if (firma.codigo_intentos >= CODIGO_MAX_INTENTOS) throw new CodigoFirmaInvalidoError("Se agotaron los intentos. Solicita un código nuevo.");
    if (!coincideCodigo(firma.codigo_hash, hashCodigoFirma(-firma.id_firma, firma.id_proyecto, limpio))) {
      await prisma.firmaProyecto.update({ where: { id_firma: firma.id_firma }, data: { codigo_intentos: { increment: 1 } } });
      throw new CodigoFirmaInvalidoError("El código no es correcto.");
    }

    await prisma.firmaProyecto.update({
      where: { id_firma: firma.id_firma },
      data: { firmado: true, fecha_firma: new Date(), codigo_hash: null, codigo_expira: null },
    });

    if (firma.obligatoria && firma.proyecto.estado_actual === "pendiente_firmas") {
      const siguePendiente = await hayObligatoriaPendiente(firma.id_proyecto);
      if (!siguePendiente) {
        await prisma.proyecto.update({ where: { id_proyecto: firma.id_proyecto }, data: { estado_actual: "pendiente_lider" } });
      }
    }
  }

  return { nombre: firma.nombre, rol_firmante: firma.rol_firmante, titulo: firma.proyecto.titulo, ya_firmado: yaFirmado };
}
