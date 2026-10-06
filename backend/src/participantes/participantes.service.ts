import { prisma } from "../config/prisma";
import { verificarPermisoProyecto, ProyectoNoEncontradoError } from "../utils/permisosProyecto";
export { ProyectoNoEncontradoError, NoAutorizadoProyectoError as NoAutorizadoError } from "../utils/permisosProyecto";

export class UsuarioNoEncontradoError extends Error {
  constructor() {
    super("El usuario indicado como participante no existe");
  }
}

export class CatalogoInvalidoError extends Error {
  constructor(campo: string) {
    super(`${campo} no es válido`);
  }
}

export class RolEstudianteNoAplicaError extends Error {
  constructor() {
    super('id_rol_estudiante solo aplica cuando el rol dentro del proyecto es "Estudiante Investigador(a)"');
  }
}

export class ParticipanteDuplicadoError extends Error {
  constructor() {
    super("Este usuario ya está registrado como participante en el proyecto");
  }
}

export class ParticipacionNoEncontradaError extends Error {
  constructor() {
    super("Esa participación no existe en el proyecto");
  }
}

export class DatosParticipanteIncompletosError extends Error {
  constructor() {
    super("Debes indicar un participante existente (participante) o sus datos (nombre y correo)");
  }
}

export interface DatosParticipante {
  /** Cuenta ya existente, elegida por búsqueda (ej. investigador extra de un grupo, egresado). */
  participante?: number;
  /**
   * Alternativa a `participante`: datos diligenciados a mano (co-investigador,
   * externo, egresado, estudiante). Si el correo coincide con una cuenta ya
   * registrada, se vincula a esa cuenta — si no, el participante queda como
   * dato plano, SIN crear ninguna cuenta nueva (ver agregarParticipante).
   */
  nombre?: string;
  apellido?: string;
  correo?: string;
  id_dedicacion: number;
  /** Horas semanales dedicadas al proyecto, reportadas en texto libre (no la categoría TC/MT/HC). */
  horas_semanales?: number | null;
  id_rol_pro: number;
  id_rol_estudiante?: number | null;
  /** ORCID/Google Académico reportados para este proyecto (no la hoja de vida maestra del usuario). */
  orcid?: string;
  google_academico?: string;
  /** Solo aplica al rol "Estudiante Investigador". */
  codigo_estudiantil?: string;
}

// verificarPermisoProyecto se importa del helper compartido (ver arriba)

/**
 * RQF17 - Registro de participantes del proyecto.
 * Valida que exista el usuario, la dedicación y el rol de proyecto, y que
 * `id_rol_estudiante` solo se use cuando el rol corresponde a estudiante.
 */
