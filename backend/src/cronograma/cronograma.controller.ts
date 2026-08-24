import type { Request, Response, NextFunction } from "express";
import * as cronogramaService from "./cronograma.service";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (
    error instanceof cronogramaService.ProyectoNoEncontradoError ||
    error instanceof cronogramaService.ActividadNoEncontradaError
  ) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof cronogramaService.NoAutorizadoProyectoError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  if (error instanceof cronogramaService.MesInvalidoError) {
    res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
  next(error);
}

function usuarioReq(req: Request) {
  return { id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles };
}

export async function agregarActividad(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { responsable, actividad, resultado } = req.body;
    if (!responsable || !actividad) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "responsable y actividad son obligatorios" });
      return;
    }
    const registro = await cronogramaService.agregarActividad(
      Number(req.params.id),
      { responsable, actividad, resultado },
      usuarioReq(req)
    );
    res.status(201).json({ mensaje: "Actividad registrada correctamente", actividad: registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}

export async function listarActividades(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await cronogramaService.listarActividades(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

export async function quitarActividad(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await cronogramaService.quitarActividad(Number(req.params.id), Number(req.params.idActividad), usuarioReq(req));
    res.status(200).json({ mensaje: "Actividad eliminada correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}

export async function programarActividad(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_periodo, año, mes } = req.body;
    if (!id_periodo || !año || !mes) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_periodo, año y mes son obligatorios" });
      return;
    }
    const registro = await cronogramaService.programarActividad(
      Number(req.params.id),
      Number(req.params.idActividad),
      { id_periodo, año, mes },
      usuarioReq(req)
    );
    res.status(201).json({ mensaje: "Actividad programada correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
