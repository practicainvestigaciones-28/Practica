import crypto from "node:crypto";
import { prisma } from "../config/prisma";
import { enviarCodigoFirmaActa } from "../auth/email.service";

// Firma electrónica del Par Evaluador sobre su calificación. Mismo esquema
// que la firma del proyecto (firmas-proyecto.service.ts): código de 6 dígitos
// al correo, de un solo uso, con vencimiento e intentos limitados; al
// verificarlo queda la evidencia (ID de transacción + hash de lo firmado).
// Solo con la firma verificada se puede enviar la calificación, y lo enviado
// debe ser exactamente lo que se firmó (ver verificarFirmaParaEnviar).

const CODIGO_VIGENCIA_MIN = 10;
const CODIGO_INTERVALO_SEG = 30;
const CODIGO_MAX_INTENTOS = 5;
const DOCUMENTO_CODIGO = "formulario de calificación";

export class FirmaParNoDisponibleError extends Error {}
export class CodigoFirmaParInvalidoError extends Error {}
export class FirmaParRequeridaError extends Error {
  constructor(mensaje = "Firma la calificación con el código de verificación antes de enviarla.") {
    super(mensaje);
  }
}

export interface EvidenciaFirmaPar {
  ip: string | null;
  agente: string | null;
}

/** Lo que el par firma: su puntaje total y el texto de la rúbrica con las observaciones. */
export interface CalificacionFirmada {
  puntaje: number;
  comentarios: string;
}

const hashCodigo = (id_firma_par: number, codigo: string) =>
  crypto.createHash("sha256").update(`par:${id_firma_par}:${codigo}`).digest("hex");

function enmascararCorreo(correo: string): string {
  const [local, dominio] = correo.split("@");
  return dominio ? `${local.slice(0, 2)}***@${dominio}` : correo;
}

/**
 * Huella de lo firmado. El JSON se arma siempre con las mismas claves y en el
 * mismo orden, para poder recalcularla al enviar y comprobar que no cambió.
 */
function hashCalificacion(
  firma: { id_transaccion: string; fecha_firma: Date; id_proyecto: number; id_etapa: number; id_usuario: number; correo_verificacion: string | null },
  calificacion: CalificacionFirmada
): string {
  const documento = {
    id_transaccion: firma.id_transaccion,
    fecha_firma: firma.fecha_firma.toISOString(),
    firmante: { id_usuario: firma.id_usuario, rol: "Par Evaluador", correo_verificacion: firma.correo_verificacion },
    evaluacion: { id_proyecto: firma.id_proyecto, id_etapa: firma.id_etapa },
    calificacion: { puntaje: Number(calificacion.puntaje), comentarios: calificacion.comentarios.trim() },
  };
  return crypto.createHash("sha256").update(JSON.stringify(documento)).digest("hex");
}

/** Solo el par con la revisión abierta de ese proyecto en la etapa Pares puede firmar. */
async function verificarParAsignado(id_proyecto: number, id_etapa: number, id_usuario: number) {
  const etapa = await prisma.etapa.findUnique({ where: { id_etapa } });
  if (!etapa || etapa.nombre !== "Pares") throw new FirmaParNoDisponibleError("Esta firma solo aplica a la calificación de Pares.");
  const asignacion = await prisma.asignacionRevision.findFirst({
    where: { id_proyecto, id_etapa, asignado_a: id_usuario, fecha_finalizacion: null },
  });
  if (!asignacion) throw new FirmaParNoDisponibleError("No tienes una calificación pendiente de este proyecto.");
}

/** La firma en curso del par: la última que todavía no está ligada a una calificación enviada. */
function firmaEnCurso(id_proyecto: number, id_etapa: number, id_usuario: number) {
  return prisma.firmaEvaluacionPar.findFirst({
    where: { id_proyecto, id_etapa, id_usuario, id_evaluacion: null },
    orderBy: { id_firma_par: "desc" },
  });
}

/**
 * POST /proyectos/:id/etapas/:idEtapa/firma-par/codigo — manda el código al
 * correo personal de la Hoja de Vida del par (o al de su cuenta si no tiene).
 * Pedir un código nuevo descarta una firma anterior que no se alcanzó a enviar.
 */
