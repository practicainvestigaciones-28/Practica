import { Router } from "express";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";
import * as evaluaciones from "../../evaluaciones/evaluaciones.controller";

export const evaluacionesRoutes = Router();

evaluacionesRoutes.use(autenticar);

// Catálogos de apoyo (cualquier autenticado los puede consultar, ej. para
// mostrar el nombre del estado o armar un selector de transición)
evaluacionesRoutes.get("/estados", evaluaciones.listarEstados);
evaluacionesRoutes.get("/transiciones-etapa", evaluaciones.listarTransicionesEtapa);

// Bandeja de proyectos postulados: los que aún no entraron a ninguna etapa.
// Es la vista desde la que el Administrador abre el detalle del proyecto y
// decide a qué etapa y a qué integrante lo asigna.
evaluacionesRoutes.get("/postulados", autorizar("Administrador"), evaluaciones.listarProyectosPostulados);

// Bandeja de proyectos con calificación de Pares lista para revisar y
// enviar (ambos evaluadores ya terminaron, falta la confirmación del
// Administrador — ver enviarResultadoPares en proyectos.routes.ts).
evaluacionesRoutes.get("/pares-pendientes", autorizar("Administrador"), evaluaciones.listarProyectosConCalificacionPendiente);

// Bandeja de trabajo. Sin autorizar() por rol porque sirve a dos usos: el
// seguimiento global del Administrador y, con ?mias=true, la bandeja del
// evaluador. El controller distingue ambos casos.
evaluacionesRoutes.get("/asignaciones", evaluaciones.listarAsignaciones);
