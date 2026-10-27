import { Router } from "express";
import * as acta from "../../acta-inicio/acta-inicio.controller";

export const actaFirmaPublicRoutes = Router();

// Sin sesión: el token del correo es la credencial (personal, de un solo uso, con vencimiento).
actaFirmaPublicRoutes.get("/:token", acta.infoEnlace);
// El investigador firma con un código de verificación que llega a su correo personal.
actaFirmaPublicRoutes.post("/:token/codigo", acta.solicitarCodigoEnlace);
actaFirmaPublicRoutes.post("/:token", acta.firmarPorEnlace);
