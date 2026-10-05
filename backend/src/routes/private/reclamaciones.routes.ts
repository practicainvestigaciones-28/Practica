import { Router } from "express";
import * as reclamaciones from "../../reclamaciones/reclamaciones.controller";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";

export const reclamacionesRoutes = Router();

reclamacionesRoutes.use(autenticar);

// Cualquier usuario autenticado puede presentar una reclamación sobre SU
// propio proyecto (se valida en el service), y consultar sus propias
// reclamaciones o la de un proyecto puntual.
reclamacionesRoutes.post("/", reclamaciones.crearReclamacion);
reclamacionesRoutes.get("/", reclamaciones.listarReclamaciones);
reclamacionesRoutes.get("/proyecto/:idProyecto", reclamaciones.obtenerReclamacionDeProyecto);

// Responder/gestionar reclamaciones: solo Administrador.
reclamacionesRoutes.patch("/:id/en-revision", autorizar("Administrador"), reclamaciones.marcarEnRevision);
reclamacionesRoutes.patch("/:id/responder", autorizar("Administrador"), reclamaciones.responderReclamacion);
