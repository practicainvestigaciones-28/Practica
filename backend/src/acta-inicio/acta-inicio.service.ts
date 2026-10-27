import crypto from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { enviarCodigoFirmaActa, enviarSolicitudFirmaActa } from "../auth/email.service";
import {
  MESES_POR_PERIODO,
  TIPOS_CLAUSULA,
  aceptacionCompleta,
  calcularFechaFin,
  esCorreoValido,
  faltantesContacto,
  sumaVigencias,
  tipoProyectoDesdeModalidad,
  validarDatosActa,
  type ContactoParticipante,
  type DatosActa,
  type TipoClausula,
  type VigenciaActa,
} from "./acta-inicio.reglas";

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

export class ProyectoNoEncontradoError extends Error {
  constructor() {
    super("El proyecto no está aprobado o no existe");
  }
}

export class ActaNoEncontradaError extends Error {
  constructor() {
    super("El acta de inicio no existe");
  }
}

export class NoAutorizadoActaError extends Error {
  constructor(mensaje = "No tienes permiso para esta acción sobre el acta de inicio") {
    super(mensaje);
  }
}

export class EstadoActaInvalidoError extends Error {}

export class ActaInvalidaError extends Error {
  constructor(
    mensaje: string,
    public readonly faltantes: string[]
  ) {
    super(mensaje);
  }
}

/** El código de verificación falta, venció, se agotaron los intentos o no coincide. */
export class CodigoFirmaInvalidoError extends Error {}

export class EnlaceFirmaInvalidoError extends Error {
  constructor(mensaje = "El enlace de firma no es válido") {
    super(mensaje);
  }
}

// ---------------------------------------------------------------------------
// Tipos que se devuelven al frontend (mismo contrato que usa su capa api/)
// ---------------------------------------------------------------------------

export interface UsuarioSesion {
  id_usuario: number;
  roles: string[];
}

interface ParticipanteActa extends ContactoParticipante {
  id_usuarioproyecto: number;
  id_usuario: number;
  nombre: string;
  rol: string;
}

interface FirmaActa {
  id_firma: number;
  id_usuario: number;
  nombre: string;
  rol_firmante: string;
  orden_firma: number;
  firmado: boolean;
  fecha_firma: string | null;
  /** Los investigadores firman con un código que llega a su correo personal; el Vicerrector y el Administrador, no. */
  requiere_codigo: boolean;
  /** Correo personal (enmascarado) al que llega el código. Nulo si no tiene registrado. */
  correo_personal_enmascarado: string | null;
}

export interface ActaDetalle {
  id_acta_inicio: number | null;
  id_proyecto: number;
  titulo: string;
  convocatoria: string | null;
  estado: "en elaboracion" | "en firma" | "legalizada";
  estado_proyecto: string;
  id_creador: number;
  objetivo_general: string;
  objetivos_especificos: string[];
  grupos: { grupo: string; entidad: string }[];
  programas: string[];
  fecha_inicio: string | null;
  duracion_meses: number | null;
  fecha_fin_estimada: string | null;
  tipo_proyecto: string | null;
  numero_acta_aprobacion: string | null;
  fecha_acta_aprobacion: string | null;
  centro_costos: string | null;
  valor_solicitado_unicesmag: number;
  vigencias: VigenciaActa[];
  participantes: ParticipanteActa[];
  firmas: FirmaActa[];
  compromisos: {
    id_usuarioproyecto: number;
    tipo_clausula: string;
    version_texto: string | null;
    aceptado: boolean;
    fecha_aceptacion: string | null;
  }[];
  tiene_archivo_generado: boolean;
  tiene_archivo_firmado: boolean;
  archivo_firmado_nombre: string | null;
  fecha_legalizacion: string | null;
  /** Nombre y correo con que se propone al Vicerrector (solo firma, sin cuenta): se ajustan al generar el acta. */
  vicerrector_sugerido: { nombre: string; correo: string };
  /** Correo con que quedó el Vicerrector en esta acta (solo se entrega al Administrador). */
  vicerrector_correo: string | null;
  /** Actividades del cronograma de la formulación: base de los informes de avance de la etapa de seguimiento. */
  actividades: ActividadActa[];
  /** Datos generales de la formulación que el informe técnico final de seguimiento trae ya diligenciados. */
  resumen: string | null;
  areas_conocimiento: string[];
  ciudad: string | null;
  departamento: string | null;
  /** Auxiliares y asistentes (estudiantes): no firman el acta, pero hacen parte del informe final. */
  apoyos: ApoyoActa[];
  /** Resultados esperados de la formulación: base del numeral 4 (resultados) del informe técnico final. */
  productos: ProductoActa[];
}

export interface ProductoActa {
  /** Subcategoría del catálogo de productos: es el "concepto" del numeral 4 del formato INV-IC-FR-019. */
  concepto: string;
  tipo: string;
  cantidad: number;
}

export interface ApoyoActa {
  nombre: string;
  tipo: "Auxiliar" | "Asistente";
  codigo_estudiantil: string | null;
  correo: string | null;
}

export interface ActividadActa {
  id_actividad: number;
  actividad: string;
  /** Resultado esperado de la actividad (la "meta" del informe de avance). */
  resultado: string | null;
  responsable: string | null;
  id_objetivo: number | null;
  /** Objetivo específico al que pertenece la actividad. */
  objetivo: string | null;
}

export interface ActaResumen {
  id_proyecto: number;
  titulo: string;
  investigador_principal: string | null;
  convocatoria: string | null;
  estado_proyecto: string;
  estado_acta: ActaDetalle["estado"] | null;
  /** Cuenta que registró el proyecto y cuentas de sus investigadores: el frontend filtra con ellas según el rol activo. */
  id_creador: number;
  ids_usuarios: number[];
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ROL_PRINCIPAL = "Investigador(a) Principal UNICESMAG";
const ROL_CO_INTERNO = "Co investigador(a) UNICESMAG";
const ROL_CO_EXTERNO = "Co investigador(a) Externo(a)";
const INSTITUCION_PROPIA = "Universidad CESMAG";
const ROL_VICERRECTOR_SISTEMA = "Vicerrector";
const ROL_FIRMANTE_VICERRECTOR = "Vicerrector";
/** Quien elabora el acta: firma al final, después de los investigadores y del Vicerrector. */
const ROL_FIRMANTE_ADMIN = "Administrador";
/** Firmantes que no son investigadores del acta. */
const ROLES_NO_INVESTIGADOR = [ROL_FIRMANTE_VICERRECTOR, ROL_FIRMANTE_ADMIN];
const VERSION_TEXTOS_POR_DEFECTO = "INV-IC-FR-017 v5";

const esAdmin = (u: UsuarioSesion) => u.roles.includes("Administrador");

const etiquetaRol = (rolProyecto: string): string | null =>
  rolProyecto === ROL_PRINCIPAL
    ? "Investigador principal"
    : rolProyecto === ROL_CO_INTERNO
      ? "Co-investigador"
      : rolProyecto === ROL_CO_EXTERNO
        ? "Co-investigador externo"
        : null;

const aFecha = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);
const aFechaHora = (d: Date | null): string | null => (d ? d.toISOString() : null);
const deFecha = (s: string): Date => new Date(`${s}T00:00:00.000Z`);
const CODIGO_VIGENCIA_MIN = 10;
const CODIGO_INTERVALO_SEG = 30;
const CODIGO_MAX_INTENTOS = 5;

const hashCodigo = (id_firma: number, codigo: string) => crypto.createHash("sha256").update(`${id_firma}:${codigo}`).digest("hex");

/** "ma***@gmail.com": se muestra a dónde llegó el código sin exponer el correo completo. */
function enmascararCorreo(correo: string | null): string | null {
  if (!correo) return null;
  const [local, dominio] = correo.split("@");
  if (!dominio) return null;
  return `${local.slice(0, 2)}***@${dominio}`;
}

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