export async function agregarParticipante(
  id_proyecto: number,
  datos: DatosParticipante,
  usuarioQueEdita: { id_usuario: number; roles: string[] }
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  if (!datos.participante && !datos.correo) throw new DatosParticipanteIncompletosError();

  const [dedicacion, rolProyecto] = await Promise.all([
    prisma.dedicacion.findUnique({ where: { id_dedicacion: datos.id_dedicacion } }),
    prisma.rolProyecto.findUnique({ where: { id_rol_pro: datos.id_rol_pro } }),
  ]);

  if (!dedicacion) throw new CatalogoInvalidoError("id_dedicacion");
  if (!rolProyecto) throw new CatalogoInvalidoError("id_rol_pro");

  // Un participante de proyecto (co-investigador, externo, egresado,
  // estudiante) NUNCA debe generar una cuenta nueva solo por diligenciar
  // este formulario — únicamente el Investigador Principal tiene acceso
  // real, y ya lo tiene desde antes (es quien inició sesión). Por eso, si no
  // viene `participante` ya resuelto (elegido por búsqueda), se busca por
  // correo una cuenta YA existente; si no hay ninguna, el participante queda
  // como dato plano (nombre_manual/apellido_manual/correo_manual), sin
  // crear nada en la tabla Usuario.
  let idParticipanteUsuario: number | null = null;
  let datosManuales: { nombre_manual?: string; apellido_manual?: string; correo_manual?: string } = {};

  if (datos.participante) {
    const usuario = await prisma.usuario.findUnique({ where: { id_usuario: datos.participante } });
    if (!usuario) throw new UsuarioNoEncontradoError();
    idParticipanteUsuario = usuario.id_usuario;
  } else {
    const correo = datos.correo!.toLowerCase().trim();
    const usuarioExistente = await prisma.usuario.findUnique({ where: { correo } });
    if (usuarioExistente) {
      idParticipanteUsuario = usuarioExistente.id_usuario;
    } else {
      datosManuales = {
        nombre_manual: datos.nombre?.trim(),
        apellido_manual: datos.apellido?.trim(),
        correo_manual: correo,
      };
    }
  }

  const esRolEstudiante = rolProyecto.nombre.toLowerCase().includes("estudiante");

  if (datos.id_rol_estudiante && !esRolEstudiante) {
    throw new RolEstudianteNoAplicaError();
  }

  if (datos.id_rol_estudiante) {
    const rolEstudiante = await prisma.rolEstudiante.findUnique({
      where: { id_rolestudiante: datos.id_rol_estudiante },
    });
    if (!rolEstudiante) throw new CatalogoInvalidoError("id_rol_estudiante");
  }

  try {
    const creado = await prisma.usuarioProyecto.create({
      data: {
        id_proyecto,
        participante: idParticipanteUsuario,
        ...datosManuales,
        id_dedicacion: datos.id_dedicacion,
        horas_semanales: datos.horas_semanales,
        id_rol_pro: datos.id_rol_pro,
        id_rol_estudiante: datos.id_rol_estudiante ?? null,
        orcid: datos.orcid,
        google_academico: datos.google_academico,
        codigo_estudiantil: datos.codigo_estudiantil,
      },
    });

    // Las relaciones se leen aparte y no con "include" dentro del create: ahí
    // Prisma las pide en paralelo por la única conexión de la transacción del
    // create, y el driver `pg` avisa (DeprecationWarning: "client.query() ...
    // already executing a query"). Leídas fuera de la transacción no pasa.
    return await prisma.usuarioProyecto.findUniqueOrThrow({
      where: { id_usuarioproyecto: creado.id_usuarioproyecto },
      include: {
        usuario: { select: { id_usuario: true, nombre: true, apellido: true, correo: true } },
        dedicacion: true,
        rolProyecto: true,
        rolEstudiante: true,
      },
    });
  } catch (error: unknown) {
    // P2002 = violación de índice único (@@unique([id_proyecto, participante]))
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new ParticipanteDuplicadoError();
    }
    throw error;
  }
}

/** Consulta de participantes de un proyecto (soporte a RQF15/RQF17) */
export async function listarParticipantes(id_proyecto: number) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id_proyecto } });
  if (!proyecto) throw new ProyectoNoEncontradoError();

  return prisma.usuarioProyecto.findMany({
    where: { id_proyecto },
    include: {
      usuario: { select: { id_usuario: true, nombre: true, apellido: true, correo: true } },
      dedicacion: true,
      rolProyecto: true,
      rolEstudiante: true,
    },
  });
}

