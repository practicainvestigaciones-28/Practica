import { Router } from "express";
import {
  listarNotificaciones,
  contarNoLeidas,
  marcarLeida,
  crearNotificacion,
} from "../../notificaciones/notificaciones.controller";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";

export const notificacionesRoutes = Router();

notificacionesRoutes.use(autenticar);

notificacionesRoutes.get("/", listarNotificaciones);
notificacionesRoutes.get("/no-leidas", contarNoLeidas);
notificacionesRoutes.patch("/:id/leida", marcarLeida);
notificacionesRoutes.post("/", autorizar("Administrador"), crearNotificacion);
