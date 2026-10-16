import { Router } from "express";
import { autenticar } from "../../middlewares/auth.middleware";
import * as acta from "../../acta-inicio/acta-inicio.controller";

export const actaInicioRoutes = Router();

// Cada servicio decide qué le toca a cada rol (Administrador, Vicerrector, investigador del proyecto).
actaInicioRoutes.use(autenticar);

actaInicioRoutes.get("/", acta.listar);
actaInicioRoutes.get("/estados", acta.estados);
actaInicioRoutes.get("/proyecto/:id", acta.obtener);
actaInicioRoutes.put("/proyecto/:id", acta.guardarDatos);
actaInicioRoutes.patch("/proyecto/:id/participantes/:idUsuarioProyecto", acta.guardarContacto);
actaInicioRoutes.post("/:id/generar", acta.generar);
actaInicioRoutes.post("/:id/reabrir", acta.reabrir);
actaInicioRoutes.post("/:id/reiniciar", acta.reiniciar);
actaInicioRoutes.post("/:id/compromisos", acta.aceptarCompromisos);
actaInicioRoutes.post("/:id/firmar", acta.firmar);
actaInicioRoutes.post("/:id/reenviar-firma", acta.reenviarFirma);
actaInicioRoutes.patch("/:id/vicerrector", acta.actualizarVicerrector);
