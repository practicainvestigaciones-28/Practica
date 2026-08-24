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
export async function listarGrupos(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await gruposService.listarGrupos());
  } catch (error) {
    next(error);
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
