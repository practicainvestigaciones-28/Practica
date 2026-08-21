import bcrypt from "bcryptjs";
import { env } from "../config/env";

/** Genera el hash que se guarda en usuarios.contraseña */
export function hashearContraseña(contraseñaPlano: string): Promise<string> {
  return bcrypt.hash(contraseñaPlano, env.BCRYPT_SALT_ROUNDS);
}

/** Compara la contraseña ingresada en el login contra el hash almacenado */
export function compararContraseña(
  contraseñaPlano: string,
  hashAlmacenado: string
): Promise<boolean> {
  return bcrypt.compare(contraseñaPlano, hashAlmacenado);
}
