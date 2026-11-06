import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "../config/env";
import { verificarToken } from "../utils/jwt";
import { verificarYRefrescarSesion } from "../auth/auth.service";

/**
 * Recursos que un controlador puede anunciar por el canal de tiempo real.
 * El evento nunca lleva el registro en sí (eso lo sigue pidiendo cada
 * pantalla por la API REST normal, respetando los permisos de siempre) —
 * solo avisa "esto cambió" para que la pantalla que lo esté mostrando se
 * refresque sola, sin que el usuario tenga que recargar la página.
 */
export type RecursoCambio =
  | "usuarios"
  | "proyectos"
  | "proyecto-detalle"
  | "convocatorias"
  | "grupos"
  | "productos"
  | "reclamaciones"
  | "pagos"
  | "evaluaciones"
  | "seguimiento"
  | "acta-inicio"
  | "notificaciones"
  | "catalogos";

interface DetalleCambio {
  id_proyecto?: number;
}

let io: SocketIOServer | null = null;

/** Arranca el servidor de WebSocket sobre el mismo servidor HTTP de Express. */
export function inicializarSocket(server: HttpServer): void {
  io = new SocketIOServer(server, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  // Mismo criterio que el middleware `autenticar` de las rutas HTTP: valida
  // la firma/vigencia del JWT y, además, que la sesión siga activa en BD
  // (sesiones_usuario) — un JWT válido con una sesión ya cerrada no basta.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || typeof token !== "string") {
        next(new Error("SIN_TOKEN"));
        return;
      }

      const usuario = verificarToken(token);
      if (typeof usuario.id_sesion !== "number") {
        next(new Error("TOKEN_INVALIDO"));
        return;
      }

      const estadoSesion = await verificarYRefrescarSesion(usuario.id_sesion);
      if (estadoSesion !== "activa") {
        next(new Error("SESION_CERRADA"));
        return;
      }

      next();
    } catch {
      next(new Error("TOKEN_INVALIDO"));
    }
  });

  io.on("connection", () => {
    // No hace falta trackear sockets individualmente: los eventos de cambio
    // se difunden a todos los conectados (io.emit), igual que cualquier
    // consulta REST ya filtra por permisos del lado del servidor.
  });
}

/** Avisa a todas las pantallas conectadas que algo cambió en `recurso`. */
export function emitirCambio(recurso: RecursoCambio, detalle?: DetalleCambio): void {
  io?.emit("cambio", { recurso, ...detalle });
}
