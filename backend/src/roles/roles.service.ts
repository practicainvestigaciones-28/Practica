import { prisma } from "../config/prisma";

export class RolNoEncontradoError extends Error {
  constructor() {
    super("El rol indicado no existe");
  }
}

export class RolDuplicadoError extends Error {
  constructor() {
    super("Ya existe un rol registrado con ese nombre");
  }
}

export class UsuarioNoEncontradoError extends Error {
  constructor() {
    super("El usuario no existe");
  }
}

/** RQF06 - Listado de roles del sistema (activos e inactivos), para el panel de Administrador. */
export async function listarRoles() {
  return prisma.rol.findMany({ orderBy: { nombre: "asc" } });
}

/** RQF06 - Crear un nuevo rol. */
export async function crearRol(nombre: string, descripcion?: string) {
  const existente = await prisma.rol.findUnique({ where: { nombre } });
  if (existente) throw new RolDuplicadoError();

  return prisma.rol.create({ data: { nombre, descripcion } });
}

/** RQF06 - Editar nombre/descripción de un rol existente. */
export async function actualizarRol(id_rol: number, cambios: { nombre?: string; descripcion?: string }) {
  const existente = await prisma.rol.findUnique({ where: { id_rol } });
  if (!existente) throw new RolNoEncontradoError();

  if (cambios.nombre && cambios.nombre !== existente.nombre) {
    const nombreTomado = await prisma.rol.findUnique({ where: { nombre: cambios.nombre } });
    if (nombreTomado) throw new RolDuplicadoError();
  }

  return prisma.rol.update({
    where: { id_rol },
    data: { nombre: cambios.nombre, descripcion: cambios.descripcion },
  });
}

/**
 * RQF06 - Activar/desactivar un rol. No se borra físicamente: un DELETE real
 * dejaría huérfanas las filas de roles_usuario/permisosrol que ya lo usan.
 */
export async function cambiarEstadoRol(id_rol: number, estado: boolean) {
  const existente = await prisma.rol.findUnique({ where: { id_rol } });
  if (!existente) throw new RolNoEncontradoError();

  return prisma.rol.update({ where: { id_rol }, data: { estado } });
}

/** RQF07 - Roles actualmente asignados a un usuario. */
export async function listarRolesDeUsuario(id_usuario: number) {
  const usuario = await prisma.usuario.findUnique({ where: { id_usuario } });
  if (!usuario) throw new UsuarioNoEncontradoError();

  const asignaciones = await prisma.rolesUsuario.findMany({
    where: { id_usuario },
    include: { rol: true },
    orderBy: { rol: { nombre: "asc" } },
  });
  return asignaciones.map((a) => a.rol);
}

/**
 * RQF07 - Asigna roles múltiples a un usuario, reemplazando el conjunto
 * actual (equivalente a "estos son los roles que debe tener ahora").
 * Distinto del `rol` singular que maneja usuarios.service en la creación:
 * este endpoint es el que permite verdadero multirol.
 */
export async function asignarRolesUsuario(id_usuario: number, idsRoles: number[]) {
  const usuario = await prisma.usuario.findUnique({ where: { id_usuario } });
  if (!usuario) throw new UsuarioNoEncontradoError();

  const idsUnicos = [...new Set(idsRoles)];
  const rolesExistentes = await prisma.rol.findMany({ where: { id_rol: { in: idsUnicos } } });
  if (rolesExistentes.length !== idsUnicos.length) throw new RolNoEncontradoError();

  await prisma.$transaction([
    prisma.rolesUsuario.deleteMany({ where: { id_usuario } }),
    prisma.rolesUsuario.createMany({ data: idsUnicos.map((id_rol) => ({ id_usuario, id_rol })) }),
  ]);

  return listarRolesDeUsuario(id_usuario);
}
