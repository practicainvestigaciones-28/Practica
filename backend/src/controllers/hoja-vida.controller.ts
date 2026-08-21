import type { Request, Response, NextFunction } from "express";
import * as hojaVidaService from "../services/hoja-vida.service";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof hojaVidaService.UsuarioNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof hojaVidaService.NoAutorizadoHojaVidaError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  next(error);
}

/** PUT /api/usuarios/:id/hoja-vida - RQF35 */
export async function registrarHojaVida(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const registro = await hojaVidaService.registrarHojaVida(Number(req.params.id), req.body, {
      id_usuario: req.usuario!.id_usuario,
      roles: req.usuario!.roles,
    });
    res.status(200).json({ mensaje: "Hoja de vida registrada correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /api/usuarios/:id/hoja-vida */
export async function obtenerHojaVida(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const registro = await hojaVidaService.obtenerHojaVida(Number(req.params.id));
    if (!registro) {
      res.status(404).json({ error: "No encontrado", mensaje: "Este usuario aún no tiene hoja de vida registrada" });
      return;
    }
    res.status(200).json(registro);
  } catch (error) {
    manejarError(error, res, next);
  }
}
