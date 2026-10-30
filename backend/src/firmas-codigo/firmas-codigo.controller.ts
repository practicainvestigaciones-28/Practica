import type { NextFunction, Request, Response } from "express";
import * as firmasCodigo from "./firmas-codigo.service";

/** POST /api/proyectos/:id/codigo-firma — :id = 0 para la firma del registro de un proyecto nuevo. */
export async function solicitar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { documento } = (req.body ?? {}) as { documento?: string };
    res.status(200).json(await firmasCodigo.solicitarCodigoFirma(req.usuario!.id_usuario, Number(req.params.id), documento ?? "documento"));
  } catch (error) {
    next(error);
  }
}

/** POST /api/proyectos/:id/codigo-firma/verificar */
export async function verificar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { codigo } = (req.body ?? {}) as { codigo?: string };
    res.status(200).json(await firmasCodigo.verificarCodigoFirma(req.usuario!.id_usuario, Number(req.params.id), codigo));
  } catch (error) {
    next(error);
  }
}
