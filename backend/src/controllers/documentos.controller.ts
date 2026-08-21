import type { Request, Response, NextFunction } from "express";
import * as documentosService from "../services/documentos.service";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (
    error instanceof documentosService.ProyectoNoEncontradoError ||
    error instanceof documentosService.DocumentoNoEncontradoError
  ) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof documentosService.NoAutorizadoProyectoError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  if (error instanceof documentosService.TipoDocumentoInvalidoError) {
    res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
  next(error);
}

function usuarioReq(req: Request) {
  return { id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles };
}

/** POST /api/proyectos/:id/documentos - RQF37 (multipart/form-data, campo "archivo") */
export async function cargarDocumento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_tipo_documento } = req.body;

    if (!req.file) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "Debes adjuntar un archivo en el campo 'archivo'" });
      return;
    }
    if (!id_tipo_documento) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_tipo_documento es obligatorio" });
      return;
    }

    const documento = await documentosService.cargarDocumento(
      Number(req.params.id),
      Number(id_tipo_documento),
      req.file.filename,
      usuarioReq(req)
    );

    res.status(201).json({ mensaje: "Documento cargado correctamente", documento });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /api/proyectos/:id/documentos - RQF38 */
export async function listarDocumentos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await documentosService.listarDocumentos(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /api/proyectos/:id/documentos/:idDocumento - RQF38 (metadatos) */
export async function obtenerDocumento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const documento = await documentosService.obtenerDocumento(Number(req.params.id), Number(req.params.idDocumento));
    res.status(200).json(documento);
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /api/proyectos/:id/documentos/:idDocumento/descarga - RQF38 (archivo real) */
export async function descargarDocumento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ruta = await documentosService.obtenerRutaDescarga(Number(req.params.id), Number(req.params.idDocumento));
    res.download(ruta, (error) => {
      // res.download ya envió (o intentó enviar) la respuesta; si falla
      // después de eso no podemos volver a escribir el response.
      if (error && !res.headersSent) {
        res.status(404).json({ error: "No encontrado", mensaje: "El archivo no existe en el servidor" });
      }
    });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** PATCH /api/proyectos/:id/documentos/:idDocumento/validacion - RQF39 (solo Admin) */
export async function validarDocumento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { aprobado } = req.body as { aprobado?: boolean };
    if (typeof aprobado !== "boolean") {
      res.status(400).json({ error: "Datos incompletos", mensaje: "El campo 'aprobado' debe ser true o false" });
      return;
    }

    const documento = await documentosService.validarDocumento(
      Number(req.params.id),
      Number(req.params.idDocumento),
      aprobado,
      usuarioReq(req)
    );

    res.status(200).json({
      mensaje: `Documento ${aprobado ? "aprobado" : "rechazado"} correctamente`,
      documento,
    });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** DELETE /api/proyectos/:id/documentos/:idDocumento */
export async function eliminarDocumento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await documentosService.eliminarDocumento(Number(req.params.id), Number(req.params.idDocumento), usuarioReq(req));
    res.status(200).json({ mensaje: "Documento eliminado correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}
