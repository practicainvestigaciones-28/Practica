import type { Request, Response, NextFunction } from "express";
import * as service from "./convocatoria-ventanas.service";
import { emitirCambio } from "../ws/socket";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof service.ConvocatoriaNoEncontradaError || error instanceof service.VentanaNoEncontradaError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof service.VentanaInvalidaError) {
    res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
  next(error);
}

/** GET /api/convocatorias/:id/ventanas */
export async function obtenerVentanas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.obtenerVentanas(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PUT /api/convocatorias/:id/ventanas — { ventanas: [{ fase, abre_en, cierra_en }] }. Solo Administrador. */
export async function guardarVentanas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ventanas } = req.body as { ventanas?: { fase?: string; abre_en?: string; cierra_en?: string }[] };
    if (!Array.isArray(ventanas) || ventanas.some((v) => !v.fase || !v.abre_en || !v.cierra_en)) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "ventanas debe ser un arreglo con fase, abre_en y cierra_en" });
      return;
    }
    const registro = await service.guardarVentanas(
      Number(req.params.id),
      ventanas.map((v) => ({ fase: v.fase!, abre_en: new Date(v.abre_en!), cierra_en: new Date(v.cierra_en!) })),
      req.usuario!.id_usuario
    );
    emitirCambio("convocatorias");
    res.status(200).json({ mensaje: "Plazos de revisión actualizados correctamente", ventanas: registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PATCH /api/convocatorias/:id/ventanas/:fase/reabrir. Solo Administrador. */
export async function reabrirVentana(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const registro = await service.reabrirVentana(Number(req.params.id), String(req.params.fase));
    emitirCambio("convocatorias");
    res.status(200).json({ mensaje: "Fase reabierta", ventanas: registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PATCH /api/convocatorias/:id/ventanas/:fase/cerrar — termina la reapertura. Solo Administrador. */
export async function cerrarVentana(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const registro = await service.cerrarVentana(Number(req.params.id), String(req.params.fase));
    emitirCambio("convocatorias");
    res.status(200).json({ mensaje: "Fase cerrada", ventanas: registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
