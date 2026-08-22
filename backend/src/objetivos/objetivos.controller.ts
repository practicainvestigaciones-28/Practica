import type { Request, Response, NextFunction } from "express";
import * as objetivosService from "./objetivos.service";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (
    error instanceof objetivosService.ProyectoNoEncontradoError ||
    error instanceof objetivosService.ObjetivoNoEncontradoError ||
    error instanceof objetivosService.AntecedenteNoEncontradoError ||
    error instanceof objetivosService.ImpactoNoEncontradoError
  ) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof objetivosService.NoAutorizadoProyectoError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  if (error instanceof objetivosService.TipoObjetivoInvalidoError) {
    res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
  next(error);
}

function usuarioReq(req: Request) {
  return { id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles };
}

// Objetivos (RQF27)
export async function agregarObjetivo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tipo_objetivo, descripcion } = req.body;
    if (!tipo_objetivo || !descripcion) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "tipo_objetivo y descripcion son obligatorios" });
      return;
    }
    const objetivo = await objetivosService.agregarObjetivo(Number(req.params.id), { tipo_objetivo, descripcion }, usuarioReq(req));
    res.status(201).json({ mensaje: "Objetivo registrado correctamente", objetivo });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function listarObjetivos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await objetivosService.listarObjetivos(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function actualizarObjetivo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const objetivo = await objetivosService.actualizarObjetivo(
      Number(req.params.id),
      Number(req.params.idObjetivo),
      req.body,
      usuarioReq(req)
    );
    res.status(200).json({ mensaje: "Objetivo actualizado correctamente", objetivo });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function quitarObjetivo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await objetivosService.quitarObjetivo(Number(req.params.id), Number(req.params.idObjetivo), usuarioReq(req));
    res.status(200).json({ mensaje: "Objetivo eliminado correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}

// Antecedentes (RQF27)
export async function agregarAntecedente(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { descripcion, fecha_publicacion, autor, fuente } = req.body;
    if (!descripcion) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "descripcion es obligatoria" });
      return;
    }
    const antecedente = await objetivosService.agregarAntecedente(
      Number(req.params.id),
      { descripcion, fecha_publicacion: fecha_publicacion ? new Date(fecha_publicacion) : undefined, autor, fuente },
      usuarioReq(req)
    );
    res.status(201).json({ mensaje: "Antecedente registrado correctamente", antecedente });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function listarAntecedentes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await objetivosService.listarAntecedentes(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function quitarAntecedente(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await objetivosService.quitarAntecedente(Number(req.params.id), Number(req.params.idAntecedente), usuarioReq(req));
    res.status(200).json({ mensaje: "Antecedente eliminado correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}

// Impactos (RQF28)
export async function agregarImpacto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { impacto_esperado, beneficiario_potencial, indicador_verificable } = req.body;
    if (!impacto_esperado) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "impacto_esperado es obligatorio" });
      return;
    }
    const impacto = await objetivosService.agregarImpacto(
      Number(req.params.id),
      Number(req.params.idObjetivo),
      { impacto_esperado, beneficiario_potencial, indicador_verificable },
      usuarioReq(req)
    );
    res.status(201).json({ mensaje: "Impacto registrado correctamente", impacto });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function listarImpactos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await objetivosService.listarImpactos(Number(req.params.id), Number(req.params.idObjetivo)));
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function quitarImpacto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await objetivosService.quitarImpacto(
      Number(req.params.id),
      Number(req.params.idObjetivo),
      Number(req.params.idImpacto),
      usuarioReq(req)
    );
    res.status(200).json({ mensaje: "Impacto eliminado correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}