export async function solicitarCodigoFirmaPar(id_proyecto: number, id_etapa: number, id_usuario: number) {
  await verificarParAsignado(id_proyecto, id_etapa, id_usuario);

  const [usuario, hojaVida, proyecto] = await Promise.all([
    prisma.usuario.findUnique({ where: { id_usuario }, select: { nombre: true, apellido: true, correo: true } }),
    prisma.hojaVida.findUnique({ where: { id_usuario }, select: { correo_personal: true } }),
    prisma.proyecto.findUnique({ where: { id_proyecto }, select: { titulo: true } }),
  ]);
  const correo = hojaVida?.correo_personal?.trim() || usuario?.correo?.trim();
  if (!usuario || !correo) throw new FirmaParNoDisponibleError("Tu cuenta no tiene un correo para recibir el código.");

  let firma = await firmaEnCurso(id_proyecto, id_etapa, id_usuario);
  const ultimo = firma?.codigo_enviado?.getTime() ?? 0;
  const espera = Math.ceil((ultimo + CODIGO_INTERVALO_SEG * 1000 - Date.now()) / 1000);
  if (espera > 0) throw new FirmaParNoDisponibleError(`Espera ${espera} segundos antes de pedir otro código.`);

  if (!firma) firma = await prisma.firmaEvaluacionPar.create({ data: { id_proyecto, id_etapa, id_usuario } });

  const codigo = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  await prisma.firmaEvaluacionPar.update({
    where: { id_firma_par: firma.id_firma_par },
    data: {
      correo_verificacion: correo,
      codigo_hash: hashCodigo(firma.id_firma_par, codigo),
      codigo_expira: new Date(Date.now() + CODIGO_VIGENCIA_MIN * 60 * 1000),
      codigo_enviado: new Date(),
      codigo_intentos: 0,
      // Una firma nueva reemplaza la anterior (por ejemplo si cambió la calificación).
      firmado: false,
      fecha_firma: null,
      id_transaccion: null,
      hash_firma: null,
    },
  });
  try {
    await enviarCodigoFirmaActa(
      correo,
      `${usuario.nombre} ${usuario.apellido}`.trim(),
      codigo,
      CODIGO_VIGENCIA_MIN,
      proyecto?.titulo ?? "",
      DOCUMENTO_CODIGO
    );
  } catch (error) {
    console.error(`No se pudo enviar el código de firma del par a ${correo}:`, error);
    throw new FirmaParNoDisponibleError("No se pudo enviar el código al correo. Intenta de nuevo en unos minutos.");
  }
  return { correo_enmascarado: enmascararCorreo(correo), vence_en_minutos: CODIGO_VIGENCIA_MIN };
}

/**
 * POST /proyectos/:id/etapas/:idEtapa/firma-par — valida el código y firma la
 * calificación que el par tiene en pantalla. Con eso se habilita "Guardar datos".
 */
export async function firmarCalificacionPar(
  id_proyecto: number,
  id_etapa: number,
  id_usuario: number,
  codigo: string | undefined,
  calificacion: CalificacionFirmada,
  evidencia: EvidenciaFirmaPar
) {
  await verificarParAsignado(id_proyecto, id_etapa, id_usuario);
  const firma = await firmaEnCurso(id_proyecto, id_etapa, id_usuario);

  const limpio = (codigo ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(limpio)) throw new CodigoFirmaParInvalidoError("Escribe el código de 6 dígitos que llegó a tu correo.");
  if (!firma?.codigo_hash || !firma.codigo_expira) throw new CodigoFirmaParInvalidoError("Primero solicita el código de verificación.");
  if (firma.codigo_expira < new Date()) throw new CodigoFirmaParInvalidoError("El código venció. Solicita uno nuevo.");
  if (firma.codigo_intentos >= CODIGO_MAX_INTENTOS) throw new CodigoFirmaParInvalidoError("Se agotaron los intentos. Solicita un código nuevo.");

  const esperado = Buffer.from(firma.codigo_hash, "hex");
  const recibido = Buffer.from(hashCodigo(firma.id_firma_par, limpio), "hex");
  if (esperado.length !== recibido.length || !crypto.timingSafeEqual(esperado, recibido)) {
    await prisma.firmaEvaluacionPar.update({ where: { id_firma_par: firma.id_firma_par }, data: { codigo_intentos: { increment: 1 } } });
    throw new CodigoFirmaParInvalidoError("El código no es correcto.");
  }

  const fecha_firma = new Date();
  const id_transaccion = `FP-${id_proyecto}-${crypto.randomUUID()}`;
  const hash_firma = hashCalificacion({ ...firma, id_transaccion, fecha_firma }, calificacion);
  await prisma.firmaEvaluacionPar.update({
    where: { id_firma_par: firma.id_firma_par },
    data: {
      firmado: true,
      fecha_firma,
      id_transaccion,
      hash_firma,
      ip_firma: evidencia.ip?.slice(0, 100) ?? null,
      agente_firma: evidencia.agente?.slice(0, 500) ?? null,
      codigo_hash: null,
      codigo_expira: null,
      codigo_intentos: 0,
    },
  });
  return { firmado: true, fecha_firma, id_transaccion, hash_firma };
}

