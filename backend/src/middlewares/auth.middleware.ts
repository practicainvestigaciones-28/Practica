import type { NextFunction, Request, Response } from "express";
import { verificarToken } from "../utils/jwt";
import { verificarYRefrescarSesion } from "../auth/auth.service";

/**
 * Middleware de autenticación.
 * Espera el header: Authorization: Bearer <token>
 * Si el token es válido, adjunta el usuario decodificado en req.usuario.
 *
 * RQF04 - Además del JWT en sí, valida la sesión respaldada en la base de
 * datos (sesiones_usuario): si el usuario lleva más de
 * env.INACTIVIDAD_TIMEOUT_MIN minutos sin hacer ninguna petición, la sesión
 * se cierra aquí mismo aunque el token todavía no haya expirado por su
 * cuenta — el JWT por sí solo no tiene forma de saber esto, al no tener
 * estado en el servidor.
 */
export async function autenticar(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "No autenticado",
      mensaje: "Debes enviar un token en el header Authorization: Bearer <token>",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  let usuario;
  try {
    usuario = verificarToken(token);
  } catch (error: any) {
    if (error?.name === "TokenExpiredError") {
      res.status(401).json({ error: "Sesión expirada", mensaje: "Vuelve a iniciar sesión" });
      return;
    }
    res.status(401).json({ error: "Token inválido", mensaje: "No se pudo verificar el token" });
    return;
  }

  // Tokens emitidos antes de RQF04 no traen id_sesion — se tratan como
  // inválidos en vez de reventar la consulta a sesiones_usuario.
  if (typeof usuario.id_sesion !== "number") {
    res.status(401).json({ error: "Token inválido", mensaje: "Vuelve a iniciar sesión" });
    return;
  }

  const estadoSesion = await verificarYRefrescarSesion(usuario.id_sesion);

  if (estadoSesion === "cerrada") {
    res.status(401).json({ error: "Sesión cerrada", mensaje: "Vuelve a iniciar sesión" });
    return;
  }
  if (estadoSesion === "inactiva_por_tiempo") {
    res.status(401).json({
      error: "Sesión expirada por inactividad",
      mensaje: "Tu sesión se cerró por inactividad. Vuelve a iniciar sesión",
    });
    return;
  }

  req.usuario = usuario;
  next();
}