// ---------------------------------------------------------------------------
// Carga del proyecto y armado del detalle
// ---------------------------------------------------------------------------

const INCLUDE_PROYECTO = {
  convocatoria: { select: { nombre: true } },
  modalidad: { select: { nombre: true } },
  financiacion: true,
  objetivos: true,
  actividades: { orderBy: { id_actividad: "asc" } },
  programas: { include: { programa: { select: { nombre: true } } } },
  areas: { include: { area: { select: { nombre: true } } } },
  productos: { include: { tipoProducto: { select: { nombre: true, subcategoria: { select: { nombre: true } } } } } },
  grupos: { include: { grupo: { select: { nombre: true, id_tipo_grupo: true, facultad_otra: true, programa_otro: true, lineas_medulares: true } } } },
  participantes: {
    include: {
      rolProyecto: { select: { nombre: true } },
      rolEstudiante: { select: { nombre: true } },
      usuario: {
        select: {
          id_usuario: true,
          nombre: true,
          apellido: true,
          correo: true,
          cedula: true,
          hojaVida: { select: { numero_documento: true, celular: true, telefono: true, correo_institucional: true, correo_personal: true } },
        },
      },
    },
    orderBy: { id_usuarioproyecto: "asc" },
  },
  actasInicio: { include: { compromisos: true, firmas: { orderBy: { orden_firma: "asc" } } } },
} satisfies Prisma.ProyectoInclude;

type ProyectoCargado = Prisma.ProyectoGetPayload<{ include: typeof INCLUDE_PROYECTO }>;

async function cargarProyecto(id_proyecto: number): Promise<ProyectoCargado> {
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto }, include: INCLUDE_PROYECTO });
  if (!proyecto) throw new ProyectoNoEncontradoError();
  // Solo hay acta de proyectos aprobados (o que ya la tienen).
  if (proyecto.estado_actual !== "aprobado" && proyecto.actasInicio.length === 0) throw new ProyectoNoEncontradoError();
  return proyecto;
}

type ContactosGuardados = Record<string, Partial<ContactoParticipante>>;

function armarDetalle(proyecto: ProyectoCargado): ActaDetalle {
  const acta = proyecto.actasInicio[0] ?? null;
  const contactos = (acta?.contactos ?? {}) as ContactosGuardados;

  const programas = proyecto.programas
    .map((x) => x.programa?.nombre ?? x.programa_otro ?? "")
    .filter((n) => n.trim() !== "");
  const textoProgramas = programas.length > 0 ? programas.join(" / ") : null;

  // Un co-investigador externo no tiene programa ni institución propios en el sistema: se proponen los del grupo
  // externo del proyecto (la entidad a la que pertenece y su programa o línea), y se pueden ajustar en el acta.
  const grupoExterno = proyecto.grupos.map((g) => g.grupo).find((g) => g.id_tipo_grupo !== 1);
  const institucionExterno = grupoExterno ? (grupoExterno.facultad_otra?.trim() || grupoExterno.nombre) : null;
  const programaExterno = grupoExterno
    ? grupoExterno.programa_otro?.trim() || grupoExterno.lineas_medulares.join(", ").trim() || null
    : null;

  const participantes: ParticipanteActa[] = [];
  const apoyos: ApoyoActa[] = [];
  const nombreDe = (p: ProyectoCargado["participantes"][number]) =>
    p.usuario ? `${p.usuario.nombre} ${p.usuario.apellido}`.trim() : `${p.nombre_manual ?? ""} ${p.apellido_manual ?? ""}`.trim();
  for (const p of proyecto.participantes) {
    const rol = etiquetaRol(p.rolProyecto.nombre);
    if (!rol) {
      // Estudiantes y egresados no firman el acta; los auxiliares y asistentes van al informe final.
      const tipo = p.rolEstudiante?.nombre.toLowerCase().includes("auxiliar") ? "Auxiliar" : p.rolEstudiante ? "Asistente" : null;
      if (tipo) apoyos.push({ nombre: nombreDe(p), tipo, codigo_estudiantil: p.codigo_estudiantil ?? null, correo: p.usuario?.correo ?? p.correo_manual ?? null });
      continue;
    }
    const hoja = p.usuario?.hojaVida ?? null;
    const externo = p.rolProyecto.nombre === ROL_CO_EXTERNO;
    const base: ContactoParticipante = {
      identificacion: hoja?.numero_documento ?? p.usuario?.cedula ?? null,
      telefono: hoja?.celular ?? hoja?.telefono ?? null,
      correo: hoja?.correo_institucional ?? p.usuario?.correo ?? p.correo_manual ?? null,
      // El personal sale de la hoja de vida; si no lo tiene, lo diligencia el propio investigador o el Administrador.
      correo_personal: hoja?.correo_personal ?? null,
      programa_academico: externo ? programaExterno : textoProgramas,
      institucion: externo ? institucionExterno : INSTITUCION_PROPIA,
    };
    const guardado = contactos[String(p.id_usuarioproyecto)] ?? {};
    const contacto = Object.fromEntries(
      (Object.keys(base) as (keyof ContactoParticipante)[]).map((k) => [k, (guardado[k] ?? "").toString().trim() ? guardado[k] : base[k]])
    ) as unknown as ContactoParticipante;
    participantes.push({
      id_usuarioproyecto: p.id_usuarioproyecto,
      // Sin cuenta no puede firmar dentro del sistema: id negativo propio, que no choca con ninguna cuenta.
      id_usuario: p.participante ?? -p.id_usuarioproyecto,
      nombre: p.usuario ? `${p.usuario.nombre} ${p.usuario.apellido}`.trim() : `${p.nombre_manual ?? ""} ${p.apellido_manual ?? ""}`.trim(),
      rol,
      ...contacto,
    });
  }

  const estado = (acta?.estado ?? "en elaboracion") as ActaDetalle["estado"];
  const duracionPorDefecto = proyecto.duracion_periodos ? proyecto.duracion_periodos * MESES_POR_PERIODO : null;
  const duracion = acta?.duracion_meses ?? duracionPorDefecto;
  const fechaInicio = aFecha(acta?.fecha_inicio ?? null);
  const fin = aFecha(acta?.fecha_fin_estimada ?? null) ?? (fechaInicio && duracion ? calcularFechaFin(fechaInicio, duracion) || null : null);
  const general = proyecto.objetivos.find((o) => o.tipo_objetivo === "general");
  // Cada actividad se muestra bajo su objetivo específico; si la formulación no lo registró, se reparten en
  // orden entre los objetivos específicos (las actividades se cargan siguiendo la secuencia de los objetivos).
  const especificos = proyecto.objetivos.filter((o) => o.tipo_objetivo === "especifico");
  const actividades: ActividadActa[] = proyecto.actividades.map((a, i, todas) => {
    const asociado = a.id_objetivo ? proyecto.objetivos.find((o) => o.id_objetivo === a.id_objetivo) : undefined;
    const porOrden =
      especificos.length > 0
        ? especificos[Math.min(especificos.length - 1, Math.floor((i * especificos.length) / todas.length))]
        : undefined;
    return {
      id_actividad: a.id_actividad,
      actividad: a.actividad,
      resultado: a.resultado,
      responsable: a.responsable_manual,
      id_objetivo: a.id_objetivo,
      objetivo: (asociado ?? porOrden)?.descripcion ?? null,
    };
  });

  return {
    id_acta_inicio: acta?.id_acta_inicio ?? null,
    id_proyecto: proyecto.id_proyecto,
    titulo: proyecto.titulo,
    convocatoria: proyecto.convocatoria?.nombre ?? null,
    estado,
    estado_proyecto: estado === "legalizada" ? "En ejecución" : "Aprobado",
    id_creador: proyecto.creado_por,
    objetivo_general: general?.descripcion ?? "",
    objetivos_especificos: proyecto.objetivos.filter((o) => o.tipo_objetivo === "especifico").map((o) => o.descripcion),
    grupos: proyecto.grupos.map((g) => ({
      grupo: g.grupo.nombre,
      entidad: g.grupo.id_tipo_grupo === 1 ? INSTITUCION_PROPIA : "Entidad externa",
    })),
    programas,
    fecha_inicio: fechaInicio,
    duracion_meses: duracion,
    fecha_fin_estimada: fin,
    tipo_proyecto: acta?.tipo_proyecto ?? tipoProyectoDesdeModalidad(proyecto.modalidad?.nombre),
    numero_acta_aprobacion: acta?.numero_acta_aprobacion ?? null,
    fecha_acta_aprobacion: aFecha(acta?.fecha_acta_aprobacion ?? null),
    centro_costos: acta?.centro_costos ?? null,
    valor_solicitado_unicesmag: Number(proyecto.financiacion?.valor_solicitado_unicesmag ?? 0),
    vigencias: (acta?.vigencias ?? []) as unknown as VigenciaActa[],
    participantes,
    firmas: (acta?.firmas ?? []).map((f) => ({
      id_firma: f.id_firma,
      id_usuario: f.id_usuario ?? 0,
      nombre: f.nombre,
      rol_firmante: f.rol_firmante,
      orden_firma: f.orden_firma,
      firmado: f.firmado,
      fecha_firma: aFechaHora(f.fecha_firma),
      requiere_codigo: !ROLES_NO_INVESTIGADOR.includes(f.rol_firmante),
      correo_personal_enmascarado: enmascararCorreo(f.correo_personal),
    })),
    compromisos: (acta?.compromisos ?? []).map((c) => ({
      id_usuarioproyecto: c.id_usuarioproyecto,
      tipo_clausula: c.tipo_clausula,
      version_texto: c.version_texto,
      aceptado: c.aceptado,
      fecha_aceptacion: aFechaHora(c.fecha_aceptacion),
    })),
    tiene_archivo_generado: estado !== "en elaboracion",
    tiene_archivo_firmado: estado === "legalizada",
    archivo_firmado_nombre: null,
    fecha_legalizacion: aFechaHora(acta?.fecha_legalizacion ?? null),
    vicerrector_sugerido: { nombre: env.VICERRECTOR_NOMBRE, correo: env.VICERRECTOR_CORREO },
    vicerrector_correo: acta?.firmas.find((f) => f.rol_firmante === ROL_FIRMANTE_VICERRECTOR)?.correo ?? null,
    actividades,
    resumen: proyecto.resumen?.trim() || null,
    areas_conocimiento: proyecto.areas.map((a) => a.area.nombre),
    ciudad: proyecto.ciudad ?? null,
    departamento: proyecto.departamento ?? null,
    apoyos,
    productos: proyecto.productos.map((x) => ({ concepto: x.tipoProducto.subcategoria.nombre, tipo: x.tipoProducto.nombre, cantidad: x.cantidad })),
  };
}

