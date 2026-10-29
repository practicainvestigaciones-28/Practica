import type { Request, Response, NextFunction } from "express";
import fs from "node:fs";
import { uploadFotoPerfil } from "../config/upload";
import * as fotoPerfil from "./foto-perfil.service";

/** POST /usuarios/me/foto (multipart, campo "foto") — sube o reemplaza la foto del usuario en sesión. */
export function subirFotoPerfil(req: Request, res: Response, next: NextFunction): void {
  uploadFotoPerfil.single("foto")(req, res, async (errorSubida: unknown) => {
    if (errorSubida) {
      const mensaje =
        (errorSubida as { code?: string }).code === "LIMIT_FILE_SIZE"
          ? "La foto no puede pesar más de 2 MB."
          : errorSubida instanceof Error
            ? errorSubida.message
            : "No se pudo subir la foto.";
      res.status(400).json({ error: "Archivo inválido", mensaje });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "Selecciona una imagen." });
      return;
    }
    try {
      await fotoPerfil.guardarFotoPerfil(req.usuario!.id_usuario, req.file.filename);
      res.status(200).json({ mensaje: "Foto de perfil actualizada" });
    } catch (error) {
      fs.unlink(req.file.path, () => {});
      next(error);
    }
  });
}

/** GET /usuarios/me/foto — la imagen del usuario en sesión (404 si no tiene). */
export async function obtenerFotoPerfil(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ruta = await fotoPerfil.rutaFotoPerfil(req.usuario!.id_usuario);
    if (!ruta) {
      res.status(404).json({ error: "No encontrado", mensaje: "No tienes foto de perfil" });
      return;
    }
    res.setHeader("Cache-Control", "private, no-cache");
    res.sendFile(ruta);
  } catch (error) {
    next(error);
  }
}

/** DELETE /usuarios/me/foto */
export async function quitarFotoPerfil(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await fotoPerfil.quitarFotoPerfil(req.usuario!.id_usuario);
    res.status(200).json({ mensaje: "Foto de perfil eliminada" });
  } catch (error) {
    next(error);
  }
}
