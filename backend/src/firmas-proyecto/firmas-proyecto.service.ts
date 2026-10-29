import crypto from "node:crypto";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { enviarCodigoFirmaActa, enviarSolicitudFirmaProyecto } from "../auth/email.service";
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

const CODIGO_VIGENCIA_MIN = 10;
const CODIGO_INTERVALO_SEG = 30;
const CODIGO_MAX_INTENTOS = 5;
const DOCUMENTO_CODIGO = "registro del proyecto";

export class EnlaceFirmaProyectoInvalidoError extends Error {
  constructor(mensaje = "El enlace no es válido o ya no está vigente") {
    super(mensaje);
  }
}

export class CodigoFirmaInvalidoError extends Error {}

/** La firma existe pero ahora mismo no se puede hacer lo pedido (ya firmó, falta el correo, espera entre códigos...). */
export class FirmaProyectoNoDisponibleError extends Error {}

export class FirmasIncompletasError extends Error {
  constructor() {
    super("Faltan firmas obligatorias: el proyecto se puede guardar cuando hayan firmado el Investigador(a) Principal y el Co-investigador(a) UNICESMAG.");
  }
}

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const hashCodigo = (id_firma: number, codigo: string) =>
  crypto.createHash("sha256").update(`proy:${id_firma}:${codigo}`).digest("hex");

/** "ma***@gmail.com": se muestra a dónde llegó el código sin exponer el correo completo. */
function enmascararCorreo(correo: string | null): string | null {
  if (!correo) return null;
  const [local, dominio] = correo.split("@");
  if (!dominio) return null;
  return `${local.slice(0, 2)}***@${dominio}`;
}

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

/** Genera el token, lo guarda (solo el hash) y manda el correo con el enlace de esa firma puntual. */
async function enviarSolicitud(
  firma: { id_firma: number; nombre: string; correo: string | null; rol_firmante: string },
  proyecto: { titulo: string; convocatoria: { nombre: string } }
): Promise<void> {
  if (!firma.correo) {
    console.warn(`[firmas-proyecto] ${firma.rol_firmante} "${firma.nombre}" no tiene correo: no se envió el enlace de firma.`);
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
    await enviarSolicitudFirmaProyecto(firma.correo, firma.nombre, firma.rol_firmante, enlace, vence, {
      titulo: proyecto.titulo,
      convocatoria: proyecto.convocatoria.nombre,
    });
  } catch (error) {
    console.error(`No se pudo enviar la solicitud de firma de proyecto a ${firma.correo}:`, error);
  }
}

/** Externos/egresados firman en paralelo (no bloquean): se les manda el enlace la primera vez, una vez firmó el Principal. */
async function enviarSolicitudesEnParalelo(id_proyecto: number): Promise<void> {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id_proyecto },
    include: { convocatoria: { select: { nombre: true } } },
  });
  if (!proyecto) return;
  const pendientes = await prisma.firmaProyecto.findMany({
    where: { id_proyecto, firmado: false, obligatoria: false, fecha_envio: null, id_usuarioproyecto: { not: null } },
  });
  for (const f of pendientes) await enviarSolicitud(f, proyecto);
}

async function principalYaFirmo(id_proyecto: number): Promise<boolean> {
  const firma = await prisma.firmaProyecto.findFirst({
    where: { id_proyecto, rol_firmante: ROL_PRINCIPAL, id_usuarioproyecto: { not: null } },
    select: { firmado: true },
  });
  return firma?.firmado ?? false;
}

