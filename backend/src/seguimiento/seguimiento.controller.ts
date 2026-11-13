import type { NextFunction, Request, Response } from "express";
import * as service from "./seguimiento.service";
import * as avisos from "./seguimiento.avisos";
import { emitirCambio } from "../ws/socket";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof service.ProyectoSeguimientoNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof service.NoParticipaEnProyectoError) {
    res.status(403).json({ error: "No autorizado", mensaje: error.message });
    return;
  }
  if (error instanceof avisos.AvisoNoAutorizadoError) {
    res.status(403).json({ error: "No autorizado", mensaje: error.message });
    return;
  }
  if (error instanceof avisos.AvisoInvalidoError) {
    res.status(422).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
  if (error instanceof service.EvidenciaNoDisponibleError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof service.NombreRequeridoError) {
    res.status(422).json({ error: "Datos incompletos", mensaje: error.message });
    return;
  }
  if (error instanceof service.NombreDuplicadoError) {
    res.status(409).json({ error: "Conflicto", mensaje: error.message });
    return;
  }
  if (error instanceof service.ValidacionSeguimientoError) {
    res.status(422).json({ error: "Datos inválidos", mensaje: error.message, detalle: error.detalle });
    return;
  }
  next(error);
}

const sesion = (req: Request) => ({ id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles });

/** POST /seguimiento/evidencias/archivo — sube el archivo de una evidencia; el informe lo referencia al guardarse. */
export function subirEvidenciaArchivo(req: Request, res: Response): void {
  if (!req.file) {
    res.status(422).json({ error: "Datos inválidos", mensaje: "Adjunta un archivo." });
    return;
  }
  // multer entrega el nombre original como latin1: se recupera el UTF-8 (tildes, ñ).
  const nombre = Buffer.from(req.file.originalname, "latin1").toString("utf8");
  res.status(201).json({ tipo: "archivo", id: req.file.filename, nombre, tamano: req.file.size, mime: req.file.mimetype });
}

/** GET /seguimiento/evidencias/archivo/:nombre */
export async function descargarEvidenciaArchivo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ruta, nombre } = await service.rutaEvidenciaArchivo(String(req.params.nombre), sesion(req));
    res.download(ruta, nombre);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /seguimiento/proyectos */
