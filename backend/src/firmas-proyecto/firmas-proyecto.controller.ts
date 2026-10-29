import type { Request, Response, NextFunction } from "express";
import * as firmasProyecto from "./firmas-proyecto.service";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof firmasProyecto.ProyectoNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  next(error);
}

function usuarioReq(req: Request) {
  return { id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles };
}

/** POST /proyectos/:id/firmas/iniciar */
export async function iniciarFirmas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await firmasProyecto.iniciarFirmas(Number(req.params.id), usuarioReq(req));
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /proyectos/:id/firmas */
export async function listarFirmas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await firmasProyecto.listarFirmas(Number(req.params.id), usuarioReq(req));
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /proyectos/:id/firmas/enviar-coinvestigador */
export async function enviarFirmaCoinvestigador(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await firmasProyecto.enviarFirmaPendienteObligatoria(Number(req.params.id), usuarioReq(req));
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /firmar-proyecto/:token (público) — a quién corresponde el enlace. */
export async function infoEnlace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await firmasProyecto.infoFirmaPorEnlace(String(req.params.token)));
  } catch (error) {
    if (error instanceof firmasProyecto.EnlaceFirmaProyectoInvalidoError) {
      res.status(400).json({ error: "Enlace inválido", mensaje: error.message });
      return;
    }
    next(error);
  }
}

/** POST /firmar-proyecto/:token/codigo (público) — envía el código al correo personal. */
export async function solicitarCodigoEnlace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await firmasProyecto.solicitarCodigoPorEnlace(String(req.params.token)));
  } catch (error) {
    if (error instanceof firmasProyecto.EnlaceFirmaProyectoInvalidoError) {
      res.status(400).json({ error: "Enlace inválido", mensaje: error.message });
      return;
    }
    next(error);
  }
}

/** POST /firmar-proyecto/:token (público, sin sesión) */
export async function firmarPorEnlace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { codigo } = (req.body ?? {}) as { codigo?: string };
    const resultado = await firmasProyecto.firmarPorEnlace(String(req.params.token), codigo);
    res.status(200).json(resultado);
  } catch (error) {
    if (error instanceof firmasProyecto.EnlaceFirmaProyectoInvalidoError) {
      res.status(400).json({ error: "Enlace inválido", mensaje: error.message });
      return;
    }
    next(error);
  }
}
