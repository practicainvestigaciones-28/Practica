import type { Request, Response, NextFunction } from "express";
import * as permisosService from "./permisos.service";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof permisosService.RolNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof permisosService.PermisoNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  next(error);
}

/** GET /api/permisos - RQF08 */
export async function listarPermisos(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await permisosService.listarPermisos());
  } catch (error) {
    next(error);
  }
}

/** POST /api/permisos - RQF08, solo Administrador */
export async function crearPermiso(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, descripcion } = req.body as { nombre?: string; descripcion?: string };
    if (!nombre) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "El nombre es obligatorio" });
      return;
    }

    const permiso = await permisosService.crearPermiso(nombre, descripcion);
    res.status(201).json({ mensaje: "Permiso creado correctamente", permiso });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /api/roles/:id/permisos - RQF08 */
export async function listarPermisosDeRol(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const permisos = await permisosService.listarPermisosDeRol(Number(req.params.id));
    res.status(200).json(permisos);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PUT /api/roles/:id/permisos - RQF08, solo Administrador. Body: { permisos: number[] } (ids de permiso) */
export async function asignarPermisosRol(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { permisos } = req.body as { permisos?: number[] };
    if (!Array.isArray(permisos) || !permisos.every((p) => Number.isInteger(p))) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "permisos debe ser un arreglo de ids de permiso (puede ir vacío para quitarlos todos)",
      });
      return;
    }

    const permisosAsignados = await permisosService.asignarPermisosRol(Number(req.params.id), permisos);
    res.status(200).json({ mensaje: "Permisos asignados correctamente", permisos: permisosAsignados });
  } catch (error) {
    manejarError(error, res, next);
  }
}