export async function listarProyectos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.listarProyectosSeguimiento(sesion(req)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /seguimiento/proyectos/:id */
export async function obtenerProyecto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.obtenerProyectoSeguimiento(Number(req.params.id), sesion(req)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /seguimiento/proyectos/:id/periodos/regenerar */
export async function regenerarPeriodos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.regenerarPeriodos(Number(req.params.id), sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /seguimiento/tipos-novedad */
export async function listarTiposNovedad(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.listarTiposNovedad());
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST|PUT /seguimiento/tipos-novedad */
export async function guardarTipoNovedad(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.guardarTipoNovedad(req.body);
    emitirCambio("seguimiento");
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** DELETE /seguimiento/tipos-novedad/:id */
export async function eliminarTipoNovedad(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.eliminarTipoNovedad(Number(req.params.id));
    emitirCambio("seguimiento");
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /seguimiento/tipos-articulacion */
export async function listarTiposArticulacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.listarTiposArticulacion());
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST|PUT /seguimiento/tipos-articulacion */
export async function guardarTipoArticulacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.guardarTipoArticulacion(req.body);
    emitirCambio("seguimiento");
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** DELETE /seguimiento/tipos-articulacion/:id */
export async function eliminarTipoArticulacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.eliminarTipoArticulacion(Number(req.params.id));
    emitirCambio("seguimiento");
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

// ---------------------------------------------------------------------------
// M-03 Informes de avance
// ---------------------------------------------------------------------------

/** POST /seguimiento/proyectos/:id/periodos/:numero/solicitud */
export async function solicitarAvance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.solicitarAvance(Number(req.params.id), Number(req.params.numero), sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PUT /seguimiento/proyectos/:id/periodos/:numero/fechas */
export async function ajustarFechasPeriodo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.ajustarFechasPeriodo(Number(req.params.id), Number(req.params.numero), req.body ?? {}, sesion(req)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PUT /seguimiento/proyectos/:id/periodos/:numero */
export async function guardarAvance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.guardarAvance(Number(req.params.id), Number(req.params.numero), req.body.detalle, sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PUT /seguimiento/proyectos/:id/periodos/:numero/semanas/:idActividad */
export async function guardarSemanasActividad(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.guardarSemanasActividad(
      Number(req.params.id),
      Number(req.params.numero),
      Number(req.params.idActividad),
      req.body.semanas,
      sesion(req)
    );
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /seguimiento/proyectos/:id/periodos/:numero/firmas/:indice */
export async function firmarAvance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.firmarAvance(Number(req.params.id), Number(req.params.numero), Number(req.params.indice), sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** DELETE /seguimiento/proyectos/:id/periodos/:numero/firmas */
export async function reabrirAvance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.reabrirAvance(Number(req.params.id), Number(req.params.numero), sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /seguimiento/proyectos/:id/periodos/:numero/radicar */
export async function radicarAvance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.radicarAvance(Number(req.params.id), Number(req.params.numero), sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PATCH /seguimiento/proyectos/:id/periodos/:numero/revision */
export async function revisarAvance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = sesion(req);
    const resultado = await service.revisarAvance(Number(req.params.id), Number(req.params.numero), req.body.decision, req.body.observacion ?? "", usuario.id_usuario, usuario);
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

// ---------------------------------------------------------------------------
// M-05 Novedades
// ---------------------------------------------------------------------------

/** POST /seguimiento/proyectos/:id/novedades */
export async function registrarNovedad(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.registrarNovedad(Number(req.params.id), req.body, sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PATCH /seguimiento/proyectos/:id/novedades/:idNovedad */
export async function decidirNovedad(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.decidirNovedad(Number(req.params.id), Number(req.params.idNovedad), req.body.decision, req.body.observacion ?? "", sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

// ---------------------------------------------------------------------------
// M-06 Informe técnico final
// ---------------------------------------------------------------------------

/** POST /seguimiento/proyectos/:id/informe-final/solicitud */
export async function solicitarInformeFinal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.solicitarInformeFinal(Number(req.params.id), sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PUT /seguimiento/proyectos/:id/informe-final */
export async function guardarInformeFinal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.guardarInformeFinal(Number(req.params.id), req.body, sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /seguimiento/proyectos/:id/informe-final/firmas/:indice */
export async function firmarInformeFinal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.firmarInformeFinal(Number(req.params.id), Number(req.params.indice), sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /seguimiento/proyectos/:id/informe-final/radicar */
export async function radicarInformeFinal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.radicarInformeFinal(Number(req.params.id), sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PATCH /seguimiento/proyectos/:id/informe-final/revision */
export async function revisarInformeFinal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = sesion(req);
    const resultado = await service.revisarInformeFinal(Number(req.params.id), req.body.decision, req.body.observacion ?? "", usuario.id_usuario, usuario);
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

// ---------------------------------------------------------------------------
// M-07 Cierre y paz y salvo
// ---------------------------------------------------------------------------

/** PUT /seguimiento/proyectos/:id/cierre */
export async function guardarCierre(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.guardarCierre(Number(req.params.id), req.body, sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /seguimiento/proyectos/:id/cierre/firmas/:indice */
export async function firmarCierre(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.firmarCierre(Number(req.params.id), Number(req.params.indice), sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** POST /seguimiento/proyectos/:id/cierre/finalizar */
export async function finalizarProyecto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.finalizarProyecto(Number(req.params.id), sesion(req));
    emitirCambio("seguimiento", { id_proyecto: Number(req.params.id) });
    res.status(200).json(resultado);
  } catch (error) {
    manejarError(error, res, next);
  }
}
