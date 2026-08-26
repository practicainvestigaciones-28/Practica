import { prisma } from "../config/prisma";
import { compararContraseña, hashearContraseña } from "../utils/password";
import { generarToken } from "../utils/jwt";
import { generarTokenRecuperacion, hashearToken } from "../utils/resetToken";
import { enviarCorreoRecuperacion } from "./email.service";
import { env } from "../config/env";

export class CredencialesInvalidasError extends Error {
  constructor() {
    super("Correo o contraseña incorrectos");
  }
}

export class CuentaInactivaError extends Error {
  constructor() {
    super("La cuenta se encuentra desactivada. Contacta al administrador");
  }
}

export class TokenRecuperacionInvalidoError extends Error {
  constructor() {
    super("El enlace de recuperación no es válido o ya fue utilizado");
  }
}

export class TokenRecuperacionExpiradoError extends Error {
  constructor() {
    super("El enlace de recuperación expiró. Solicita uno nuevo");
  }
}

export class ContraseñaActualIncorrectaError extends Error {
  constructor() {
    super("La contraseña actual no es correcta");
  }
}

export class ContraseñaDebilError extends Error {
  constructor() {
    super("La contraseña debe tener al menos 8 caracteres");
  }
}

function validarFortalezaContraseña(contraseña: string): void {
  if (!contraseña || contraseña.length < 8) {
    throw new ContraseñaDebilError();
  }
}

interface ResultadoLogin {
  token: string;
  usuario: {
    id_usuario: number;
    nombre: string;
    apellido: string;
    correo: string;
    cedula: string | null;
    codigo: string | null;
    roles: string[];
  };
}

/**
 * RQF01 - Inicio de sesión: valida credenciales, identifica los roles
 * asociados y bloquea accesos inválidos.
 *
 * Nota: el modelo Usuario actual no tiene columna `activo`. Si más adelante
 * la agregan (para poder desactivar cuentas, RQF05), aquí es donde se
 * valida antes de emitir el token.
 */
export async function iniciarSesion(correo: string, contraseña: string): Promise<ResultadoLogin> {
  const usuario = await prisma.usuario.findUnique({
    where: { correo: correo.toLowerCase().trim() },
    include: { roles: { include: { rol: true } } },
  });

  // Mensaje genérico a propósito: no revelar si falló el correo o la
  // contraseña (evita enumeración de usuarios).
  if (!usuario) {
    throw new CredencialesInvalidasError();
  }

  const contraseñaValida = await compararContraseña(contraseña, usuario.contraseña);
  if (!contraseñaValida) {
    throw new CredencialesInvalidasError();
  }

  const roles = usuario.roles.map((ru) => ru.rol.nombre);

  const token = generarToken({
    id_usuario: usuario.id_usuario,
    correo: usuario.correo,
    roles,
  });

  return {
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        codigo: usuario.codigo,
        cedula: usuario.cedula,
        roles,
      },
    };
}

/** Devuelve el perfil del usuario autenticado a partir de su id (del JWT) */
export async function obtenerPerfil(id_usuario: number) {
  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario },
    include: { roles: { include: { rol: true } } },
  });

  if (!usuario) return null;

  return {
    id_usuario: usuario.id_usuario,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    correo: usuario.correo,
    codigo: usuario.codigo,
    roles: usuario.roles.map((ru) => ru.rol.nombre),
  };
}

/**
 * RQF03 (parte 1/2) - Solicitar recuperación: recibe el correo, genera un
 * token de un solo uso con expiración y lo envía al usuario.
 *
 * A propósito NO revela si el correo existe o no en el sistema (siempre
 * responde igual desde el controller) — evita que alguien use este endpoint
 * para enumerar cuentas registradas.
 */
export async function solicitarRecuperacion(correo: string): Promise<void> {
  const usuario = await prisma.usuario.findUnique({
    where: { correo: correo.toLowerCase().trim() },
  });

  // Si no existe, no hacemos nada (pero tampoco lanzamos error: el
  // controller siempre responde el mismo mensaje genérico).
  if (!usuario) return;

  const { tokenPlano, tokenHash } = generarTokenRecuperacion();
  const expira_en = new Date(Date.now() + env.RESET_TOKEN_EXPIRES_MIN * 60 * 1000);

  await prisma.tokenRecuperacion.create({
    data: { id_usuario: usuario.id_usuario, tokenHash, expira_en },
  });

  const enlace = `${env.FRONTEND_RESET_URL}?token=${tokenPlano}`;
  await enviarCorreoRecuperacion(usuario.correo, enlace);
}

/**
 * RQF03 (parte 2/2) - Restablecer contraseña con el token recibido por
 * correo: valida identidad (token válido, no usado, no expirado) y
 * actualiza la contraseña (cifrada con bcrypt).
 */
export async function restablecerContraseña(tokenPlano: string, nuevaContraseña: string): Promise<void> {
  validarFortalezaContraseña(nuevaContraseña);

  const tokenHash = hashearToken(tokenPlano);

  const registro = await prisma.tokenRecuperacion.findUnique({ where: { tokenHash } });

  if (!registro || registro.usado) {
    throw new TokenRecuperacionInvalidoError();
  }
  if (registro.expira_en < new Date()) {
    throw new TokenRecuperacionExpiradoError();
  }

  const contraseñaHash = await hashearContraseña(nuevaContraseña);

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id_usuario: registro.id_usuario },
      data: { contraseña: contraseñaHash },
    }),
    // Marca este token como usado y de paso invalida cualquier otro token
    // pendiente del mismo usuario (por si pidió varios enlaces seguidos).
    prisma.tokenRecuperacion.updateMany({
      where: { id_usuario: registro.id_usuario, usado: false },
      data: { usado: true },
    }),
  ]);
}

/**
 * RQF03 - Cambio de contraseña por un usuario ya autenticado (distinto del
 * flujo de recuperación: aquí sí conoce su contraseña actual).
 */
export async function cambiarContraseña(
  id_usuario: number,
  contraseñaActual: string,
  contraseñaNueva: string
): Promise<void> {
  validarFortalezaContraseña(contraseñaNueva);

  const usuario = await prisma.usuario.findUnique({ where: { id_usuario } });
  if (!usuario) throw new CredencialesInvalidasError();

  const actualValida = await compararContraseña(contraseñaActual, usuario.contraseña);
  if (!actualValida) throw new ContraseñaActualIncorrectaError();

  const contraseñaHash = await hashearContraseña(contraseñaNueva);
  await prisma.usuario.update({ where: { id_usuario }, data: { contraseña: contraseñaHash } });
}
