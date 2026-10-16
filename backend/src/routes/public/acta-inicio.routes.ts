import { Router } from "express";
import * as acta from "../../acta-inicio/acta-inicio.controller";

export const actaFirmaPublicRoutes = Router();

// Sin sesión: el token del correo es la credencial (personal, de un solo uso, con vencimiento).
actaFirmaPublicRoutes.post("/:token", acta.firmarPorEnlace);
