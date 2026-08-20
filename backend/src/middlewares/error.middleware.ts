import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { Prisma } from "../generated/prisma/client";

interface ErrorConEstado extends Error {
  status?: number;
}

/**
 * Middleware centralizado de errores. Se registra al final de app.ts,
 * después de todas las rutas, con la firma de 4 parámetros que Express
 * reconoce como error handler.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function manejadorErrores(err: ErrorConEstado, req: Request, res: Response, next: NextFunction): void {
  console.error(err);

  // Errores de multer: archivo demasiado grande, campo inesperado, etc.
  if (err instanceof MulterError) {
    const mensaje =
      err.code === "LIMIT_FILE_SIZE" ? "El archivo supera el tamaño máximo permitido (10 MB)" : err.message;
    res.status(400).json({ error: "Error al subir el archivo", mensaje });
    return;
  }
  // Error lanzado desde nuestro fileFilter (extensión no permitida)
  if (err.message?.startsWith("Extensión no permitida")) {
    res.status(400).json({ error: "Archivo inválido", mensaje: err.message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({
        error: "Registro duplicado",
        mensaje: `Ya existe un registro con ese valor en: ${err.meta?.target}`,
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "No encontrado", mensaje: "El recurso no existe" });
      return;
    }
  }

  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? "Error interno del servidor" : err.message,
    mensaje: status === 500 ? "Ocurrió un error inesperado" : undefined,
  });
}
