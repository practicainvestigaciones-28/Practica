import { Router } from "express";
import { autenticar } from "../middlewares/auth.middleware";
import { autorizar } from "../middlewares/authorize.middleware";
import * as evaluaciones from "../evaluaciones/evaluaciones.controller";

export const evaluacionesRoutes = Router();

evaluacionesRoutes.use(autenticar);

// Catálogos de apoyo (cualquier autenticado los puede consultar, ej. para
// mostrar el nombre del estado o armar un selector de transición)
evaluacionesRoutes.get("/estados", evaluaciones.listarEstados);
evaluacionesRoutes.get("/transiciones-etapa", evaluaciones.listarTransicionesEtapa);

// Bandeja de trabajo: qué proyectos están pendientes de revisión, por etapa
evaluacionesRoutes.get("/asignaciones", autorizar("Administrador"), evaluaciones.listarAsignaciones);
