import type { Request, Response, NextFunction } from "express";
import * as evaluacionesService from "./evaluaciones.service";

function manejarErrorConocido(error: unknown, res: Response, next: NextFunction): void {
  if (
    error instanceof evaluacionesService.ProyectoNoEncontradoError ||
    error instanceof evaluacionesService.EtapaNoEncontradaError ||
    error instanceof evaluacionesService.EstadoNoEncontradoError
  ) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof evaluacionesService.ResultadoInvalidoError) {
    res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
  if (error instanceof evaluacionesService.AsignacionYaExisteError) {
    res.status(409).json({ error: "No permitido", mensaje: error.message });
    return;
  }
  next(error);
}

/** GET /api/evaluaciones/estados */
export async function listarEstados(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await evaluacionesService.listarEstados());
  } catch (error) {
    next(error);
  }
}

/** GET /api/evaluaciones/transiciones-etapa */
export async function listarTransicionesEtapa(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.status(200).json(await evaluacionesService.listarTransicionesEtapa());
  } catch (error) {
    next(error);
  }
}

/** GET /api/evaluaciones/asignaciones - bandeja de trabajo, solo Administrador */
export async function listarAsignaciones(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_etapa, asignado_a, pendientes } = req.query;
    const asignaciones = await evaluacionesService.listarAsignaciones({
      id_etapa: id_etapa ? Number(id_etapa) : undefined,
      asignado_a: asignado_a ? Number(asignado_a) : undefined,
      pendientes: pendientes === "true",
    });
    res.status(200).json(asignaciones);
  } catch (error) {
    next(error);
  }
}

/** POST /api/proyectos/:id/asignaciones - RQF44, solo Administrador */
export async function asignarProyectoAEtapa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_etapa, asignado_a, fecha_limite } = req.body as {
      id_etapa?: number;
      asignado_a?: number;
      fecha_limite?: string;
    };

    if (!id_etapa) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_etapa es obligatorio" });
      return;
    }

    const asignacion = await evaluacionesService.asignarProyectoAEtapa(
      Number(req.params.id),
      Number(id_etapa),
      req.usuario!.id_usuario,
      {
        asignado_a: asignado_a ? Number(asignado_a) : undefined,
        fecha_limite: fecha_limite ? new Date(fecha_limite) : undefined,
      }
    );

    res.status(201).json({ mensaje: "Proyecto asignado correctamente", asignacion });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** POST /api/proyectos/:id/etapas/:idEtapa/evaluacion - RQF45/49/57, solo Administrador */
export async function registrarEvaluacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { resultado, comentarios, puntaje, formato_evaluacion } = req.body as {
      resultado?: string;
      comentarios?: string;
      puntaje?: number;
      formato_evaluacion?: string;
    };

    if (!resultado) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "resultado es obligatorio" });
      return;
    }

    const evaluacion = await evaluacionesService.registrarEvaluacion(
      Number(req.params.id),
      Number(req.params.idEtapa),
      {
        evaluado_por: req.usuario!.id_usuario,
        resultado: resultado as evaluacionesService.ResultadoEvaluacion,
        comentarios,
        puntaje,
        formato_evaluacion,
      }
    );

    res.status(201).json({ mensaje: "Evaluación registrada correctamente", evaluacion });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** POST /api/proyectos/:id/etapas/:idEtapa/correcciones - RQF47, solo Administrador */
export async function validarCorrecciones(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { aprobadas, comentarios } = req.body as { aprobadas?: boolean; comentarios?: string };

    if (typeof aprobadas !== "boolean") {
      res.status(400).json({ error: "Datos incompletos", mensaje: "aprobadas debe ser true o false" });
      return;
    }

    const evaluacion = await evaluacionesService.validarCorrecciones(
      Number(req.params.id),
      Number(req.params.idEtapa),
      { evaluado_por: req.usuario!.id_usuario, aprobadas, comentarios }
    );

    res.status(201).json({ mensaje: "Corrección validada correctamente", evaluacion });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /api/proyectos/:id/estado-consolidado - RQF61 */
export async function obtenerEstadoConsolidado(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const consolidado = await evaluacionesService.obtenerEstadoConsolidado(Number(req.params.id));
    res.status(200).json(consolidado);
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /api/proyectos/:id/historial - RQF59 */
export async function listarHistorialProyecto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const historial = await evaluacionesService.listarHistorialProyecto(Number(req.params.id));
    res.status(200).json(historial);
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}
