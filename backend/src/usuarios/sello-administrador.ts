import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";

/**
 * Nombre y cargo con que la Administración aparece en el sello de las actas e
 * informes ("Elaborado por" / "Revisado por"). Es el del Administrador indicado
 * (quien firmó el documento) o, si no se indica o no es Administrador, el del
 * primer Administrador activo. El cargo sale de su hoja de vida (cargo_actual,
 * que el Administrador diligencia en su Perfil).
 */
export async function obtenerSelloAdministrador(id_usuario?: number): Promise<{ nombre: string; cargo: string } | null> {
  const esAdmin = { roles: { some: { rol: { nombre: "Administrador" } } } };
  const seleccion = { nombre: true, apellido: true, hojaVida: { select: { cargo_actual: true } } } as const;
  const indicado = id_usuario
    ? await prisma.usuario.findFirst({ where: { id_usuario, ...esAdmin }, select: seleccion })
    : null;
  const admin =
    indicado ?? (await prisma.usuario.findFirst({ where: { activo: true, ...esAdmin }, orderBy: { id_usuario: "asc" }, select: seleccion }));
  if (!admin) return null;
  return { nombre: `${admin.nombre} ${admin.apellido}`.trim(), cargo: admin.hojaVida?.cargo_actual?.trim() ?? "" };
}

/** GET /usuarios/sello-administrador?id_usuario=... */
export async function selloAdministrador(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.query.id_usuario);
    res.status(200).json(await obtenerSelloAdministrador(Number.isInteger(id) && id > 0 ? id : undefined));
  } catch (error) {
    next(error);
  }
}
