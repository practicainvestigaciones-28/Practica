import type { Request, Response, NextFunction } from "express";
import * as rolesService from "./roles.service";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof rolesService.RolNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof rolesService.RolDuplicadoError) {
    res.status(409).json({ error: "Rol duplicado", mensaje: error.message });
    return;
  }
  if (error instanceof rolesService.UsuarioNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  next(error);
}

/** GET /api/roles - RQF06 */
export async function listarRoles(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await rolesService.listarRoles());
  } catch (error) {
    next(error);
  }
}

/** POST /api/roles - RQF06, solo Administrador */
export async function crearRol(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, descripcion } = req.body as { nombre?: string; descripcion?: string };
    if (!nombre) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "El nombre es obligatorio" });
      return;
    }

    const rol = await rolesService.crearRol(nombre, descripcion);
    res.status(201).json({ mensaje: "Rol creado correctamente", rol });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PUT /api/roles/:id - RQF06, solo Administrador */
export async function actualizarRol(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, descripcion } = req.body as { nombre?: string; descripcion?: string };
    const rol = await rolesService.actualizarRol(Number(req.params.id), { nombre, descripcion });
    res.status(200).json({ mensaje: "Rol actualizado correctamente", rol });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PATCH /api/roles/:id/estado - RQF06, solo Administrador */
export async function cambiarEstadoRol(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { estado } = req.body as { estado?: boolean };
    if (typeof estado !== "boolean") {
      res.status(400).json({ error: "Datos incompletos", mensaje: "estado debe ser true o false" });
      return;
    }

    const rol = await rolesService.cambiarEstadoRol(Number(req.params.id), estado);
    res.status(200).json({
      mensaje: estado ? "Rol activado correctamente" : "Rol desactivado correctamente",
      rol,
    });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /api/usuarios/:id/roles - RQF07 */
export async function listarRolesDeUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roles = await rolesService.listarRolesDeUsuario(Number(req.params.id));
    res.status(200).json(roles);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PUT /api/usuarios/:id/roles - RQF07, solo Administrador. Body: { roles: number[] } (ids de rol) */
export async function asignarRolesUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roles } = req.body as { roles?: number[] };
    if (!Array.isArray(roles) || roles.length === 0 || !roles.every((r) => Number.isInteger(r))) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "roles debe ser un arreglo con al menos un id de rol",
      });
      return;
    }

    const rolesAsignados = await rolesService.asignarRolesUsuario(Number(req.params.id), roles);
    res.status(200).json({ mensaje: "Roles asignados correctamente", roles: rolesAsignados });
  } catch (error) {
    manejarError(error, res, next);
  }
}
