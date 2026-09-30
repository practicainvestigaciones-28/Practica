import type { Request, Response, NextFunction } from "express";
import * as pagosService from "./pagos.service";

function manejarErrorConocido(error: unknown, res: Response, next: NextFunction): void {
  if (
    error instanceof pagosService.DatosBancariosInvalidosError ||
    error instanceof pagosService.TipoCuentaInvalidoError
  ) {
    res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
  next(error);
}

/** GET /pagos/datos-bancarios - datos bancarios propios del par evaluador logueado */
export async function obtenerMisDatosBancarios(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const datos = await pagosService.obtenerDatosBancariosPropios(req.usuario!.id_usuario);
    res.status(200).json({ datos });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PUT /pagos/datos-bancarios - registra o actualiza los datos bancarios propios */
export async function guardarMisDatosBancarios(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { banco, tipo_cuenta, numero_cuenta, titular, documento_titular } = req.body as {
      banco?: string;
      tipo_cuenta?: string;
      numero_cuenta?: string;
      titular?: string;
      documento_titular?: string;
    };

    const datos = await pagosService.guardarDatosBancariosPropios(req.usuario!.id_usuario, {
      banco: banco ?? "",
      tipo_cuenta: tipo_cuenta ?? "",
      numero_cuenta: numero_cuenta ?? "",
      titular: titular ?? "",
      documento_titular: documento_titular ?? "",
    });

    res.status(200).json({ mensaje: "Datos bancarios guardados correctamente", datos });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}
