import { Router } from "express";
import * as firmasProyecto from "../../firmas-proyecto/firmas-proyecto.controller";

export const firmaProyectoPublicRoutes = Router();

// Sin sesión: el token del correo es la credencial (personal, con vencimiento),
// y la firma se confirma con el código de 6 dígitos que llega a ese mismo correo.
firmaProyectoPublicRoutes.get("/:token", firmasProyecto.obtenerFirmaPorEnlace);
firmaProyectoPublicRoutes.post("/:token/codigo", firmasProyecto.solicitarCodigoPorEnlace);
firmaProyectoPublicRoutes.post("/:token", firmasProyecto.firmarPorEnlace);