function puedeVer(detalle: ActaDetalle, u: UsuarioSesion): boolean {
  if (esAdmin(u)) return true;
  if (u.roles.includes(ROL_VICERRECTOR_SISTEMA) && detalle.estado !== "en elaboracion") return true;
  return detalle.id_creador === u.id_usuario || detalle.participantes.some((p) => p.id_usuario === u.id_usuario);
}

/** Qué impide generar el acta (HU-82, 83, 85, 86). Vacío = se puede generar. */
function bloqueosGeneracion(d: ActaDetalle): string[] {
  const bloqueos: string[] = [];
  if (!d.tipo_proyecto) bloqueos.push("Selecciona el tipo de proyecto.");
  if (!d.numero_acta_aprobacion || !d.fecha_acta_aprobacion) bloqueos.push("Registra el acto administrativo de aprobación.");
  if (!d.centro_costos) bloqueos.push("Asigna el centro de costos.");
  if (!d.fecha_inicio || !d.duracion_meses) bloqueos.push("Registra fecha de inicio y duración.");
  if (d.vigencias.length === 0 || sumaVigencias(d.vigencias) <= 0) {
    bloqueos.push("Registra el valor aprobado (guarda los numerales 1 a 3).");
  }
  if (d.participantes.length === 0) bloqueos.push("El proyecto no tiene investigadores registrados.");
  for (const p of d.participantes) {
    const f = faltantesContacto(p);
    if (f.length > 0) bloqueos.push(`${p.nombre}: faltan ${f.join(", ")}.`);
    if (p.correo_personal && !esCorreoValido(p.correo_personal)) bloqueos.push(`${p.nombre}: el correo personal no es válido.`);
  }
  return bloqueos;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** GET /acta-inicio — cada rol ve lo suyo: Administrador todo, Vicerrector lo que ya está en firma, investigador sus proyectos. */
export async function listarActas(usuario: UsuarioSesion): Promise<ActaResumen[]> {
  const proyectos = await prisma.proyecto.findMany({
    where: { OR: [{ estado_actual: "aprobado" }, { actasInicio: { some: {} } }] },
    include: INCLUDE_PROYECTO,
    orderBy: { id_proyecto: "desc" },
  });
  return proyectos
    .map((p) => armarDetalle(p))
    .filter((d) => puedeVer(d, usuario))
    .map((d) => ({
      id_proyecto: d.id_proyecto,
      titulo: d.titulo,
      investigador_principal: d.participantes.find((p) => p.rol === "Investigador principal")?.nombre ?? null,
      convocatoria: d.convocatoria,
      estado_proyecto: d.estado_proyecto,
      estado_acta: d.id_acta_inicio === null ? null : d.estado,
      id_creador: d.id_creador,
      ids_usuarios: d.participantes.filter((p) => p.id_usuario > 0).map((p) => p.id_usuario),
    }));
}

/**
 * GET /acta-inicio/estados — en qué punto está el acta de cada proyecto (sin_acta, en elaboracion, en firma,
 * legalizada). Solo estados: lo usa Seguimiento, que únicamente recibe proyectos con el acta legalizada.
 */
export async function estadosActas(): Promise<Record<number, "sin_acta" | ActaDetalle["estado"]>> {
  const proyectos = await prisma.proyecto.findMany({
    where: { OR: [{ estado_actual: "aprobado" }, { actasInicio: { some: {} } }] },
    select: { id_proyecto: true, actasInicio: { select: { estado: true } } },
  });
  return Object.fromEntries(
    proyectos.map((p) => [p.id_proyecto, (p.actasInicio[0]?.estado ?? "sin_acta") as "sin_acta" | ActaDetalle["estado"]])
  );
}

/** GET /acta-inicio/proyecto/:id */
/** Las actas que ya estaban en firma antes de que el Administrador firmara de último reciben su firma pendiente. */
async function asegurarFirmaAdministrador(id_proyecto: number): Promise<void> {
  const acta = await prisma.actaInicio.findUnique({ where: { id_proyecto }, include: { firmas: true } });
  if (!acta || acta.estado !== "en firma" || acta.firmas.some((f) => f.rol_firmante === ROL_FIRMANTE_ADMIN) || !acta.generada_por) return;
  const autor = await prisma.usuario.findUnique({ where: { id_usuario: acta.generada_por }, select: { nombre: true, apellido: true, correo: true } });
  if (!autor) return;
  await prisma.actaInicioFirma.create({
    data: {
      id_acta_inicio: acta.id_acta_inicio,
      id_usuario: acta.generada_por,
      nombre: `${autor.nombre} ${autor.apellido}`.trim(),
      correo: autor.correo,
      rol_firmante: ROL_FIRMANTE_ADMIN,
      orden_firma: Math.max(0, ...acta.firmas.map((f) => f.orden_firma)) + 1,
    },
  });
}

export async function obtenerActa(id_proyecto: number, usuario: UsuarioSesion): Promise<ActaDetalle> {
  await asegurarFirmaAdministrador(id_proyecto);
  const detalle = armarDetalle(await cargarProyecto(id_proyecto));
  if (!puedeVer(detalle, usuario)) throw new NoAutorizadoActaError("No participas en este proyecto");
  if (!esAdmin(usuario)) detalle.vicerrector_correo = null;
  return detalle;
}

async function actaDelProyecto(id_proyecto: number, usuario: UsuarioSesion, crearSiFalta: boolean): Promise<number> {
  const existente = await prisma.actaInicio.findUnique({ where: { id_proyecto }, select: { id_acta_inicio: true } });
  if (existente) return existente.id_acta_inicio;
  if (!crearSiFalta) throw new ActaNoEncontradaError();
  const creada = await prisma.actaInicio.create({ data: { id_proyecto, generada_por: usuario.id_usuario } });
  return creada.id_acta_inicio;
}

// ---------------------------------------------------------------------------
// Numerales 1 a 4 (solo mientras el acta está en elaboración)
// ---------------------------------------------------------------------------

/** PUT /acta-inicio/proyecto/:id — numerales 2 y 3, fecha de inicio y duración. Solo Administrador. */
export async function guardarDatos(id_proyecto: number, datos: DatosActa, usuario: UsuarioSesion): Promise<ActaDetalle> {
  if (!esAdmin(usuario)) throw new NoAutorizadoActaError("Solo el Administrador diligencia los datos del acta");
  const actual = armarDetalle(await cargarProyecto(id_proyecto));
  if (actual.estado !== "en elaboracion") throw new EstadoActaInvalidoError("El acta ya fue generada: sus datos no se pueden modificar.");

  // El tipo de proyecto viene de la aprobación; solo se elige si la modalidad no tiene equivalente.
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto }, select: { modalidad: { select: { nombre: true } } } });
  const tipo = tipoProyectoDesdeModalidad(proyecto?.modalidad?.nombre) ?? datos.tipo_proyecto;
  const completos: DatosActa = { ...datos, tipo_proyecto: tipo, vigencias: datos.vigencias ?? [] };
  const errores = validarDatosActa(completos, actual.valor_solicitado_unicesmag);
  if (errores.length > 0) throw new ActaInvalidaError("Los datos del acta no son válidos.", errores);

  const id_acta = await actaDelProyecto(id_proyecto, usuario, true);
  await prisma.actaInicio.update({
    where: { id_acta_inicio: id_acta },
    data: {
      tipo_proyecto: tipo,
      numero_acta_aprobacion: completos.numero_acta_aprobacion.trim(),
      fecha_acta_aprobacion: deFecha(completos.fecha_acta_aprobacion),
      centro_costos: completos.centro_costos.trim(),
      fecha_inicio: deFecha(completos.fecha_inicio),
      duracion_meses: completos.duracion_meses,
      fecha_fin_estimada: deFecha(calcularFechaFin(completos.fecha_inicio, completos.duracion_meses)),
      vigencias: [...completos.vigencias].sort((a, b) => a.anio - b.anio) as unknown as Prisma.InputJsonValue,
    },
  });
  return obtenerActa(id_proyecto, usuario);
}

