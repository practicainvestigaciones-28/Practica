import type { NextFunction, Request, Response } from "express";
import { verificarToken } from "../utils/jwt";

/**
 * Middleware de autenticación.
 * Espera el header: Authorization: Bearer <token>
 * Si el token es válido, adjunta el usuario decodificado en req.usuario.
 */
export function autenticar(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "No autenticado",
      mensaje: "Debes enviar un token en el header Authorization: Bearer <token>",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    req.usuario = verificarToken(token);
    next();
  } catch (error: any) {
    if (error?.name === "TokenExpiredError") {
      res.status(401).json({ error: "Sesión expirada", mensaje: "Vuelve a iniciar sesión" });
      return;
    }
    res.status(401).json({ error: "Token inválido", mensaje: "No se pudo verificar el token" });
  }
}
