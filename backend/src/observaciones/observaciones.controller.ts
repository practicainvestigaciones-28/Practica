import type { Request, Response, NextFunction } from "express";
import * as observacionesService from "./observaciones.service";

function manejarErrorConocido(error: unknown, res: Response, next: NextFunction): void {
  if (
    error instanceof observacionesService.ProyectoNoEncontradoError ||
    error instanceof observacionesService.DocumentoNoEncontradoError ||
    error instanceof observacionesService.EtapaNoEncontradaError ||
    error instanceof observacionesService.ObservacionNoEncontradaError
  ) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof observacionesService.NoAutorizadoObservacionError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  next(error);
}

/**
 * POST /api/proyectos/:id/documentos/:idDocumento/observaciones - RQF40/RQF60
 * Acepta multipart/form-data: el adjunto opcional viaja en el campo "archivo".
 */
export async function crearObservacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_etapa, observacion } = req.body as { id_etapa?: string; observacion?: string };

    if (!id_etapa || !observacion) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "id_etapa y observacion son obligatorios",
      });
      return;
    }

    const creada = await observacionesService.crearObservacion(
      Number(req.params.id),
      Number(req.params.idDocumento),
      {
        id_etapa: Number(id_etapa),
        id_usuario: req.usuario!.id_usuario,
        observacion,
        archivo_adjunto: req.file?.filename,
      }
    );

    res.status(201).json({ mensaje: "Observación registrada correctamente", observacion: creada });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /api/proyectos/:id/documentos/:idDocumento/observaciones - RQF40 */
export async function listarObservacionesDocumento(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const observaciones = await observacionesService.listarObservacionesDocumento(
      Number(req.params.id),
      Number(req.params.idDocumento)
    );
    res.status(200).json(observaciones);
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /api/proyectos/:id/observaciones?id_etapa= - RQF60 */
export async function listarObservacionesProyecto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id_etapa } = req.query;
    const observaciones = await observacionesService.listarObservacionesProyecto(
      Number(req.params.id),
      { id_etapa: id_etapa ? Number(id_etapa) : undefined }
    );
    res.status(200).json(observaciones);
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** DELETE /api/proyectos/:id/observaciones/:idObservacion - autor o Administrador */
export async function eliminarObservacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await observacionesService.eliminarObservacion(
      Number(req.params.id),
      Number(req.params.idObservacion),
      { id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles }
    );
    res.status(200).json({ mensaje: "Observación eliminada correctamente" });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}