/** PATCH /acta-inicio/proyecto/:id/participantes/:idUsuarioProyecto — numeral 4. Administrador o el propio participante. */
export async function guardarContacto(
  id_proyecto: number,
  id_usuarioproyecto: number,
  datos: Partial<ContactoParticipante>,
  usuario: UsuarioSesion
): Promise<ActaDetalle> {
  const actual = armarDetalle(await cargarProyecto(id_proyecto));
  // Con el acta ya generada los datos de contacto quedan congelados; solo el Administrador puede registrar el correo personal
  // (no va en el PDF) para quien todavía no lo tiene: sin él no se puede enviar el código con el que se firma.
  const soloCorreoPersonal = actual.estado !== "en elaboracion";
  if (soloCorreoPersonal && !esAdmin(usuario)) throw new EstadoActaInvalidoError("El acta ya fue generada: los datos de contacto no se pueden modificar.");
  const participante = actual.participantes.find((p) => p.id_usuarioproyecto === id_usuarioproyecto);
  if (!participante) throw new ActaInvalidaError("El participante no pertenece al proyecto.", []);
  if (!esAdmin(usuario) && participante.id_usuario !== usuario.id_usuario) {
    throw new NoAutorizadoActaError("Solo el Administrador o el propio participante pueden editar sus datos de contacto");
  }

  const id_acta = await actaDelProyecto(id_proyecto, usuario, true);
  const acta = await prisma.actaInicio.findUniqueOrThrow({ where: { id_acta_inicio: id_acta }, select: { contactos: true } });
  const contactos = (acta.contactos ?? {}) as ContactosGuardados;
  const limpio: Partial<ContactoParticipante> = {};
  for (const k of ["identificacion", "telefono", "correo", "correo_personal", "programa_academico", "institucion"] as const) {
    if (soloCorreoPersonal && k !== "correo_personal") continue;
    if (datos[k] !== undefined) limpio[k] = (datos[k] ?? "").toString().trim() || null;
    if (k === "correo_personal" && limpio.correo_personal) limpio.correo_personal = limpio.correo_personal.toLowerCase();
  }
  if (limpio.correo_personal && !esCorreoValido(limpio.correo_personal)) {
    throw new ActaInvalidaError("El correo personal no es válido.", ["correo personal"]);
  }
  contactos[String(id_usuarioproyecto)] = { ...(contactos[String(id_usuarioproyecto)] ?? {}), ...limpio };
  await prisma.actaInicio.update({ where: { id_acta_inicio: id_acta }, data: { contactos: contactos as unknown as Prisma.InputJsonValue } });
  // Con el acta en firma, las firmas pendientes del investigador toman el correo personal nuevo.
  if (limpio.correo_personal !== undefined && actual.estado === "en firma") {
    const coincide: Prisma.ActaInicioFirmaWhereInput[] = [];
    if (participante.id_usuario > 0) coincide.push({ id_usuario: participante.id_usuario });
    if (participante.correo) coincide.push({ correo: participante.correo });
    if (coincide.length > 0) {
      await prisma.actaInicioFirma.updateMany({
        where: { id_acta_inicio: id_acta, firmado: false, NOT: { rol_firmante: { in: ROLES_NO_INVESTIGADOR } }, OR: coincide },
        data: { correo_personal: limpio.correo_personal?.toLowerCase() ?? null },
      });
    }
  }
  return obtenerActa(id_proyecto, usuario);
}

// ---------------------------------------------------------------------------
// Generar, reabrir
// ---------------------------------------------------------------------------

export interface FirmanteVicerrector {
  nombre?: string;
  correo?: string;
}

/**
 * POST /acta-inicio/:id/generar — deja el acta "en firma" y avisa a los investigadores. Solo Administrador.
 * El Vicerrector solo firma (no tiene cuenta): se indica su correo y ahí recibe su enlace.
 */
