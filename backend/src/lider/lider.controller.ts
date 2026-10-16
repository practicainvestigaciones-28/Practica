import type { Request, Response, NextFunction } from "express";
import * as liderService from "./lider.service";

function manejarErrorConocido(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof liderService.ProyectoNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof liderService.NoAutorizadoError) {
    res.status(403).json({ error: "No autorizado", mensaje: error.message });
    return;
  }
  if (error instanceof liderService.ProyectoNoPendienteVistoBuenoError) {
    res.status(409).json({ error: "Conflicto", mensaje: error.message });
    return;
  }
  if (error instanceof liderService.MotivoRechazoRequeridoError) {
    res.status(400).json({ error: "Datos incompletos", mensaje: error.message });
    return;
  }
  next(error);
}

/** GET /api/lider/proyectos */
export async function listarProyectos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const proyectos = await liderService.listarProyectosParaLider({
      id_usuario: req.usuario!.id_usuario,
      roles: req.usuario!.roles,
    });
    res.status(200).json(proyectos);
  } catch (error) {
    next(error);
  }
}

/** GET /api/lider/proyectos/pendientes-visto-bueno */
export async function listarPendientesVistoBueno(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const proyectos = await liderService.listarProyectosPendientesVistoBueno(req.usuario!.id_usuario);
    res.status(200).json(proyectos);
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/lider/proyectos/:id/visto-bueno */
export async function darVistoBueno(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const proyecto = await liderService.darVistoBuenoLider(Number(req.params.id), req.usuario!.id_usuario);
    res.status(200).json({ mensaje: "Visto bueno registrado correctamente", proyecto });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PATCH /api/lider/proyectos/:id/rechazar */
export async function rechazarProyecto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { motivo } = req.body as { motivo?: string };
    const proyecto = await liderService.rechazarProyectoLider(Number(req.params.id), req.usuario!.id_usuario, motivo ?? "");
    res.status(200).json({ mensaje: "Proyecto rechazado correctamente", proyecto });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PATCH /api/lider/proyectos/:id */
export async function actualizarSeguimiento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const proyecto = await liderService.actualizarSeguimientoProyecto(Number(req.params.id), req.body);
    res.status(200).json({ mensaje: "Seguimiento actualizado correctamente", proyecto });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PATCH /api/lider/proyectos/:id/productos/:idTipoProducto */
export async function registrarObtenido(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { cantidad_obtenida } = req.body as { cantidad_obtenida?: number };
    if (cantidad_obtenida === undefined || cantidad_obtenida === null || Number.isNaN(Number(cantidad_obtenida))) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "cantidad_obtenida es obligatoria" });
      return;
    }
    const registro = await liderService.registrarProductoObtenido(
      Number(req.params.id),
      Number(req.params.idTipoProducto),
      Number(cantidad_obtenida)
    );
    res.status(200).json({ mensaje: "Producto obtenido registrado correctamente", registro });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}
