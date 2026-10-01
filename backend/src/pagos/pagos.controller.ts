import path from "node:path";
import type { Request, Response, NextFunction } from "express";
import { CARPETA_UPLOADS } from "../config/upload";
import * as pagosService from "./pagos.service";

function manejarErrorConocido(error: unknown, res: Response, next: NextFunction): void {
  if (
    error instanceof pagosService.TipoCuentaInvalidoError ||
    error instanceof pagosService.TipoDocumentoPagoInvalidoError
  ) {
    res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
  if (error instanceof pagosService.DocumentoPagoNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
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
      banco,
      tipo_cuenta,
      numero_cuenta,
      titular,
      documento_titular,
    });

    res.status(200).json({ mensaje: "Datos bancarios guardados correctamente", datos });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** POST /pagos/datos-bancarios/documentos/:tipo - sube RUT, certificación bancaria o cédula (multipart, campo "archivo") */
export async function subirMiDocumentoPago(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "Debes adjuntar un archivo en el campo 'archivo'" });
      return;
    }

    const tipo = req.params.tipo as pagosService.TipoDocumentoPago;
    const datos = await pagosService.guardarDocumentoPagoPropio(req.usuario!.id_usuario, tipo, req.file.filename);

    res.status(200).json({ mensaje: "Documento cargado correctamente", datos });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /pagos/datos-bancarios/documentos/:tipo - descarga un documento propio ya subido */
export async function descargarMiDocumentoPago(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tipo = req.params.tipo as pagosService.TipoDocumentoPago;
    const nombreArchivo = await pagosService.obtenerRutaDocumentoPagoPropio(req.usuario!.id_usuario, tipo);
    const ruta = path.join(CARPETA_UPLOADS, nombreArchivo);
    res.download(ruta, (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ error: "No encontrado", mensaje: "El archivo no existe en el servidor" });
      }
    });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /pagos/historial - historial de pagos del par evaluador logueado */
export async function obtenerMiHistorialPagos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const historial = await pagosService.listarHistorialPagosPropio(req.usuario!.id_usuario);
    res.status(200).json({ historial });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /pagos/historial/:idPago/comprobante - descarga el comprobante de un pago propio */
export async function descargarMiComprobante(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const nombreArchivo = await pagosService.obtenerRutaComprobantePropio(req.usuario!.id_usuario, Number(req.params.idPago));
    const ruta = path.join(CARPETA_UPLOADS, nombreArchivo);
    res.download(ruta, (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ error: "No encontrado", mensaje: "El archivo no existe en el servidor" });
      }
    });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}
