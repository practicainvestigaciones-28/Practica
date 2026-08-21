import { randomBytes, createHash } from "node:crypto";

/**
 * Genera el par (tokenPlano, tokenHash) para RQF03.
 * - tokenPlano: se envía UNA vez por correo/enlace al usuario, nunca se guarda.
 * - tokenHash: es lo único que se persiste en la BD (SHA-256, determinístico
 *   para poder buscarlo por igualdad; no es una contraseña, así que no
 *   necesita bcrypt/salt — su seguridad viene de la alta entropía del token).
 */
export function generarTokenRecuperacion(): { tokenPlano: string; tokenHash: string } {
  const tokenPlano = randomBytes(32).toString("hex");
  const tokenHash = hashearToken(tokenPlano);
  return { tokenPlano, tokenHash };
}

export function hashearToken(tokenPlano: string): string {
  return createHash("sha256").update(tokenPlano).digest("hex");
}
