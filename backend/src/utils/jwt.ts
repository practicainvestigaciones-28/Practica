import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { UsuarioAutenticado } from "../types/auth";

/**
 * Genera un JWT firmado con la información mínima del usuario.
 * No incluye la contraseña ni datos sensibles: el token viaja en
 * texto legible, solo la firma está protegida.
 */
export function generarToken(payload: UsuarioAutenticado): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/** Verifica y decodifica un JWT. Lanza si es inválido o expiró. */
export function verificarToken(token: string): UsuarioAutenticado {
  return jwt.verify(token, env.JWT_SECRET) as UsuarioAutenticado;
}
