import { Router } from "express";
import { autenticar } from "../../middlewares/auth.middleware";
import * as seguimiento from "../../seguimiento/seguimiento.controller";

export const seguimientoRoutes = Router();

// Cada servicio decide qué le toca a cada rol (Administrador, Vicerrector, investigador del proyecto).
seguimientoRoutes.use(autenticar);

seguimientoRoutes.get("/proyectos", seguimiento.listarProyectos);
seguimientoRoutes.get("/proyectos/:id", seguimiento.obtenerProyecto);
seguimientoRoutes.post("/proyectos/:id/periodos/regenerar", seguimiento.regenerarPeriodos);

seguimientoRoutes.get("/tipos-novedad", seguimiento.listarTiposNovedad);
seguimientoRoutes.post("/tipos-novedad", seguimiento.guardarTipoNovedad);
seguimientoRoutes.put("/tipos-novedad", seguimiento.guardarTipoNovedad);
seguimientoRoutes.delete("/tipos-novedad/:id", seguimiento.eliminarTipoNovedad);

seguimientoRoutes.get("/tipos-articulacion", seguimiento.listarTiposArticulacion);
seguimientoRoutes.post("/tipos-articulacion", seguimiento.guardarTipoArticulacion);
seguimientoRoutes.put("/tipos-articulacion", seguimiento.guardarTipoArticulacion);
seguimientoRoutes.delete("/tipos-articulacion/:id", seguimiento.eliminarTipoArticulacion);

// M-03 Informes de avance
seguimientoRoutes.post("/proyectos/:id/periodos/:numero/solicitud", seguimiento.solicitarAvance);
seguimientoRoutes.patch("/proyectos/:id/periodos/:numero/solicitud", seguimiento.decidirSolicitudAvance);
seguimientoRoutes.put("/proyectos/:id/periodos/:numero", seguimiento.guardarAvance);
seguimientoRoutes.put("/proyectos/:id/periodos/:numero/semanas/:idActividad", seguimiento.guardarSemanasActividad);
seguimientoRoutes.post("/proyectos/:id/periodos/:numero/firmas/:indice", seguimiento.firmarAvance);
seguimientoRoutes.delete("/proyectos/:id/periodos/:numero/firmas", seguimiento.reabrirAvance);
seguimientoRoutes.post("/proyectos/:id/periodos/:numero/radicar", seguimiento.radicarAvance);
seguimientoRoutes.patch("/proyectos/:id/periodos/:numero/revision", seguimiento.revisarAvance);

// M-05 Novedades
seguimientoRoutes.post("/proyectos/:id/novedades", seguimiento.registrarNovedad);
seguimientoRoutes.patch("/proyectos/:id/novedades/:idNovedad", seguimiento.decidirNovedad);

// M-06 Informe técnico final
seguimientoRoutes.post("/proyectos/:id/informe-final/solicitud", seguimiento.solicitarInformeFinal);
seguimientoRoutes.patch("/proyectos/:id/informe-final/solicitud", seguimiento.decidirSolicitudInformeFinal);
seguimientoRoutes.put("/proyectos/:id/informe-final", seguimiento.guardarInformeFinal);
seguimientoRoutes.post("/proyectos/:id/informe-final/firmas/:indice", seguimiento.firmarInformeFinal);
seguimientoRoutes.post("/proyectos/:id/informe-final/radicar", seguimiento.radicarInformeFinal);
seguimientoRoutes.patch("/proyectos/:id/informe-final/revision", seguimiento.revisarInformeFinal);

// M-07 Cierre y paz y salvo
seguimientoRoutes.put("/proyectos/:id/cierre", seguimiento.guardarCierre);
seguimientoRoutes.post("/proyectos/:id/cierre/firmas/:indice", seguimiento.firmarCierre);
seguimientoRoutes.post("/proyectos/:id/cierre/finalizar", seguimiento.finalizarProyecto);