export async function generarActa(
  id_acta_inicio: number,
  usuario: UsuarioSesion,
  vicerrector: FirmanteVicerrector = {}
): Promise<ActaDetalle> {
  if (!esAdmin(usuario)) throw new NoAutorizadoActaError("Solo el Administrador genera el acta");
  const acta = await prisma.actaInicio.findUnique({ where: { id_acta_inicio } });
  if (!acta) throw new ActaNoEncontradaError();
  if (acta.estado !== "en elaboracion") throw new EstadoActaInvalidoError("El acta ya fue generada.");

  const detalle = armarDetalle(await cargarProyecto(acta.id_proyecto));
  const bloqueos = bloqueosGeneracion(detalle);
  const nombreVice = vicerrector.nombre?.trim() || env.VICERRECTOR_NOMBRE;
  const correoVice = (vicerrector.correo?.trim() || env.VICERRECTOR_CORREO).toLowerCase();
  if (!correoVice) bloqueos.push("Indica el correo del Vicerrector: ahí recibe su enlace de firma.");
  else if (!esCorreoValido(correoVice)) bloqueos.push("El correo del Vicerrector no es válido.");
  if (bloqueos.length > 0) throw new ActaInvalidaError("El acta no se puede generar todavía.", bloqueos);

  // Orden del formato: investigador principal, co-investigadores y de último el Vicerrector.
  const investigadores = [...detalle.participantes].sort(
    (a, b) => Number(b.rol === "Investigador principal") - Number(a.rol === "Investigador principal")
  );
  // Si ese correo ya es de una cuenta, la firma queda ligada a ella; si no, firma solo con el enlace.
  const cuentaVice = await prisma.usuario.findUnique({
    where: { correo: correoVice },
    select: { id_usuario: true, hojaVida: { select: { correo_personal: true } } },
  });

  // Quien genera el acta (Administrador) la firma de último como quien la elaboró, con el nombre de su cuenta.
  const autor = await prisma.usuario.findUnique({ where: { id_usuario: usuario.id_usuario }, select: { nombre: true, apellido: true, correo: true } });

  await prisma.$transaction([
    prisma.actaInicioFirma.deleteMany({ where: { id_acta_inicio } }),
    prisma.actaInicioFirma.createMany({
      data: [
        ...investigadores.map((p, i) => ({
          id_acta_inicio,
          id_usuario: p.id_usuario > 0 ? p.id_usuario : null,
          nombre: p.nombre,
          correo: p.correo,
          correo_personal: p.correo_personal?.trim().toLowerCase() ?? null,
          rol_firmante: p.rol === "Investigador principal" ? "investigador principal" : "co-investigador",
          orden_firma: i + 1,
        })),
        {
          id_acta_inicio,
          id_usuario: cuentaVice?.id_usuario ?? null,
          nombre: nombreVice,
          correo: correoVice,
          correo_personal: cuentaVice?.hojaVida?.correo_personal ?? null,
          rol_firmante: ROL_FIRMANTE_VICERRECTOR,
          orden_firma: investigadores.length + 1,
        },
        {
          id_acta_inicio,
          id_usuario: usuario.id_usuario,
          nombre: autor ? `${autor.nombre} ${autor.apellido}`.trim() : "Administrador",
          correo: autor?.correo ?? null,
          rol_firmante: ROL_FIRMANTE_ADMIN,
          orden_firma: investigadores.length + 2,
        },
      ],
    }),
    prisma.actaInicio.update({ where: { id_acta_inicio }, data: { estado: "en firma", fecha_generacion: new Date() } }),
  ]);

  // Aviso dentro del sistema a los investigadores con cuenta: ahora deben aceptar los compromisos.
  const conCuenta = detalle.participantes.filter((p) => p.id_usuario > 0);
  if (conCuenta.length > 0) {
    await prisma.notificacion.createMany({
      data: conCuenta.map((p) => ({
        id_usuario: p.id_usuario,
        titulo: "Acta de inicio lista para aceptar y firmar",
        mensaje: `El acta de inicio del proyecto "${detalle.titulo}" ya fue generada. Acepta los compromisos y cláusulas; cuando estén aceptados recibirás tu enlace de firma por correo.`,
        enlace: `/acta-inicio/${detalle.id_proyecto}`,
      })),
    });
  }
  return obtenerActa(detalle.id_proyecto, usuario);
}

/** POST /acta-inicio/:id/reabrir — vuelve a "en elaboración" un acta no legalizada. Borra aceptaciones y firmas. */
export async function reabrirActa(id_acta_inicio: number, usuario: UsuarioSesion): Promise<ActaDetalle> {
  if (!esAdmin(usuario)) throw new NoAutorizadoActaError("Solo el Administrador reabre el acta");
  const acta = await prisma.actaInicio.findUnique({ where: { id_acta_inicio } });
  if (!acta) throw new ActaNoEncontradaError();
  if (acta.estado === "legalizada") throw new EstadoActaInvalidoError("El acta ya está legalizada y no se puede modificar.");
  if (acta.estado !== "en firma") throw new EstadoActaInvalidoError("El acta ya está en elaboración.");

  await prisma.$transaction([
    prisma.actaInicioFirma.deleteMany({ where: { id_acta_inicio } }),
    prisma.compromisoAceptacion.deleteMany({ where: { id_acta_inicio } }),
    prisma.actaInicio.update({ where: { id_acta_inicio }, data: { estado: "en elaboracion" } }),
  ]);
  return obtenerActa(acta.id_proyecto, usuario);
}

// ---------------------------------------------------------------------------
// Compromisos: la aceptación es del grupo
// ---------------------------------------------------------------------------

async function enviarSolicitud(
  firma: { id_firma: number; nombre: string; correo: string | null; correo_personal?: string | null; rol_firmante: string },
  detalle: ActaDetalle
): Promise<void> {
  // El enlace de firma llega al correo personal; si no hay uno registrado, al institucional.
  const destino = firma.correo_personal || firma.correo;
  if (!destino) {
    // Sin correo no hay a dónde enviar: la firma se hace dentro del sistema.
    console.warn(`[acta-inicio] ${firma.rol_firmante} "${firma.nombre}" no tiene correo: no se envió el enlace de firma.`);
    return;
  }
  const token = crypto.randomBytes(32).toString("hex");
  const vence = new Date(Date.now() + env.ACTA_FIRMA_VIGENCIA_DIAS * 24 * 60 * 60 * 1000);
  await prisma.actaInicioFirma.update({
    where: { id_firma: firma.id_firma },
    data: { token_hash: hashToken(token), token_expira: vence, fecha_envio: new Date() },
  });
  const enlace = `${env.FRONTEND_FIRMA_ACTA_URL.replace(/\/$/, "")}/${token}`;
  try {
    await enviarSolicitudFirmaActa(destino, firma.nombre, firma.rol_firmante, enlace, vence, {
      titulo: detalle.titulo,
      convocatoria: detalle.convocatoria,
      investigador_principal: detalle.participantes.find((p) => p.rol.toLowerCase().includes("principal"))?.nombre ?? null,
      grupos: detalle.grupos.map((g) => g.grupo),
      fecha_inicio: detalle.fecha_inicio,
      duracion_meses: detalle.duracion_meses,
      centro_costos: detalle.centro_costos,
    });
  } catch (error) {
    console.error(`No se pudo enviar la solicitud de firma a ${destino}:`, error);
  }
}

/** Cuando el grupo ya aceptó todo, cada investigador recibe su enlace personal de firma. */
async function enviarSolicitudesDeInvestigadores(id_acta_inicio: number, detalle: ActaDetalle): Promise<void> {
  const pendientes = await prisma.actaInicioFirma.findMany({
    where: { id_acta_inicio, firmado: false, fecha_envio: null, NOT: { rol_firmante: { in: ROLES_NO_INVESTIGADOR } } },
  });
  for (const f of pendientes) await enviarSolicitud(f, detalle);
}

/**
 * POST /acta-inicio/:id/compromisos — cualquier investigador del acta acepta
 * numerales y la aceptación queda registrada para TODOS los participantes
 * (decisión del grupo). Con los cuatro numerales aceptados salen los enlaces de
 * firma individual.
 */
