import type { Request, Response, NextFunction } from "express";
import * as convocatoriasService from "./convocatorias.service";

function manejarErrorConocido(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof convocatoriasService.ConvocatoriaNoEncontradaError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (
    error instanceof convocatoriasService.RangoFechasInvalidoError ||
    error instanceof convocatoriasService.EstadoInvalidoError
  ) {
    res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
    if (error instanceof convocatoriasService.ConvocatoriaConProyectosError) {
    res.status(409).json({ error: "No permitido", mensaje: error.message });
    return;
  }
  next(error);
}

/** POST /api/convocatorias - RQF09 */
export async function crearConvocatoria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, descripcion, fecha_inicio, fecha_fin } = req.body;

    if (!nombre || !fecha_inicio || !fecha_fin) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "nombre, fecha_inicio y fecha_fin son obligatorios",
      });
      return;
    }

    const convocatoria = await convocatoriasService.crearConvocatoria(
      {
        nombre,
        descripcion,
        fecha_inicio: new Date(fecha_inicio),
        fecha_fin: new Date(fecha_fin),
      },
      req.usuario!.id_usuario
    );

    res.status(201).json({ mensaje: "Convocatoria creada correctamente", convocatoria });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /api/convocatorias - RQF12 */
export async function listarConvocatorias(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { estado } = req.query;
    const convocatorias = await convocatoriasService.listarConvocatorias({
      estado: typeof estado === "string" ? estado : undefined,
    });
    res.status(200).json(convocatorias);
  } catch (error) {
    next(error);
  }
}

/** GET /api/convocatorias/:id */
export async function obtenerConvocatoria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const convocatoria = await convocatoriasService.obtenerConvocatoria(Number(req.params.id));
    res.status(200).json(convocatoria);
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PUT /api/convocatorias/:id - RQF10 */
export async function actualizarConvocatoria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, descripcion, fecha_inicio, fecha_fin } = req.body;

    const convocatoria = await convocatoriasService.actualizarConvocatoria(Number(req.params.id), {
      ...(nombre !== undefined ? { nombre } : {}),
      ...(descripcion !== undefined ? { descripcion } : {}),
      ...(fecha_inicio !== undefined ? { fecha_inicio: new Date(fecha_inicio) } : {}),
      ...(fecha_fin !== undefined ? { fecha_fin: new Date(fecha_fin) } : {}),
    });

    res.status(200).json({ mensaje: "Convocatoria actualizada correctamente", convocatoria });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PATCH /api/convocatorias/:id/estado - RQF11 */
export async function cambiarEstadoConvocatoria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { estado } = req.body as { estado?: string };

    if (!estado) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "El campo estado es obligatorio" });
      return;
    }

    const convocatoria = await convocatoriasService.cambiarEstadoConvocatoria(Number(req.params.id), estado);

    res.status(200).json({ mensaje: `Convocatoria actualizada a estado "${estado}"`, convocatoria });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** DELETE /api/convocatorias/:id */
export async function eliminarConvocatoria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await convocatoriasService.eliminarConvocatoria(Number(req.params.id));
    res.status(200).json({ mensaje: "Convocatoria eliminada correctamente" });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}