/**
 * Al enviar la calificación: debe haber una firma verificada del par y lo
 * enviado debe coincidir con lo firmado. Devuelve el id de la firma para
 * ligarla a la evaluación creada.
 */
export async function verificarFirmaParaEnviar(
  id_proyecto: number,
  id_etapa: number,
  id_usuario: number,
  calificacion: CalificacionFirmada
): Promise<number> {
  const firma = await firmaEnCurso(id_proyecto, id_etapa, id_usuario);
  if (!firma?.firmado || !firma.id_transaccion || !firma.fecha_firma) throw new FirmaParRequeridaError();
  const hash = hashCalificacion({ ...firma, id_transaccion: firma.id_transaccion, fecha_firma: firma.fecha_firma }, calificacion);
  if (hash !== firma.hash_firma) {
    throw new FirmaParRequeridaError("La calificación cambió después de firmarla. Vuelve a firmar antes de enviarla.");
  }
  return firma.id_firma_par;
}

/** Evidencia de firma de varias calificaciones, por id_evaluacion (para mostrarla al Administrador). */
export async function firmasDeEvaluaciones(ids: number[]) {
  const firmas = await prisma.firmaEvaluacionPar.findMany({
    where: { id_evaluacion: { in: ids }, firmado: true },
    select: { id_evaluacion: true, fecha_firma: true, id_transaccion: true, hash_firma: true },
  });
  return new Map(firmas.map((f) => [f.id_evaluacion!, { fecha_firma: f.fecha_firma, id_transaccion: f.id_transaccion, hash_firma: f.hash_firma }]));
}

export class CalificacionParNoEncontradaError extends Error {
  constructor() {
    super("La calificación no existe");
  }
}
export class CalificacionParNoVisibleError extends Error {
  constructor() {
    super("Solo el par que la hizo o un Administrador pueden ver esta calificación");
  }
}

/**
 * GET /evaluaciones/calificaciones-par/:idEvaluacion — la calificación de un
 * par con su firma, para el PDF del formato INV-IC-FR-008. La ven el propio
 * par y el Administrador; el investigador no, porque la evaluación es anónima.
 */
export async function obtenerCalificacionPar(id_evaluacion: number, usuario: { id_usuario: number; roles: string[] }) {
  const ev = await prisma.evaluacionEtapa.findUnique({
    where: { id_evaluacion },
    include: {
      etapa: { select: { nombre: true } },
      evaluadoPor: { select: { id_usuario: true, nombre: true, apellido: true } },
      proyecto: { select: { id_proyecto: true, titulo: true, convocatoria: { select: { nombre: true } } } },
      firmaPar: { select: { firmado: true, fecha_firma: true, id_transaccion: true, hash_firma: true } },
    },
  });
  if (!ev || ev.etapa.nombre !== "Pares") throw new CalificacionParNoEncontradaError();
  if (ev.evaluado_por !== usuario.id_usuario && !usuario.roles.includes("Administrador")) throw new CalificacionParNoVisibleError();

  return {
    id_evaluacion: ev.id_evaluacion,
    proyecto: { id_proyecto: ev.proyecto.id_proyecto, titulo: ev.proyecto.titulo, convocatoria: ev.proyecto.convocatoria.nombre },
    evaluador: { nombre: ev.evaluadoPor.nombre, apellido: ev.evaluadoPor.apellido },
    puntaje: ev.puntaje?.toNumber() ?? null,
    comentarios: ev.comentarios,
    fecha_evaluacion: ev.fecha_evaluacion,
    firma: ev.firmaPar?.firmado
      ? { fecha_firma: ev.firmaPar.fecha_firma, id_transaccion: ev.firmaPar.id_transaccion, hash_firma: ev.firmaPar.hash_firma }
      : null,
  };
}