export async function aceptarCompromisos(
  id_acta_inicio: number,
  clausulas: string[],
  version_texto: string | undefined,
  usuario: UsuarioSesion
): Promise<ActaDetalle> {
  const acta = await prisma.actaInicio.findUnique({ where: { id_acta_inicio } });
  if (!acta) throw new ActaNoEncontradaError();
  if (acta.estado !== "en firma") throw new EstadoActaInvalidoError("El acta no está en firma.");

  const detalle = armarDetalle(await cargarProyecto(acta.id_proyecto));
  if (!detalle.participantes.some((p) => p.id_usuario === usuario.id_usuario)) {
    throw new NoAutorizadoActaError("Solo los investigadores del acta aceptan los compromisos");
  }
  const validas = [...new Set(clausulas)].filter((c): c is TipoClausula => (TIPOS_CLAUSULA as readonly string[]).includes(c));
  if (validas.length === 0 || validas.length !== new Set(clausulas).size) {
    throw new ActaInvalidaError("Indica numerales válidos para aceptar.", [...TIPOS_CLAUSULA]);
  }

  const ahora = new Date();
  const version = version_texto?.trim() || VERSION_TEXTOS_POR_DEFECTO;
  const yaAceptadas = await prisma.compromisoAceptacion.findMany({ where: { id_acta_inicio, aceptado: true } });
  const existentes = new Set(yaAceptadas.map((a) => `${a.id_usuarioproyecto}|${a.tipo_clausula}`));
  const nuevas = detalle.participantes.flatMap((p) =>
    validas
      .filter((tipo) => !existentes.has(`${p.id_usuarioproyecto}|${tipo}`))
      .map((tipo) => ({
        id_acta_inicio,
        id_usuarioproyecto: p.id_usuarioproyecto,
        tipo_clausula: tipo,
        version_texto: version,
        aceptado: true,
        fecha_aceptacion: ahora,
      }))
  );
  if (nuevas.length > 0) await prisma.compromisoAceptacion.createMany({ data: nuevas });

  const todas = await prisma.compromisoAceptacion.findMany({ where: { id_acta_inicio } });
  if (
    aceptacionCompleta(
      detalle.participantes.map((p) => p.id_usuarioproyecto),
      todas
    )
  ) {
    await enviarSolicitudesDeInvestigadores(id_acta_inicio, detalle);
  }
  return obtenerActa(detalle.id_proyecto, usuario);
}

// ---------------------------------------------------------------------------
// Firma individual
// ---------------------------------------------------------------------------

interface ResultadoFirma {
  titulo: string;
  nombre: string;
  rol_firmante: string;
  legalizada: boolean;
}

/** Registra una firma ya autorizada (por sesión o por enlace) y hace avanzar el acta. */
async function registrarFirma(id_firma: number): Promise<ResultadoFirma> {
  const firma = await prisma.actaInicioFirma.findUnique({ where: { id_firma }, include: { actaInicio: true } });
  if (!firma) throw new EnlaceFirmaInvalidoError();
  const acta = firma.actaInicio;
  const proyecto = await cargarProyecto(acta.id_proyecto);
  const detalle = armarDetalle(proyecto);
  const resultado = (legalizada: boolean): ResultadoFirma => ({
    titulo: detalle.titulo,
    nombre: firma.nombre,
    rol_firmante: firma.rol_firmante,
    legalizada,
  });

  if (firma.firmado) return resultado(acta.estado === "legalizada");
  if (acta.estado !== "en firma") throw new EstadoActaInvalidoError("El acta no está en firma.");

  const esVicerrector = firma.rol_firmante === ROL_FIRMANTE_VICERRECTOR;
  const esAdminFirma = firma.rol_firmante === ROL_FIRMANTE_ADMIN;
  if (esVicerrector) {
    const faltan = await prisma.actaInicioFirma.count({
      where: { id_acta_inicio: acta.id_acta_inicio, firmado: false, NOT: { rol_firmante: { in: ROLES_NO_INVESTIGADOR } } },
    });
    if (faltan > 0) throw new EstadoActaInvalidoError("El Vicerrector firma cuando todos los investigadores hayan firmado.");
  } else if (esAdminFirma) {
    const faltan = await prisma.actaInicioFirma.count({
      where: { id_acta_inicio: acta.id_acta_inicio, firmado: false, NOT: { rol_firmante: ROL_FIRMANTE_ADMIN } },
    });
    if (faltan > 0) throw new EstadoActaInvalidoError("El Administrador firma al final, cuando hayan firmado los investigadores y el Vicerrector.");
  } else {
    const aceptaciones = await prisma.compromisoAceptacion.findMany({ where: { id_acta_inicio: acta.id_acta_inicio } });
    if (
      !aceptacionCompleta(
        detalle.participantes.map((p) => p.id_usuarioproyecto),
        aceptaciones
      )
    ) {
      throw new EstadoActaInvalidoError("Faltan compromisos por aceptar antes de firmar.");
    }
  }

  await prisma.actaInicioFirma.update({ where: { id_firma }, data: { firmado: true, fecha_firma: new Date() } });

  const pendientes = await prisma.actaInicioFirma.findMany({ where: { id_acta_inicio: acta.id_acta_inicio, firmado: false } });
  if (pendientes.length === 0) {
    await prisma.actaInicio.update({
      where: { id_acta_inicio: acta.id_acta_inicio },
      data: { estado: "legalizada", fecha_legalizacion: new Date() },
    });
    return resultado(true);
  }
  // Firmaron todos los investigadores: ahora le toca al Vicerrector (su enlace sale por correo) y al final al Administrador.
  const soloVicerrectorYAdmin = pendientes.every((f) => ROLES_NO_INVESTIGADOR.includes(f.rol_firmante));
  if (soloVicerrectorYAdmin) {
    for (const f of pendientes.filter((x) => x.rol_firmante === ROL_FIRMANTE_VICERRECTOR && x.fecha_envio === null)) await enviarSolicitud(f, detalle);
  }
  return resultado(false);
}

type FirmaConActa = Prisma.ActaInicioFirmaGetPayload<{ include: { actaInicio: true } }>;

/** Envía el código de verificación de una firma al correo personal del investigador. */
async function enviarCodigoDeFirma(id_firma: number): Promise<{ correo_enmascarado: string; vence_en_minutos: number }> {
  const firma = await prisma.actaInicioFirma.findUnique({ where: { id_firma }, include: { actaInicio: true } });
  if (!firma) throw new EnlaceFirmaInvalidoError();
  if (firma.firmado) throw new EstadoActaInvalidoError("Esta firma ya está registrada.");
  if (firma.actaInicio.estado !== "en firma") throw new EstadoActaInvalidoError("El acta no está en firma.");
  if (ROLES_NO_INVESTIGADOR.includes(firma.rol_firmante)) throw new EstadoActaInvalidoError("Esta firma no requiere código de verificación.");
  if (!firma.correo_personal) {
    throw new EstadoActaInvalidoError(
      "Este firmante no tiene correo personal registrado. Pide al Administrador que lo registre en el numeral 4 del acta."
    );
  }
  const ultimo = firma.codigo_enviado?.getTime() ?? 0;
  const espera = Math.ceil((ultimo + CODIGO_INTERVALO_SEG * 1000 - Date.now()) / 1000);
  if (espera > 0) throw new EstadoActaInvalidoError(`Espera ${espera} segundos antes de pedir otro código.`);

  const detalle = armarDetalle(await cargarProyecto(firma.actaInicio.id_proyecto));
  const codigo = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  await prisma.actaInicioFirma.update({
    where: { id_firma },
    data: {
      codigo_hash: hashCodigo(id_firma, codigo),
      codigo_expira: new Date(Date.now() + CODIGO_VIGENCIA_MIN * 60 * 1000),
      codigo_enviado: new Date(),
      codigo_intentos: 0,
    },
  });
  try {
    await enviarCodigoFirmaActa(firma.correo_personal, firma.nombre, codigo, CODIGO_VIGENCIA_MIN, detalle.titulo);
  } catch (error) {
    console.error(`No se pudo enviar el código de firma a ${firma.correo_personal}:`, error);
    throw new EstadoActaInvalidoError("No se pudo enviar el código al correo personal. Intenta de nuevo en unos minutos.");
  }
  return { correo_enmascarado: enmascararCorreo(firma.correo_personal) ?? "", vence_en_minutos: CODIGO_VIGENCIA_MIN };
}