/** Genera un código de 6 dígitos para esa firma (respetando la espera entre envíos) y lo manda al correo dado. */
async function enviarCodigo(
  firma: { id_firma: number; nombre: string; codigo_enviado: Date | null },
  correo: string,
  tituloProyecto: string
): Promise<{ correo_enmascarado: string; vence_en_minutos: number }> {
  const ultimo = firma.codigo_enviado?.getTime() ?? 0;
  const espera = Math.ceil((ultimo + CODIGO_INTERVALO_SEG * 1000 - Date.now()) / 1000);
  if (espera > 0) throw new FirmaProyectoNoDisponibleError(`Espera ${espera} segundos antes de pedir otro código.`);

  const codigo = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  await prisma.firmaProyecto.update({
    where: { id_firma: firma.id_firma },
    data: {
      correo_verificacion: correo,
      codigo_hash: hashCodigo(firma.id_firma, codigo),
      codigo_expira: new Date(Date.now() + CODIGO_VIGENCIA_MIN * 60 * 1000),
      codigo_enviado: new Date(),
      codigo_intentos: 0,
    },
  });
  try {
    await enviarCodigoFirmaActa(correo, firma.nombre, codigo, CODIGO_VIGENCIA_MIN, tituloProyecto, DOCUMENTO_CODIGO);
  } catch (error) {
    console.error(`No se pudo enviar el código de firma de proyecto a ${correo}:`, error);
    throw new FirmaProyectoNoDisponibleError("No se pudo enviar el código al correo. Intenta de nuevo en unos minutos.");
  }
  return { correo_enmascarado: enmascararCorreo(correo) ?? "", vence_en_minutos: CODIGO_VIGENCIA_MIN };
}

export interface EvidenciaFirma {
  ip: string | null;
  agente: string | null;
}

interface FirmaParaSellar {
  id_firma: number;
  id_proyecto: number;
  nombre: string;
  rol_firmante: string;
  correo_verificacion: string | null;
  codigo_hash: string | null;
  codigo_expira: Date | null;
  codigo_intentos: number;
}

/**
 * ID único del acto de firmar y huella SHA-256 de lo firmado: firmante, fecha,
 * ID y el contenido del proyecto en ese momento. El JSON se arma siempre con
 * las mismas claves y en el mismo orden, para que el hash se pueda recalcular.
 */
async function sellarFirma(firma: FirmaParaSellar, fecha: Date): Promise<{ id_transaccion: string; hash_firma: string }> {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id_proyecto: firma.id_proyecto },
    select: {
      titulo: true,
      ciudad: true,
      departamento: true,
      duracion_periodos: true,
      resumen: true,
      planteamiento_problema: true,
      pregunta_investigacion: true,
      justificacion: true,
      marco_teorico: true,
      metodologia_preliminar: true,
      componente_etico: true,
      implicaciones_eticas: true,
      fuentes_financiacion: true,
      permisos_licencias: true,
      funciones_estudiante_auxiliar: true,
      convocatoria: { select: { nombre: true } },
    },
  });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  const id_transaccion = `F-${firma.id_proyecto}-${crypto.randomUUID()}`;
  const documento = {
    id_transaccion,
    fecha_firma: fecha.toISOString(),
    firmante: { nombre: firma.nombre, rol: firma.rol_firmante, correo_verificacion: firma.correo_verificacion },
    proyecto: {
      id_proyecto: firma.id_proyecto,
      convocatoria: proyecto.convocatoria.nombre,
      titulo: proyecto.titulo,
      ciudad: proyecto.ciudad,
      departamento: proyecto.departamento,
      duracion_periodos: proyecto.duracion_periodos,
      resumen: proyecto.resumen,
      planteamiento_problema: proyecto.planteamiento_problema,
      pregunta_investigacion: proyecto.pregunta_investigacion,
      justificacion: proyecto.justificacion,
      marco_teorico: proyecto.marco_teorico,
      metodologia_preliminar: proyecto.metodologia_preliminar,
      componente_etico: proyecto.componente_etico,
      implicaciones_eticas: proyecto.implicaciones_eticas,
      fuentes_financiacion: proyecto.fuentes_financiacion,
      permisos_licencias: proyecto.permisos_licencias,
      funciones_estudiante_auxiliar: proyecto.funciones_estudiante_auxiliar,
    },
  };
  const hash_firma = crypto.createHash("sha256").update(JSON.stringify(documento)).digest("hex");
  return { id_transaccion, hash_firma };
}

