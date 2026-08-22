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

export interface DatosParticipante {
  participante: number;
  id_dedicacion: number;
  id_rol_pro: number;
  id_rol_estudiante?: number | null;
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

  const [usuario, dedicacion, rolProyecto] = await Promise.all([
    prisma.usuario.findUnique({ where: { id_usuario: datos.participante } }),
    prisma.dedicacion.findUnique({ where: { id_dedicacion: datos.id_dedicacion } }),
    prisma.rolProyecto.findUnique({ where: { id_rol_pro: datos.id_rol_pro } }),
  ]);

  if (!usuario) throw new UsuarioNoEncontradoError();
  if (!dedicacion) throw new CatalogoInvalidoError("id_dedicacion");
  if (!rolProyecto) throw new CatalogoInvalidoError("id_rol_pro");

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
    return await prisma.usuarioProyecto.create({
      data: {
        id_proyecto,
        participante: datos.participante,
        id_dedicacion: datos.id_dedicacion,
        id_rol_pro: datos.id_rol_pro,
        id_rol_estudiante: datos.id_rol_estudiante ?? null,
      },
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
  facultad?: string;
  programa_academico?: string;
  empresa_entidad?: string;
  dedicacion_horas_semanales?: number;
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
