import type { Request, Response, NextFunction } from "express";
import * as service from "./convocatoria-opciones.service";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof service.ConvocatoriaNoEncontradaError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof service.TipoCatalogoInvalidoError || error instanceof service.ItemCatalogoInvalidoError) {
    res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
  next(error);
}

/** GET /api/convocatorias/:id/opciones?tipo=programa */
export async function obtenerOpciones(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tipo = typeof req.query.tipo === "string" ? req.query.tipo : undefined;
    res.status(200).json(await service.obtenerOpciones(Number(req.params.id), tipo));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PUT /api/convocatorias/:id/opciones — { tipo, ids }. Solo Administrador. */
export async function reemplazarOpciones(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tipo, ids } = req.body as { tipo?: string; ids?: number[] };
    if (!tipo || !Array.isArray(ids)) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "tipo e ids (arreglo) son obligatorios" });
      return;
    }
    const registro = await service.reemplazarOpciones(Number(req.params.id), tipo, ids);
    res.status(200).json({ mensaje: "Opciones actualizadas correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /api/convocatorias/:id/limites-texto */
export async function obtenerLimitesTexto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.obtenerLimitesTexto(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PUT /api/convocatorias/:id/limites-texto — { limites: {clave, max_caracteres}[] }. Solo Administrador. */
export async function reemplazarLimitesTexto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { limites } = req.body as { limites?: { clave: string; max_caracteres: number }[] };
    if (!Array.isArray(limites)) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "limites debe ser un arreglo" });
      return;
    }
    const registro = await service.reemplazarLimitesTexto(Number(req.params.id), limites);
    res.status(200).json({ mensaje: "Límites actualizados correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