/** Comprueba el código y, si es correcto, registra la firma con su evidencia y lo invalida (cada código sirve una sola vez). */
async function firmarConCodigo(firma: FirmaParaSellar, codigo: string | undefined, evidencia: EvidenciaFirma): Promise<void> {
  const limpio = (codigo ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(limpio)) throw new CodigoFirmaInvalidoError("Escribe el código de 6 dígitos que llegó a tu correo.");
  if (!firma.codigo_hash || !firma.codigo_expira) throw new CodigoFirmaInvalidoError("Primero solicita el código de verificación.");
  if (firma.codigo_expira < new Date()) throw new CodigoFirmaInvalidoError("El código venció. Solicita uno nuevo.");
  if (firma.codigo_intentos >= CODIGO_MAX_INTENTOS) throw new CodigoFirmaInvalidoError("Se agotaron los intentos. Solicita un código nuevo.");

  const esperado = Buffer.from(firma.codigo_hash, "hex");
  const recibido = Buffer.from(hashCodigo(firma.id_firma, limpio), "hex");
  if (esperado.length !== recibido.length || !crypto.timingSafeEqual(esperado, recibido)) {
    await prisma.firmaProyecto.update({ where: { id_firma: firma.id_firma }, data: { codigo_intentos: { increment: 1 } } });
    throw new CodigoFirmaInvalidoError("El código no es correcto.");
  }

  const fecha_firma = new Date();
  const { id_transaccion, hash_firma } = await sellarFirma(firma, fecha_firma);
  await prisma.firmaProyecto.update({
    where: { id_firma: firma.id_firma },
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
}

export async function obtenerEstadoFirmas(id_proyecto: number) {
  const [filas, proyecto] = await Promise.all([
    prisma.firmaProyecto.findMany({
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
        id_transaccion: true,
        hash_firma: true,
        correo_verificacion: true,
      },
    }),
    prisma.proyecto.findUnique({ where: { id_proyecto }, select: { estado_actual: true } }),
  ]);
  const firmas = filas.map(({ correo_verificacion, ...f }) => ({
    ...f,
    correo_verificacion_enmascarado: enmascararCorreo(correo_verificacion),
  }));
  return { firmas, estado_actual: proyecto?.estado_actual ?? null };
}

/**
 * Se llama al guardar el proyecto desde "Firmas y anexos" (antes de que el
 * Principal pida su código) y también en CADA guardado posterior de un
 * proyecto ya existente ("Guardar cambios" en edición). El formulario no
 * tiene manera de "actualizar" un participante: cada guardado borra todos los
 * UsuarioProyecto y los vuelve a crear con un id_usuarioproyecto nuevo, lo que
 * desvincula (SetNull, no Cascade — ver schema.prisma) la FirmaProyecto de
 * cada uno, dejándola "huérfana" en vez de borrarla.
 *
 * Por cada participante actual se busca primero si ya tiene una firma
 * vinculada (nada que hacer); si no, se busca una huérfana con el MISMO
 * correo+rol — si existe, se re-vincula conservando firmado/fecha_firma/
 * token (no se le vuelve a pedir la firma a quien ya firmó solo por guardar
 * otro cambio del formulario); si no, se crea una firma en blanco.
 *
 * Nadie queda firmado aquí, ni siquiera el Principal: él confirma con el
 * código que le llega al correo personal (firmarPrincipalConCodigo). Y esta
 * función nunca manda el proyecto al líder — eso solo pasa cuando el
 * Principal presiona "Guardar proyecto" con todas las firmas obligatorias
 * (finalizarFirmas). Lo único que hace con el estado es devolverlo a
 * "pendiente_firmas" si queda alguna firma obligatoria pendiente.
 *
 * Los estudiantes no entran aquí: su compromiso ya queda cubierto por el
 * Acta de compromiso que se anexa como documento, no por una firma digital.
 */
export async function iniciarFirmas(id_proyecto: number, usuarioQueEdita: { id_usuario: number; roles: string[] }) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto }, select: { estado_actual: true } });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  const participantes = await prisma.usuarioProyecto.findMany({
    where: { id_proyecto, rolProyecto: { nombre: { not: ROL_ESTUDIANTE } } },
    include: { usuario: { select: { nombre: true, apellido: true, correo: true } }, rolProyecto: { select: { nombre: true } } },
  });

  // Solo firman los participantes de "Información general" (Principal,
  // Co-investigador, externos, egresados), que siempre se registran con
  // correo. Los "Investigadores del grupo" de la pestaña Grupos se guardan
  // solo con nombre y no tienen nada que ver con las firmas.
  const firmantes = participantes.filter((p) => p.rolProyecto.nombre === ROL_PRINCIPAL || nombreYCorreoDe(p).correo);
  await prisma.firmaProyecto.deleteMany({
    where: { id_proyecto, id_usuarioproyecto: { not: null, notIn: firmantes.map((p) => p.id_usuarioproyecto) } },
  });

  const huerfanas = await prisma.firmaProyecto.findMany({ where: { id_proyecto, id_usuarioproyecto: null } });
  const huerfanasUsadas = new Set<number>();

  for (const p of firmantes) {
    const yaVinculada = await prisma.firmaProyecto.findUnique({ where: { id_usuarioproyecto: p.id_usuarioproyecto } });
    if (yaVinculada) continue;

    const { nombre, correo } = nombreYCorreoDe(p);

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

  // En una edición de un proyecto cuyo Principal ya firmó, a un externo o
  // egresado recién agregado se le manda su enlace de una vez.
  if (await principalYaFirmo(id_proyecto)) await enviarSolicitudesEnParalelo(id_proyecto);

  // Solo mientras el proyecto sigue en la fase de firmas: si ya avanzó a otra
  // fase (ej. "revision" por un reenvío de correcciones, "aprobado"...), no
  // se pisa su estado; solo se mantienen al día las filas de FirmaProyecto.
  if (
    (proyecto.estado_actual === "pendiente_lider" || proyecto.estado_actual === "pendiente_firmas") &&
    (await hayObligatoriaPendiente(id_proyecto))
  ) {
    await prisma.proyecto.update({ where: { id_proyecto }, data: { estado_actual: "pendiente_firmas" } });
  }

  return obtenerEstadoFirmas(id_proyecto);
}