/** Editar la dedicación/rol de un participante ya registrado */
export async function actualizarParticipante(
  id_proyecto: number,
  id_usuarioproyecto: number,
  cambios: Partial<Omit<DatosParticipante, "participante">>,
  usuarioQueEdita: { id_usuario: number; roles: string[] }
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  const existente = await prisma.usuarioProyecto.findUnique({ where: { id_usuarioproyecto } });
  if (!existente || existente.id_proyecto !== id_proyecto) {
    throw new ParticipacionNoEncontradaError();
  }

  const id_rol_pro = cambios.id_rol_pro ?? existente.id_rol_pro;

  if (cambios.id_dedicacion !== undefined) {
    const dedicacion = await prisma.dedicacion.findUnique({ where: { id_dedicacion: cambios.id_dedicacion } });
    if (!dedicacion) throw new CatalogoInvalidoError("id_dedicacion");
  }

  if (cambios.id_rol_pro !== undefined) {
    const rolProyecto = await prisma.rolProyecto.findUnique({ where: { id_rol_pro: cambios.id_rol_pro } });
    if (!rolProyecto) throw new CatalogoInvalidoError("id_rol_pro");
  }

  if (cambios.id_rol_estudiante) {
    const rolProyectoActual = await prisma.rolProyecto.findUnique({ where: { id_rol_pro } });
    const esRolEstudiante = rolProyectoActual?.nombre.toLowerCase().includes("estudiante") ?? false;
    if (!esRolEstudiante) throw new RolEstudianteNoAplicaError();

    const rolEstudiante = await prisma.rolEstudiante.findUnique({
      where: { id_rolestudiante: cambios.id_rol_estudiante },
    });
    if (!rolEstudiante) throw new CatalogoInvalidoError("id_rol_estudiante");
  }

  return prisma.usuarioProyecto.update({
    where: { id_usuarioproyecto },
    data: cambios,
    include: {
      usuario: { select: { id_usuario: true, nombre: true, apellido: true, correo: true } },
      dedicacion: true,
      rolProyecto: true,
      rolEstudiante: true,
    },
  });
}

/** Quitar un participante del proyecto */
export async function quitarParticipante(
  id_proyecto: number,
  id_usuarioproyecto: number,
  usuarioQueEdita: { id_usuario: number; roles: string[] }
): Promise<void> {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  const existente = await prisma.usuarioProyecto.findUnique({ where: { id_usuarioproyecto } });
  if (!existente || existente.id_proyecto !== id_proyecto) {
    throw new ParticipacionNoEncontradaError();
  }

  await prisma.usuarioProyecto.delete({ where: { id_usuarioproyecto } });
}

// ---------------------------------------------------------------------------
// RQF24 - Información de egresados vinculados al proyecto
// ---------------------------------------------------------------------------

export interface DatosEgresado {
  id_facultad?: number;
  id_programa?: number;
  /** Solo aplican si la facultad/programa no existe en el catálogo. */
  facultad?: string;
  programa_academico?: string;
  empresa_entidad?: string;
  dedicacion_horas_semanales?: number;
  /** Diligenciada manualmente en el formulario: el egresado puede no tener este dato en su ficha de Usuario. */
  cedula?: string;
}

/**
 * Registra o actualiza la información de egresado de un participante ya
 * existente en el proyecto. No valida que el rol_pro sea "egresado" a
 * propósito: el diccionario original no ata esa restricción a nivel de
 * datos, así que se deja abierto por si el registro se hace antes de fijar
 * el rol definitivo.
 */
export async function registrarEgresado(
  id_proyecto: number,
  id_usuarioproyecto: number,
  datos: DatosEgresado,
  usuarioQueEdita: { id_usuario: number; roles: string[] }
) {
  await verificarPermisoProyecto(id_proyecto, usuarioQueEdita);

  const participacion = await prisma.usuarioProyecto.findUnique({ where: { id_usuarioproyecto } });
  if (!participacion || participacion.id_proyecto !== id_proyecto) {
    throw new ParticipacionNoEncontradaError();
  }

  return prisma.informacionEgresado.upsert({
    where: { id_usuarioproyecto },
    update: datos,
    create: { id_usuarioproyecto, ...datos },
  });
}

export async function obtenerEgresado(id_proyecto: number, id_usuarioproyecto: number) {
  const participacion = await prisma.usuarioProyecto.findUnique({ where: { id_usuarioproyecto } });
  if (!participacion || participacion.id_proyecto !== id_proyecto) {
    throw new ParticipacionNoEncontradaError();
  }

  return prisma.informacionEgresado.findUnique({ where: { id_usuarioproyecto } });
}
