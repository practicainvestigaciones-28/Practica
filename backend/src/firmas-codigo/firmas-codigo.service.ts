import crypto from "node:crypto";
import { prisma } from "../config/prisma";
import { enviarCodigoFirmaActa } from "../auth/email.service";

// ---------------------------------------------------------------------------
// Código de verificación de las firmas. Se envía al correo personal de la hoja de vida de quien firma (obligatorio para
// firmar). Vale para: registro del proyecto, evaluaciones (comités y pares), y se reutiliza en el acta de inicio y en
// Seguimiento. El código vence, se usa una vez y tiene un máximo de intentos; solo se guarda su hash.
// ---------------------------------------------------------------------------

export const CODIGO_VIGENCIA_MIN = 10;
export const CODIGO_INTERVALO_SEG = 30;
export const CODIGO_MAX_INTENTOS = 5;
/** Plazo que tiene la firma para usar un código ya comprobado (el guardado de un proyecto grande puede tardar). */
const VERIFICACION_VIGENCIA_MIN = 15;

/** El código falta, venció, se agotaron los intentos o no coincide. */
export class CodigoFirmaInvalidoError extends Error {
  status = 400;
}

/** Quien firma no tiene correo personal en su hoja de vida. */
export class CorreoPersonalFaltanteError extends Error {
  status = 409;
  constructor() {
    super("Para firmar necesitas tener tu correo personal registrado en tu hoja de vida (menú Perfil). Regístralo e intenta de nuevo.");
  }
}

export class CodigoFirmaEsperaError extends Error {
  status = 429;
}

export class ProyectoCodigoNoEncontradoError extends Error {
  status = 404;
  constructor() {
    super("El proyecto no existe");
  }
}

export const hashCodigoFirma = (id_usuario: number, id_proyecto: number, codigo: string) =>
  crypto.createHash("sha256").update(`seg:${id_usuario}:${id_proyecto}:${codigo}`).digest("hex");

/** "ma***@gmail.com": se muestra a dónde llegó el código sin exponer el correo completo. */
export function enmascararCorreoFirma(correo: string | null): string | null {
  if (!correo) return null;
  const [local, dominio] = correo.split("@");
  if (!dominio) return null;
  return `${local.slice(0, 2)}***@${dominio}`;
}

export const limpiarCodigo = (codigo: string | undefined) => (codigo ?? "").replace(/\s/g, "");

/** Compara el código recibido con el guardado, en tiempo constante. */
export function coincideCodigo(hashGuardado: string, hashRecibido: string): boolean {
  const a = Buffer.from(hashGuardado, "hex");
  const b = Buffer.from(hashRecibido, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const generarCodigo = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

/** POST /proyectos/:id/codigo-firma — envía el código de la firma al correo personal de la hoja de vida de quien firma. */
export async function solicitarCodigoFirma(
  id_usuario: number,
  id_proyecto: number,
  documento: string
): Promise<{ correo_enmascarado: string; vence_en_minutos: number }> {
  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario },
    select: { nombre: true, apellido: true, hojaVida: { select: { correo_personal: true } } },
  });
  const correo = usuario?.hojaVida?.correo_personal?.trim();
  if (!usuario || !correo) throw new CorreoPersonalFaltanteError();

  let titulo = "nuevo proyecto";
  if (id_proyecto > 0) {
    const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto }, select: { titulo: true } });
    if (!proyecto) throw new ProyectoCodigoNoEncontradoError();
    titulo = proyecto.titulo;
  }

  const clave = { id_usuario_id_proyecto: { id_usuario, id_proyecto } };
  const anterior = await prisma.codigoVerificacionFirma.findUnique({ where: clave });
  const espera = anterior ? Math.ceil((anterior.codigo_enviado.getTime() + CODIGO_INTERVALO_SEG * 1000 - Date.now()) / 1000) : 0;
  if (espera > 0) throw new CodigoFirmaEsperaError(`Espera ${espera} segundos antes de pedir otro código.`);

  const codigo = generarCodigo();
  const datos = {
    codigo_hash: hashCodigoFirma(id_usuario, id_proyecto, codigo),
    codigo_expira: new Date(Date.now() + CODIGO_VIGENCIA_MIN * 60 * 1000),
    codigo_enviado: new Date(),
    codigo_intentos: 0,
    verificado_en: null,
  };
  await prisma.codigoVerificacionFirma.upsert({ where: clave, create: { id_usuario, id_proyecto, ...datos }, update: datos });
  try {
    await enviarCodigoFirmaActa(correo, `${usuario.nombre} ${usuario.apellido}`.trim(), codigo, CODIGO_VIGENCIA_MIN, titulo, documento.trim().slice(0, 80) || "documento");
  } catch (error) {
    console.error(`No se pudo enviar el código de firma a ${correo}:`, error);
    throw new CodigoFirmaEsperaError("No se pudo enviar el código al correo personal. Intenta de nuevo en unos minutos.");
  }
  return { correo_enmascarado: enmascararCorreoFirma(correo) ?? "", vence_en_minutos: CODIGO_VIGENCIA_MIN };
}

/** POST /proyectos/:id/codigo-firma/verificar — comprueba el código; la firma lo consume enseguida (ver consumirVerificacionFirma). */
export async function verificarCodigoFirma(id_usuario: number, id_proyecto: number, codigo: string | undefined): Promise<{ verificado: true }> {
  const limpio = limpiarCodigo(codigo);
  if (!limpio) throw new CodigoFirmaInvalidoError("Escribe el código de verificación que llegó a tu correo personal.");
  const registro = await prisma.codigoVerificacionFirma.findUnique({ where: { id_usuario_id_proyecto: { id_usuario, id_proyecto } } });
  if (!registro) throw new CodigoFirmaInvalidoError("Primero solicita el código de verificación.");
  if (registro.codigo_expira < new Date()) throw new CodigoFirmaInvalidoError("El código venció. Solicita uno nuevo.");
  if (registro.codigo_intentos >= CODIGO_MAX_INTENTOS) throw new CodigoFirmaInvalidoError("Se agotaron los intentos. Solicita un código nuevo.");
  if (!coincideCodigo(registro.codigo_hash, hashCodigoFirma(id_usuario, id_proyecto, limpio))) {
    await prisma.codigoVerificacionFirma.update({ where: { id_codigo: registro.id_codigo }, data: { codigo_intentos: { increment: 1 } } });
    throw new CodigoFirmaInvalidoError("El código no es correcto.");
  }
  await prisma.codigoVerificacionFirma.update({ where: { id_codigo: registro.id_codigo }, data: { verificado_en: new Date() } });
  return { verificado: true };
}

/**
 * Lo usa la firma (registro del proyecto, evaluación) para exigir que quien firma haya comprobado antes su código.
 * Cada comprobación sirve para una sola firma. `ids_proyecto` admite el 0 de un proyecto que aún no existe.
 */
export async function consumirVerificacionFirma(id_usuario: number, ids_proyecto: number[]): Promise<void> {
  const desde = new Date(Date.now() - VERIFICACION_VIGENCIA_MIN * 60 * 1000);
  const registro = await prisma.codigoVerificacionFirma.findFirst({
    where: { id_usuario, id_proyecto: { in: ids_proyecto }, verificado_en: { gte: desde } },
    orderBy: { verificado_en: "desc" },
  });
  if (!registro) {
    throw new CodigoFirmaInvalidoError("Para firmar debes verificar el código que enviamos a tu correo personal. Solicítalo y escríbelo antes de firmar.");
  }
  await prisma.codigoVerificacionFirma.delete({ where: { id_codigo: registro.id_codigo } });
}