async function firmaPrincipalDe(id_proyecto: number) {
  const firma = await prisma.firmaProyecto.findFirst({
    where: { id_proyecto, rol_firmante: ROL_PRINCIPAL, id_usuarioproyecto: { not: null } },
    include: {
      usuarioProyecto: { select: { participante: true } },
      proyecto: { select: { titulo: true } },
    },
  });
  if (!firma) throw new FirmaProyectoNoDisponibleError("Guarda el proyecto antes de firmar como Investigador(a) Principal.");
  return firma;
}

/**
 * POST /proyectos/:id/firmas/principal/codigo — manda el código al correo
 * personal de la Hoja de Vida del Investigador(a) Principal. Lo puede pedir
 * el dueño del proyecto o un Administrador que lo esté registrando por él; en
 * los dos casos el código le llega al Principal, que es quien firma.
 */
export async function solicitarCodigoFirmaPrincipal(
  id_proyecto: number,
  usuarioQueEdita: { id_usuario: number; roles: string[] }
): Promise<{ correo_enmascarado: string; vence_en_minutos: number }> {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const firma = await firmaPrincipalDe(id_proyecto);
  if (firma.firmado) throw new FirmaProyectoNoDisponibleError("El Investigador(a) Principal ya firmó este proyecto.");

  const id_usuario = firma.usuarioProyecto?.participante;
  const hojaVida = id_usuario
    ? await prisma.hojaVida.findUnique({ where: { id_usuario }, select: { correo_personal: true } })
    : null;
  const correo = hojaVida?.correo_personal?.trim();
  if (!correo) {
    throw new FirmaProyectoNoDisponibleError(
      "El Investigador(a) Principal no tiene correo personal en su Hoja de Vida. Regístralo ahí para recibir el código."
    );
  }
  return enviarCodigo(firma, correo, firma.proyecto.titulo);
}

/** POST /proyectos/:id/firmas/principal/firmar — valida el código y deja firmado al Principal. */
export async function firmarPrincipalConCodigo(
  id_proyecto: number,
  usuarioQueEdita: { id_usuario: number; roles: string[] },
  codigo: string | undefined,
  evidencia: EvidenciaFirma
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const firma = await firmaPrincipalDe(id_proyecto);
  if (!firma.firmado) {
    await firmarConCodigo(firma, codigo, evidencia);
    await enviarSolicitudesEnParalelo(id_proyecto);
  }
  return obtenerEstadoFirmas(id_proyecto);
}

