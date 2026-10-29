import { Router } from "express";
import * as firmasProyecto from "../../firmas-proyecto/firmas-proyecto.controller";

export const firmaProyectoPublicRoutes = Router();

// Sin sesión: el token del correo es la credencial (personal, de un solo uso, con vencimiento).
firmaProyectoPublicRoutes.get("/:token", firmasProyecto.infoEnlace);
// Quien firma confirma con un código de verificación que llega a su correo personal.
firmaProyectoPublicRoutes.post("/:token/codigo", firmasProyecto.solicitarCodigoEnlace);
firmaProyectoPublicRoutes.post("/:token", firmasProyecto.firmarPorEnlace);