/** Comprueba el código que escribió el investigador. Cada código sirve para una firma y tiene un máximo de intentos. */
async function verificarCodigoDeFirma(firma: FirmaConActa | Prisma.ActaInicioFirmaGetPayload<object>, codigo: string | undefined): Promise<void> {
  const limpio = (codigo ?? "").replace(/\s/g, "");
  if (!limpio) throw new CodigoFirmaInvalidoError("Escribe el código de verificación que llegó a tu correo personal.");
  if (!firma.codigo_hash || !firma.codigo_expira) throw new CodigoFirmaInvalidoError("Primero solicita el código de verificación.");
  if (firma.codigo_expira < new Date()) throw new CodigoFirmaInvalidoError("El código venció. Solicita uno nuevo.");
  if (firma.codigo_intentos >= CODIGO_MAX_INTENTOS) throw new CodigoFirmaInvalidoError("Se agotaron los intentos. Solicita un código nuevo.");

  const esperado = Buffer.from(firma.codigo_hash, "hex");
  const recibido = Buffer.from(hashCodigo(firma.id_firma, limpio), "hex");
  if (esperado.length !== recibido.length || !crypto.timingSafeEqual(esperado, recibido)) {
    await prisma.actaInicioFirma.update({ where: { id_firma: firma.id_firma }, data: { codigo_intentos: { increment: 1 } } });
    throw new CodigoFirmaInvalidoError("El código no es correcto.");
  }
}

/** La firma pendiente que esta cuenta puede dar ahora: la primera en el orden del acta (investigadores, Vicerrector, Administrador). */
async function firmaPendienteDeCuenta(id_acta_inicio: number, usuario: UsuarioSesion) {
  const acta = await prisma.actaInicio.findUnique({ where: { id_acta_inicio }, include: { firmas: true } });
  if (!acta) throw new ActaNoEncontradaError();
  if (acta.estado !== "en firma") throw new EstadoActaInvalidoError("El acta no está en firma.");
  const puedeComoVicerrector = usuario.roles.includes(ROL_VICERRECTOR_SISTEMA);
  const firma = acta.firmas
    .filter(
      (f) =>
        !f.firmado &&
        (f.id_usuario === usuario.id_usuario && (f.rol_firmante !== ROL_FIRMANTE_ADMIN || esAdmin(usuario)) ||
          (f.rol_firmante === ROL_FIRMANTE_VICERRECTOR && puedeComoVicerrector))
    )
    .sort((a, b) => a.orden_firma - b.orden_firma)[0];
  if (!firma) throw new NoAutorizadoActaError("No tienes una firma pendiente en esta acta");
  return { acta, firma };
}

/** POST /acta-inicio/:id/firma/codigo — el investigador pide el código de verificación para firmar con su cuenta. */
export async function solicitarCodigoFirmaActa(id_acta_inicio: number, usuario: UsuarioSesion): Promise<{ correo_enmascarado: string; vence_en_minutos: number }> {
  const { firma } = await firmaPendienteDeCuenta(id_acta_inicio, usuario);
  return enviarCodigoDeFirma(firma.id_firma);
}

/**
 * POST /acta-inicio/:id/firmar — firma dentro del sistema, con la cuenta de quien firma. Cada quien firma lo suyo:
 * el investigador (con el código que llegó a su correo personal), el Vicerrector con su rol y, de último, el
 * Administrador ("elaborado por").
 */
export async function firmarActa(id_acta_inicio: number, usuario: UsuarioSesion, codigo?: string): Promise<ActaDetalle> {
  const { acta, firma } = await firmaPendienteDeCuenta(id_acta_inicio, usuario);
  if (!ROLES_NO_INVESTIGADOR.includes(firma.rol_firmante)) await verificarCodigoDeFirma(firma, codigo);
  await registrarFirma(firma.id_firma);
  return obtenerActa(acta.id_proyecto, usuario);
}

async function firmaDeEnlace(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new EnlaceFirmaInvalidoError();
  const firma = await prisma.actaInicioFirma.findUnique({ where: { token_hash: hashToken(token) }, include: { actaInicio: true } });
  if (!firma) throw new EnlaceFirmaInvalidoError("El enlace no es válido o ya no está vigente");
  if (!firma.firmado && firma.token_expira && firma.token_expira < new Date()) {
    throw new EnlaceFirmaInvalidoError("El enlace de firma venció. Pide al Administrador que lo reenvíe.");
  }
  return firma;
}

export interface InfoFirmaEnlace {
  titulo: string;
  nombre: string;
  rol_firmante: string;
  ya_firmado: boolean;
  requiere_codigo: boolean;
  correo_enmascarado: string | null;
}

/** GET /firma-acta/:token (público) — a quién corresponde el enlace y si necesita código de verificación. */
export async function infoFirmaPorEnlace(token: string): Promise<InfoFirmaEnlace> {
  const firma = await firmaDeEnlace(token);
  const detalle = armarDetalle(await cargarProyecto(firma.actaInicio.id_proyecto));
  return {
    titulo: detalle.titulo,
    nombre: firma.nombre,
    rol_firmante: firma.rol_firmante,
    ya_firmado: firma.firmado,
    requiere_codigo: !ROLES_NO_INVESTIGADOR.includes(firma.rol_firmante),
    correo_enmascarado: enmascararCorreo(firma.correo_personal),
  };
}

/** POST /firma-acta/:token/codigo (público) — envía el código al correo personal de quien tiene el enlace. */
export async function solicitarCodigoPorEnlace(token: string): Promise<{ correo_enmascarado: string; vence_en_minutos: number }> {
  const firma = await firmaDeEnlace(token);
  return enviarCodigoDeFirma(firma.id_firma);
}

/** POST /firma-acta/:token (público) — firma con el enlace del correo y, si es investigador, con el código de verificación. */
export async function firmarPorEnlace(token: string, codigo?: string): Promise<ResultadoFirma & { ya_firmado: boolean }> {
  const firma = await firmaDeEnlace(token);
  const yaFirmado = firma.firmado;
  if (!yaFirmado && !ROLES_NO_INVESTIGADOR.includes(firma.rol_firmante)) await verificarCodigoDeFirma(firma, codigo);
  const resultado = await registrarFirma(firma.id_firma);
  return { ...resultado, ya_firmado: yaFirmado };
}

/**
 * PATCH /acta-inicio/:id/vicerrector — el Administrador cambia (o completa, en actas generadas antes de
 * pedirlo) el nombre y el correo del Vicerrector mientras no haya firmado. Si ya firmaron todos los
 * investigadores, el enlace sale de inmediato a ese correo.
 */
