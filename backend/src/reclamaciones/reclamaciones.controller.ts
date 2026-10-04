import type { Request, Response, NextFunction } from "express";
import * as reclamacionesService from "./reclamaciones.service";

function manejarErrorConocido(error: unknown, res: Response, next: NextFunction): void {
  if (
    error instanceof reclamacionesService.ProyectoNoEncontradoError ||
    error instanceof reclamacionesService.ReclamacionNoEncontradaError
  ) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof reclamacionesService.NoAutorizadoReclamacionError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  if (
    error instanceof reclamacionesService.ProyectoNoRechazadoError ||
    error instanceof reclamacionesService.ReclamacionYaExisteError
  ) {
    res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
  next(error);
}

/** POST /api/reclamaciones - RQF60. Cualquier usuario autenticado puede reclamar sobre SU proyecto rechazado. */
export async function crearReclamacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_proyecto, motivo } = req.body as { id_proyecto?: number; motivo?: string };
    if (!id_proyecto || !motivo?.trim()) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_proyecto y motivo son obligatorios" });
      return;
    }

    const reclamacion = await reclamacionesService.crearReclamacion(
      Number(id_proyecto),
      req.usuario!.id_usuario,
      motivo.trim()
    );
    res.status(201).json({ mensaje: "Reclamación presentada correctamente", reclamacion });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/**
 * GET /api/reclamaciones - solo Administrador (todas) o ?mias=true (el
 * investigador autenticado consulta solo las suyas).
 */
export async function listarReclamaciones(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const esAdministrador = req.usuario!.roles.includes("Administrador");
    const mias = req.query.mias === "true";

    if (!mias && !esAdministrador) {
      res.status(403).json({
        error: "Acceso denegado",
        mensaje: "Solo el Administrador puede consultar todas las reclamaciones. Usa ?mias=true",
      });
      return;
    }

    const reclamaciones = await reclamacionesService.listarReclamaciones(
      mias ? { id_usuario_reclamante: req.usuario!.id_usuario } : {}
    );
    res.status(200).json(reclamaciones);
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /api/reclamaciones/proyecto/:idProyecto - la reclamación propia (si existe) sobre ese proyecto. */
export async function obtenerReclamacionDeProyecto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reclamacion = await reclamacionesService.obtenerReclamacionDeProyecto(
      Number(req.params.idProyecto),
      req.usuario!.id_usuario
    );
    res.status(200).json(reclamacion);
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PATCH /api/reclamaciones/:id/en-revision - solo Administrador. */
export async function marcarEnRevision(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reclamacion = await reclamacionesService.marcarEnRevision(Number(req.params.id));
    res.status(200).json({ mensaje: "Reclamación marcada en revisión", reclamacion });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PATCH /api/reclamaciones/:id/responder - RQF63. Solo Administrador. */
export async function responderReclamacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { respuesta } = req.body as { respuesta?: string };
    if (!respuesta?.trim()) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "respuesta es obligatoria" });
      return;
    }

    const reclamacion = await reclamacionesService.responderReclamacion(
      Number(req.params.id),
      req.usuario!.id_usuario,
      respuesta.trim()
    );
    res.status(200).json({ mensaje: "Reclamación respondida correctamente", reclamacion });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}
