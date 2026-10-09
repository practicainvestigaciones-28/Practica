import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { env } from "../config/env";

/** Genera el hash que se guarda en usuarios.contraseña */
export function hashearContraseña(contraseñaPlano: string): Promise<string> {
  return bcrypt.hash(contraseñaPlano, env.BCRYPT_SALT_ROUNDS);
}

/**
 * Contraseña temporal para una cuenta que crea el Administrador (ver
 * crearUsuario en usuarios.service.ts) — ya no la escribe el Administrador
 * ni se genera en el frontend; el backend la genera, la hashea, y se la
 * envía por correo a la persona (ver email.service.ts). Evita caracteres
 * ambiguos (0/O, 1/l/I) para que, si alguien la transcribe a mano, no se
 * confunda.
 */
export function generarContraseñaTemporal(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let resultado = "";
  for (let i = 0; i < 12; i++) {
    resultado += alfabeto[randomInt(alfabeto.length)];
  }
  return resultado;
}

/** Compara la contraseña ingresada en el login contra el hash almacenado */
export function compararContraseña(
  contraseñaPlano: string,
  hashAlmacenado: string
): Promise<boolean> {
  return bcrypt.compare(contraseñaPlano, hashAlmacenado);
}
