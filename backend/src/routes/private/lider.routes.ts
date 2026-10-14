import { Router } from "express";
import * as lider from "../../lider/lider.controller";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";

export const liderRoutes = Router();

liderRoutes.use(autenticar);
liderRoutes.use(autorizar("Líder de investigación", "Administrador"));

liderRoutes.get("/proyectos", lider.listarProyectos);
liderRoutes.get("/proyectos/pendientes-visto-bueno", lider.listarPendientesVistoBueno);
liderRoutes.patch("/proyectos/:id", lider.actualizarSeguimiento);
liderRoutes.patch("/proyectos/:id/visto-bueno", lider.darVistoBueno);
liderRoutes.patch("/proyectos/:id/rechazar", lider.rechazarProyecto);
liderRoutes.patch("/proyectos/:id/productos/:idTipoProducto", lider.registrarObtenido);