export async function actualizarVicerrector(id_acta_inicio: number, datos: FirmanteVicerrector, usuario: UsuarioSesion): Promise<ActaDetalle> {
  if (!esAdmin(usuario)) throw new NoAutorizadoActaError("Solo el Administrador cambia el correo del Vicerrector");
  const acta = await prisma.actaInicio.findUnique({ where: { id_acta_inicio }, include: { firmas: true } });
  if (!acta) throw new ActaNoEncontradaError();
  if (acta.estado !== "en firma") throw new EstadoActaInvalidoError("El acta no está en firma.");
  const firma = acta.firmas.find((f) => f.rol_firmante === ROL_FIRMANTE_VICERRECTOR);
  if (!firma) throw new ActaNoEncontradaError();
  if (firma.firmado) throw new EstadoActaInvalidoError("El Vicerrector ya firmó el acta.");

  const correo = (datos.correo ?? "").trim().toLowerCase();
  if (!esCorreoValido(correo)) throw new ActaInvalidaError("El correo del Vicerrector no es válido.", ["correo"]);
  const nombre = datos.nombre?.trim() || firma.nombre;
  const cuenta = await prisma.usuario.findUnique({ where: { correo }, select: { id_usuario: true, hojaVida: { select: { correo_personal: true } } } });
  const correoPersonal = cuenta?.hojaVida?.correo_personal ?? null;

  // Cambiar el correo invalida el enlace anterior (si ya se había enviado).
  await prisma.actaInicioFirma.update({
    where: { id_firma: firma.id_firma },
    data: { nombre, correo, correo_personal: correoPersonal, id_usuario: cuenta?.id_usuario ?? null, token_hash: null, token_expira: null, fecha_envio: null },
  });

  const faltanInvestigadores = acta.firmas.some((f) => !f.firmado && !ROLES_NO_INVESTIGADOR.includes(f.rol_firmante));
  if (!faltanInvestigadores) {
    const detalle = armarDetalle(await cargarProyecto(acta.id_proyecto));
    await enviarSolicitud({ id_firma: firma.id_firma, nombre, correo, correo_personal: correoPersonal, rol_firmante: firma.rol_firmante }, detalle);
  }
  return obtenerActa(acta.id_proyecto, usuario);
}

/** POST /acta-inicio/:id/reenviar-firma — el Administrador vuelve a mandar su enlace a quien no ha firmado. */
export async function reenviarSolicitudes(id_acta_inicio: number, usuario: UsuarioSesion): Promise<ActaDetalle> {
  if (!esAdmin(usuario)) throw new NoAutorizadoActaError("Solo el Administrador reenvía los enlaces de firma");
  const acta = await prisma.actaInicio.findUnique({ where: { id_acta_inicio }, include: { firmas: true } });
  if (!acta) throw new ActaNoEncontradaError();
  if (acta.estado !== "en firma") throw new EstadoActaInvalidoError("El acta no está en firma.");

  const detalle = armarDetalle(await cargarProyecto(acta.id_proyecto));
  const aceptaciones = await prisma.compromisoAceptacion.findMany({ where: { id_acta_inicio } });
  if (
    !aceptacionCompleta(
      detalle.participantes.map((p) => p.id_usuarioproyecto),
      aceptaciones
    )
  ) {
    throw new EstadoActaInvalidoError("Los enlaces salen cuando el grupo haya aceptado todos los compromisos.");
  }
  const investigadoresPendientes = acta.firmas.filter((f) => !f.firmado && !ROLES_NO_INVESTIGADOR.includes(f.rol_firmante));
  const aReenviar = investigadoresPendientes.length > 0 ? investigadoresPendientes : acta.firmas.filter((f) => !f.firmado && f.rol_firmante === ROL_FIRMANTE_VICERRECTOR);
  for (const f of aReenviar) await enviarSolicitud(f, detalle);
  return obtenerActa(acta.id_proyecto, usuario);
}

// ---------------------------------------------------------------------------
// Código de verificación para las firmas de Seguimiento (informes de avance y final, acta de cierre)
// ---------------------------------------------------------------------------

const hashCodigoSeguimiento = (id_usuario: number, id_proyecto: number, codigo: string) =>
  crypto.createHash("sha256").update(`seg:${id_usuario}:${id_proyecto}:${codigo}`).digest("hex");

/** El investigador del proyecto que pide o usa el código: sus datos vienen del numeral 4 del acta de inicio. */
async function participanteConCodigo(id_proyecto: number, usuario: UsuarioSesion) {
  const detalle = armarDetalle(await cargarProyecto(id_proyecto));
  const participante = detalle.participantes.find((p) => p.id_usuario === usuario.id_usuario);
  if (!participante) throw new NoAutorizadoActaError("Solo los investigadores del proyecto firman con código de verificación");
  return { detalle, participante };
}

/** POST /acta-inicio/proyecto/:id/codigo-firma — envía al correo personal del investigador el código para firmar en Seguimiento. */
export async function solicitarCodigoSeguimiento(
  id_proyecto: number,
  usuario: UsuarioSesion,
  documento?: string
): Promise<{ correo_enmascarado: string; vence_en_minutos: number }> {
  const { detalle, participante } = await participanteConCodigo(id_proyecto, usuario);
  const correo = participante.correo_personal?.trim();
  if (!correo) {
    throw new EstadoActaInvalidoError("No tienes correo personal registrado. Pide al Administrador que lo registre en el numeral 4 del acta de inicio.");
  }
  const clave = { id_usuario_id_proyecto: { id_usuario: usuario.id_usuario, id_proyecto } };
  const anterior = await prisma.codigoVerificacionFirma.findUnique({ where: clave });
  const espera = anterior ? Math.ceil((anterior.codigo_enviado.getTime() + CODIGO_INTERVALO_SEG * 1000 - Date.now()) / 1000) : 0;
  if (espera > 0) throw new EstadoActaInvalidoError(`Espera ${espera} segundos antes de pedir otro código.`);

  const codigo = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const datos = {
    codigo_hash: hashCodigoSeguimiento(usuario.id_usuario, id_proyecto, codigo),
    codigo_expira: new Date(Date.now() + CODIGO_VIGENCIA_MIN * 60 * 1000),
    codigo_enviado: new Date(),
    codigo_intentos: 0,
  };
  await prisma.codigoVerificacionFirma.upsert({ where: clave, create: { id_usuario: usuario.id_usuario, id_proyecto, ...datos }, update: datos });
  try {
    await enviarCodigoFirmaActa(correo, participante.nombre, codigo, CODIGO_VIGENCIA_MIN, detalle.titulo, (documento ?? "").trim().slice(0, 80) || "documento de seguimiento");
  } catch (error) {
    console.error(`No se pudo enviar el código de firma a ${correo}:`, error);
    throw new EstadoActaInvalidoError("No se pudo enviar el código al correo personal. Intenta de nuevo en unos minutos.");
  }
  return { correo_enmascarado: enmascararCorreo(correo) ?? "", vence_en_minutos: CODIGO_VIGENCIA_MIN };
}

/** POST /acta-inicio/proyecto/:id/codigo-firma/verificar — comprueba el código (una sola vez) antes de registrar la firma. */
export async function verificarCodigoSeguimiento(id_proyecto: number, usuario: UsuarioSesion, codigo: string | undefined): Promise<{ verificado: true }> {
  await participanteConCodigo(id_proyecto, usuario);
  const limpio = (codigo ?? "").replace(/\s/g, "");
  if (!limpio) throw new CodigoFirmaInvalidoError("Escribe el código de verificación que llegó a tu correo personal.");
  const registro = await prisma.codigoVerificacionFirma.findUnique({ where: { id_usuario_id_proyecto: { id_usuario: usuario.id_usuario, id_proyecto } } });
  if (!registro) throw new CodigoFirmaInvalidoError("Primero solicita el código de verificación.");
  if (registro.codigo_expira < new Date()) throw new CodigoFirmaInvalidoError("El código venció. Solicita uno nuevo.");
  if (registro.codigo_intentos >= CODIGO_MAX_INTENTOS) throw new CodigoFirmaInvalidoError("Se agotaron los intentos. Solicita un código nuevo.");

  const esperado = Buffer.from(registro.codigo_hash, "hex");
  const recibido = Buffer.from(hashCodigoSeguimiento(usuario.id_usuario, id_proyecto, limpio), "hex");
  if (esperado.length !== recibido.length || !crypto.timingSafeEqual(esperado, recibido)) {
    await prisma.codigoVerificacionFirma.update({ where: { id_codigo: registro.id_codigo }, data: { codigo_intentos: { increment: 1 } } });
    throw new CodigoFirmaInvalidoError("El código no es correcto.");
  }
  // Cada código sirve para una sola firma.
  await prisma.codigoVerificacionFirma.delete({ where: { id_codigo: registro.id_codigo } });
  return { verificado: true };
}
