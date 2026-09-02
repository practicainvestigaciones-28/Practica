import type { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service";

/** POST /api/auth/login */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { correo, contraseña } = req.body as { correo?: string; contraseña?: string };

    if (!correo || !contraseña) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "Correo y contraseña son obligatorios",
      });
      return;
    }

    const resultado = await authService.iniciarSesion(correo, contraseña, {
      ip: req.ip,
      navegador: req.headers["user-agent"],
    });

    res.status(200).json({ mensaje: "Inicio de sesión exitoso", ...resultado });
  } catch (error) {
    if (
      error instanceof authService.CredencialesInvalidasError ||
      error instanceof authService.CuentaInactivaError
    ) {
      const status = error instanceof authService.CuentaInactivaError ? 403 : 401;
      res.status(status).json({ error: error.name, mensaje: error.message });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/auth/logout
 * RQF02/RQF04 - Cierra la sesión también del lado del servidor: marca la
 * fila en sesiones_usuario como inactiva, para que el token deje de
 * aceptarse aunque todavía no haya expirado por su cuenta.
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.usuario) {
      await authService.cerrarSesion(req.usuario.id_sesion);
    }
    res.status(200).json({ mensaje: "Sesión cerrada correctamente" });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/recuperar-contrasena
 * RQF03 (1/2) - Solicitar correo de recuperación.
 * Responde siempre el mismo mensaje exista o no la cuenta, para no
 * revelar qué correos están registrados.
 */
export async function solicitarRecuperacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { correo } = req.body as { correo?: string };

    if (!correo) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "El correo es obligatorio" });
      return;
    }

    await authService.solicitarRecuperacion(correo);

    res.status(200).json({
      mensaje: "Si el correo está registrado, enviamos un enlace de recuperación",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/restablecer-contrasena
 * RQF03 (2/2) - Restablecer contraseña con el token recibido por correo.
 */
export async function restablecerContraseña(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, nuevaContraseña } = req.body as { token?: string; nuevaContraseña?: string };

    if (!token || !nuevaContraseña) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "token y nuevaContraseña son obligatorios",
      });
      return;
    }

    await authService.restablecerContraseña(token, nuevaContraseña);

    res.status(200).json({ mensaje: "Contraseña restablecida correctamente" });
  } catch (error) {
    if (
      error instanceof authService.TokenRecuperacionInvalidoError ||
      error instanceof authService.TokenRecuperacionExpiradoError ||
      error instanceof authService.ContraseñaDebilError
    ) {
      res.status(400).json({ error: error.name, mensaje: error.message });
      return;
    }
    next(error);
  }
}

/**
 * PATCH /api/auth/cambiar-contrasena
 * RQF03 - Cambio de contraseña por un usuario autenticado (conoce su
 * contraseña actual).
 */
export async function cambiarContraseña(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { contraseñaActual, contraseñaNueva } = req.body as {
      contraseñaActual?: string;
      contraseñaNueva?: string;
    };

    if (!contraseñaActual || !contraseñaNueva) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "contraseñaActual y contraseñaNueva son obligatorias",
      });
      return;
    }

    await authService.cambiarContraseña(req.usuario!.id_usuario, contraseñaActual, contraseñaNueva);

    res.status(200).json({ mensaje: "Contraseña actualizada correctamente" });
  } catch (error) {
    if (
      error instanceof authService.ContraseñaActualIncorrectaError ||
      error instanceof authService.ContraseñaDebilError
    ) {
      res.status(400).json({ error: error.name, mensaje: error.message });
      return;
    }
    next(error);
  }
}

/** GET /api/auth/perfil */
export async function perfil(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idUsuario = req.usuario!.id_usuario;
    const usuario = await authService.obtenerPerfil(idUsuario);

    if (!usuario) {
      res.status(404).json({ error: "No encontrado", mensaje: "Usuario no encontrado" });
      return;
    }

    res.status(200).json(usuario);
  } catch (error) {
    next(error);
  }
}
