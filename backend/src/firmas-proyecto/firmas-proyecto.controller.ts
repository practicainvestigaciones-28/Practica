import type { Request, Response, NextFunction } from "express";
import * as firmasProyecto from "./firmas-proyecto.service";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof firmasProyecto.ProyectoNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof firmasProyecto.FirmasNoVisiblesError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  if (error instanceof firmasProyecto.EnlaceFirmaProyectoInvalidoError) {
    res.status(400).json({ error: "Enlace inválido", mensaje: error.message });
    return;
  }
  if (error instanceof firmasProyecto.CodigoFirmaInvalidoError) {
    res.status(400).json({ error: "Código inválido", mensaje: error.message });
    return;
  }
  if (error instanceof firmasProyecto.FirmaProyectoNoDisponibleError || error instanceof firmasProyecto.FirmasIncompletasError) {
    res.status(409).json({ error: "No permitido", mensaje: error.message });
    return;
  }
  next(error);
}

function usuarioReq(req: Request) {
  return { id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles };
}

/** IP real de quien firma (detrás del túnel/proxy llega en x-forwarded-for) y su navegador, como evidencia. */
function evidenciaDe(req: Request): firmasProyecto.EvidenciaFirma {
  const reenviada = req.headers["x-forwarded-for"];
  const primera = (Array.isArray(reenviada) ? reenviada[0] : reenviada)?.split(",")[0]?.trim();
  return { ip: primera || req.ip || null, agente: req.get("user-agent") ?? null };
}

function codigoDe(req: Request): string | undefined {
  const codigo = (req.body as { codigo?: unknown } | undefined)?.codigo;
  return typeof codigo === "string" ? codigo : undefined;
}

/** POST /proyectos/:id/firmas/iniciar */
export async function iniciarFirmas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await firmasProyecto.iniciarFirmas(Number(req.params.id), usuarioReq(req)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /proyectos/:id/firmas */
export async function listarFirmas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await firmasProyecto.listarFirmas(Number(req.params.id), usuarioReq(req)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /proyectos/:id/firmas/principal/codigo */
export async function solicitarCodigoPrincipal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await firmasProyecto.solicitarCodigoFirmaPrincipal(Number(req.params.id), usuarioReq(req)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /proyectos/:id/firmas/principal/firmar  { codigo } */
export async function firmarPrincipal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await firmasProyecto.firmarPrincipalConCodigo(Number(req.params.id), usuarioReq(req), codigoDe(req), evidenciaDe(req)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /proyectos/:id/firmas/enviar-coinvestigador */
export async function enviarFirmaCoinvestigador(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await firmasProyecto.enviarFirmaPendienteObligatoria(Number(req.params.id), usuarioReq(req)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /proyectos/:id/firmas/finalizar */
export async function finalizarFirmas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await firmasProyecto.finalizarFirmas(Number(req.params.id), usuarioReq(req)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /firmar-proyecto/:token (público, sin sesión) */
export async function obtenerFirmaPorEnlace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await firmasProyecto.obtenerFirmaPorEnlace(String(req.params.token)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /firmar-proyecto/:token/codigo (público, sin sesión) */
export async function solicitarCodigoPorEnlace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await firmasProyecto.solicitarCodigoPorEnlace(String(req.params.token)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /firmar-proyecto/:token  { codigo } (público, sin sesión) */
export async function firmarPorEnlace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await firmasProyecto.firmarPorEnlace(String(req.params.token), codigoDe(req), evidenciaDe(req)));
  } catch (error) {
    manejarError(error, res, next);
  }
}
