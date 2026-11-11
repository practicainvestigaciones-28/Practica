import type { Request, Response, NextFunction } from "express";
import * as ruahService from "./ruah.service";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof ruahService.RuahNoConfiguradoError) {
    res.status(501).json({ error: "No configurado", mensaje: error.message });
    return;
  }
  if (error instanceof ruahService.RuahConexionError) {
    res.status(502).json({ error: "Ruah no disponible", mensaje: error.message });
    return;
  }
  next(error);
}

/** GET /api/ruah/estudiantes/:codigo — datos del estudiante para llenar el formulario del proyecto. */
export async function buscarEstudiante(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const estudiante = await ruahService.buscarEstudiantePorCodigo(String(req.params.codigo ?? ""));
    if (!estudiante) {
      res.status(404).json({ error: "No encontrado", mensaje: "No se encontró un estudiante con ese código en el catálogo de Ruah." });
      return;
    }
    res.status(200).json(estudiante);
  } catch (error) {
    next(error);
  }
}

/** POST /api/ruah/sincronizar-docentes */
export async function sincronizarDocentes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resumen = await ruahService.sincronizarDocentes();
    res.status(200).json({ mensaje: "Docentes sincronizados correctamente", resumen });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /api/ruah/sincronizar-estudiantes */
export async function sincronizarEstudiantes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resumen = await ruahService.sincronizarEstudiantes();
    res.status(200).json({ mensaje: "Estudiantes sincronizados correctamente", resumen });
  } catch (error) {
    manejarError(error, res, next);
  }
}
