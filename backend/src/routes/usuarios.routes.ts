import { Router } from "express";
import { registrarHojaVida, obtenerHojaVida } from "../hoja-vida/hoja-vida.controller";
import { autenticar } from "../middlewares/auth.middleware";

export const usuariosRoutes = Router();

usuariosRoutes.use(autenticar);

// RQF35 - Hoja de vida resumida de investigadores.
// Cualquier autenticado puede consultar (se usa en evaluaciones/asignaciones);
// solo el propio usuario o un Administrador pueden editarla (se valida en el servicio).
usuariosRoutes.get("/:id/hoja-vida", obtenerHojaVida);
usuariosRoutes.put("/:id/hoja-vida", registrarHojaVida);
