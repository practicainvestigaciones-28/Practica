import { prisma } from "../config/prisma";

export class RolNoEncontradoError extends Error {
  constructor() {
    super("El rol indicado no existe");
  }
}

export class PermisoNoEncontradoError extends Error {
  constructor() {
    super("El permiso indicado no existe");
  }
}

/** RQF08 - Catálogo de permisos disponibles en el sistema. */
export async function listarPermisos() {
  return prisma.permiso.findMany({ orderBy: { nombre: "asc" } });
}

/** RQF08 - Crear un nuevo permiso en el catálogo. */
export async function crearPermiso(nombre: string, descripcion?: string) {
  return prisma.permiso.create({ data: { nombre, descripcion } });
}

/** RQF08 - Permisos actualmente asociados a un rol. */
export async function listarPermisosDeRol(id_rol: number) {
  const rol = await prisma.rol.findUnique({ where: { id_rol } });
  if (!rol) throw new RolNoEncontradoError();

  const asignaciones = await prisma.permisosRol.findMany({
    where: { id_rol },
    include: { permiso: true },
    orderBy: { permiso: { nombre: "asc" } },
  });
  return asignaciones.map((a) => a.permiso);
}

/**
 * RQF08 - Asocia permisos a un rol, reemplazando el conjunto actual
 * (equivalente a "estos son los permisos que debe tener este rol ahora").
 * Un arreglo vacío es válido: deja al rol sin permisos asignados.
 */
export async function asignarPermisosRol(id_rol: number, idsPermisos: number[]) {
  const rol = await prisma.rol.findUnique({ where: { id_rol } });
  if (!rol) throw new RolNoEncontradoError();

  const idsUnicos = [...new Set(idsPermisos)];
  if (idsUnicos.length > 0) {
    const permisosExistentes = await prisma.permiso.findMany({ where: { id_permiso: { in: idsUnicos } } });
    if (permisosExistentes.length !== idsUnicos.length) throw new PermisoNoEncontradoError();
  }

  await prisma.$transaction([
    prisma.permisosRol.deleteMany({ where: { id_rol } }),
    ...(idsUnicos.length > 0
      ? [prisma.permisosRol.createMany({ data: idsUnicos.map((id_permiso) => ({ id_rol, id_permiso })) })]
      : []),
  ]);

  return listarPermisosDeRol(id_rol);
}
