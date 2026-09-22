import type { Request, Response, NextFunction } from "express";
import * as service from "./notificaciones.service";

/** GET /api/notificaciones — las del usuario autenticado. */
export async function listarNotificaciones(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.listarNotificaciones(req.usuario!.id_usuario));
  } catch (error) {
    next(error);
  }
}

/** GET /api/notificaciones/no-leidas — solo el conteo, para el punto rojo de la campana. */
export async function contarNoLeidas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const total = await service.contarNoLeidas(req.usuario!.id_usuario);
    res.status(200).json({ total });
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/notificaciones/:id/leida */
export async function marcarLeida(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.marcarLeida(Number(req.params.id), req.usuario!.id_usuario);
    res.status(200).json({ mensaje: "Notificación marcada como leída" });
  } catch (error) {
    if (error instanceof service.NotificacionNoEncontradaError) {
      res.status(404).json({ error: "No encontrado", mensaje: error.message });
      return;
    }
    next(error);
  }
}

/** POST /api/notificaciones — crear una notificación para otro usuario. Solo Administrador. */
export async function crearNotificacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_usuario, titulo, mensaje, enlace } = req.body;
    if (!id_usuario || !titulo || !mensaje) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_usuario, titulo y mensaje son obligatorios" });
      return;
    }
    const registro = await service.crearNotificacion(Number(id_usuario), { titulo, mensaje, enlace });
    res.status(201).json({ mensaje: "Notificación creada correctamente", registro });
  } catch (error) {
    next(error);
  }
}