/**
 * El Investigador(a) Principal dispara el envío del enlace a quien todavía
 * le falta firmar y SÍ bloquea (Co-investigador(a) UNICESMAG) — paso
 * explícito y separado para que pueda revisar el correo capturado antes de
 * mandar el enlace. También sirve para REENVIAR: genera un token nuevo y el
 * enlace viejo deja de servir (ver enviarSolicitud). No hace nada (sin error)
 * si no hay nadie pendiente.
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
  if (!(await principalYaFirmo(id_proyecto))) {
    throw new FirmaProyectoNoDisponibleError("Primero firma como Investigador(a) Principal.");
  }

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

/**
 * POST /proyectos/:id/firmas/finalizar — "Guardar proyecto": con todas las
 * firmas obligatorias, el proyecto pasa al visto bueno del líder. Es el único
 * camino de "pendiente_firmas" a "pendiente_lider".
 */
export async function finalizarFirmas(id_proyecto: number, usuarioQueEdita: { id_usuario: number; roles: string[] }) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto }, select: { estado_actual: true } });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  if (proyecto.estado_actual === "pendiente_firmas") {
    if (!(await principalYaFirmo(id_proyecto)) || (await hayObligatoriaPendiente(id_proyecto))) {
      throw new FirmasIncompletasError();
    }
    await prisma.proyecto.update({ where: { id_proyecto }, data: { estado_actual: "pendiente_lider" } });
  }
  return obtenerEstadoFirmas(id_proyecto);
}

/** GET /proyectos/:id/firmas — el dueño del proyecto o un Administrador consultan quién falta por firmar. */
export async function listarFirmas(id_proyecto: number, usuarioQueEdita: { id_usuario: number; roles: string[] }) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);
  return obtenerEstadoFirmas(id_proyecto);
}

async function firmaPorToken(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new EnlaceFirmaProyectoInvalidoError();
  const firma = await prisma.firmaProyecto.findUnique({
    where: { token_hash: hashToken(token) },
    include: { proyecto: { select: { titulo: true, convocatoria: { select: { nombre: true } } } } },
  });
  if (!firma) throw new EnlaceFirmaProyectoInvalidoError();
  if (!firma.firmado && firma.token_expira && firma.token_expira < new Date()) {
    throw new EnlaceFirmaProyectoInvalidoError("El enlace de firma venció. Pide al investigador que reenvíe la solicitud.");
  }
  return firma;
}

function resumenParaEnlace(firma: Awaited<ReturnType<typeof firmaPorToken>>, ya_firmado: boolean) {
  return {
    nombre: firma.nombre,
    rol_firmante: firma.rol_firmante,
    titulo: firma.proyecto.titulo,
    convocatoria: firma.proyecto.convocatoria.nombre,
    correo_enmascarado: enmascararCorreo(firma.correo),
    ya_firmado,
  };
}

/** GET /firmar-proyecto/:token (público) — lo que ve quien abre el enlace, antes de firmar. Abrirlo ya no firma. */
export async function obtenerFirmaPorEnlace(token: string) {
  const firma = await firmaPorToken(token);
  return resumenParaEnlace(firma, firma.firmado);
}

/** POST /firmar-proyecto/:token/codigo (público) — manda el código al mismo correo al que llegó el enlace. */
export async function solicitarCodigoPorEnlace(token: string): Promise<{ correo_enmascarado: string; vence_en_minutos: number }> {
  const firma = await firmaPorToken(token);
  if (firma.firmado) throw new FirmaProyectoNoDisponibleError("Tu firma ya estaba registrada.");
  if (!firma.correo) throw new FirmaProyectoNoDisponibleError("Esta firma no tiene correo registrado. Pide al investigador que lo corrija.");
  return enviarCodigo(firma, firma.correo, firma.proyecto.titulo);
}

/**
 * POST /firmar-proyecto/:token (público) — valida el código y registra la
 * firma. No manda el proyecto al líder: eso lo hace el Principal con
 * "Guardar proyecto" (finalizarFirmas).
 */
export async function firmarPorEnlace(token: string, codigo: string | undefined, evidencia: EvidenciaFirma) {
  const firma = await firmaPorToken(token);
  const yaFirmado = firma.firmado;
  if (!yaFirmado) await firmarConCodigo(firma, codigo, evidencia);
  return resumenParaEnlace(firma, yaFirmado);
}
