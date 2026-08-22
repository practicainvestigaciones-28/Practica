import type { Request, Response, NextFunction } from "express";
import { obtenerEstadisticas } from "./dashboard.service";

/** GET /api/dashboard/estadisticas - RQF73, RQF74, RQF76 */
export async function estadisticas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const datos = await obtenerEstadisticas({
      id_usuario: req.usuario!.id_usuario,
      roles: req.usuario!.roles,
    });
    res.status(200).json(datos);
  } catch (error) {
    next(error);
  }
}
