import { Router } from "express";
import * as firmasProyecto from "../../firmas-proyecto/firmas-proyecto.controller";

export const firmaProyectoPublicRoutes = Router();

// Sin sesión: el token del correo es la credencial (personal, de un solo uso, con vencimiento).
firmaProyectoPublicRoutes.post("/:token", firmasProyecto.firmarPorEnlace);
