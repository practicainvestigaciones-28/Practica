import type { Request, Response, NextFunction } from "express";
import * as gruposService from "./grupos.service";

/** POST /api/grupos-investigacion - RQF23 (catálogo, solo Admin) */
export async function crearGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, id_tipo_grupo } = req.body;

    if (!nombre || !id_tipo_grupo) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "nombre e id_tipo_grupo son obligatorios" });
      return;
    }

    const grupo = await gruposService.crearGrupo(req.body);
    res.status(201).json({ mensaje: "Grupo de investigación creado correctamente", grupo });
  } catch (error) {
    next(error);
  }
}

/** GET /api/grupos-investigacion */
export async function listarGrupos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const soloActivos = req.query.activo === "true" ? true : undefined;
    res.status(200).json(await gruposService.listarGrupos(soloActivos));
  } catch (error) {
    next(error);
  }
}

function manejarErrorConocido(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof gruposService.GrupoNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof gruposService.GrupoEnUsoError) {
    res.status(409).json({ error: "En uso", mensaje: error.message });
    return;
  }
  next(error);
}

/** PUT /api/grupos-investigacion/:id — editar nombre. Solo Administrador. */
export async function actualizarGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre } = req.body as { nombre?: string };
    if (!nombre) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "El nombre es obligatorio" });
      return;
    }
    const registro = await gruposService.actualizarGrupo(Number(req.params.id), nombre);
    res.status(200).json({ mensaje: "Actualizado correctamente", registro });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PATCH /api/grupos-investigacion/:id/estado — activar/desactivar. Solo Administrador. */
export async function cambiarEstadoGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { activo } = req.body as { activo?: boolean };
    if (typeof activo !== "boolean") {
      res.status(400).json({ error: "Datos incompletos", mensaje: "activo debe ser true o false" });
      return;
    }
    const registro = await gruposService.cambiarEstadoGrupo(Number(req.params.id), activo);
    res.status(200).json({
      mensaje: activo ? "Activado correctamente" : "Desactivado correctamente",
      registro,
    });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** DELETE /api/grupos-investigacion/:id — borrado real. Solo Administrador. */
export async function eliminarGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await gruposService.eliminarGrupo(Number(req.params.id));
    res.status(200).json({ mensaje: "Eliminado correctamente" });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /api/grupos-investigacion/:id */
export async function obtenerGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const grupo = await gruposService.obtenerGrupo(Number(req.params.id));
    res.status(200).json(grupo);
  } catch (error) {
    if (error instanceof gruposService.GrupoNoEncontradoError) {
      res.status(404).json({ error: "No encontrado", mensaje: error.message });
      return;
    }
    next(error);
  }
}
