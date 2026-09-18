import { Router } from "express";
import * as catalogos from "../../catalogos/catalogos.controller";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";

export const catalogosRoutes = Router();

catalogosRoutes.use(autenticar);

// Consulta: cualquier usuario autenticado (llenan selects de formularios)
catalogosRoutes.get("/areas-conocimiento", catalogos.listarAreasConocimiento);
catalogosRoutes.get("/facultades", catalogos.listarFacultades);
catalogosRoutes.get("/tipos-programa", catalogos.listarTiposPrograma);
catalogosRoutes.get("/programas", catalogos.listarProgramas);
catalogosRoutes.get("/tipos-grupo", catalogos.listarTiposGrupo);
catalogosRoutes.get("/lineas-investigacion", catalogos.listarLineasInvestigacion);
catalogosRoutes.get("/ods", catalogos.listarOds);
catalogosRoutes.get("/modalidades-proyecto", catalogos.listarModalidadesProyecto);
catalogosRoutes.get("/tipos-proyecto", catalogos.listarTiposProyecto);
catalogosRoutes.get("/periodos", catalogos.listarPeriodos);
catalogosRoutes.get("/dedicaciones", catalogos.listarDedicaciones);
catalogosRoutes.get("/roles-proyecto", catalogos.listarRolesProyecto);
catalogosRoutes.get("/roles-estudiante", catalogos.listarRolesEstudiante);
// Creación: solo Administrador
catalogosRoutes.post("/areas-conocimiento", autorizar("Administrador"), catalogos.crearAreaConocimiento);
catalogosRoutes.put("/areas-conocimiento/:id", autorizar("Administrador"), catalogos.actualizarAreaConocimiento);
catalogosRoutes.patch(
  "/areas-conocimiento/:id/estado",
  autorizar("Administrador"),
  catalogos.cambiarEstadoAreaConocimiento
);
catalogosRoutes.delete("/areas-conocimiento/:id", autorizar("Administrador"), catalogos.eliminarAreaConocimiento);
catalogosRoutes.post("/facultades", autorizar("Administrador"), catalogos.crearFacultad);
catalogosRoutes.post("/tipos-programa", autorizar("Administrador"), catalogos.crearTipoPrograma);
catalogosRoutes.post("/programas", autorizar("Administrador"), catalogos.crearPrograma);
catalogosRoutes.put("/programas/:id", autorizar("Administrador"), catalogos.actualizarPrograma);
catalogosRoutes.patch("/programas/:id/estado", autorizar("Administrador"), catalogos.cambiarEstadoPrograma);
catalogosRoutes.delete("/programas/:id", autorizar("Administrador"), catalogos.eliminarPrograma);
catalogosRoutes.post("/tipos-grupo", autorizar("Administrador"), catalogos.crearTipoGrupo);
catalogosRoutes.post("/lineas-investigacion", autorizar("Administrador"), catalogos.crearLineaInvestigacion);
catalogosRoutes.put("/lineas-investigacion/:id", autorizar("Administrador"), catalogos.actualizarLineaInvestigacion);
catalogosRoutes.patch(
  "/lineas-investigacion/:id/estado",
  autorizar("Administrador"),
  catalogos.cambiarEstadoLineaInvestigacion
);
catalogosRoutes.delete(
  "/lineas-investigacion/:id",
  autorizar("Administrador"),
  catalogos.eliminarLineaInvestigacion
);
catalogosRoutes.post("/ods", autorizar("Administrador"), catalogos.crearOds);
catalogosRoutes.put("/ods/:id", autorizar("Administrador"), catalogos.actualizarOds);
catalogosRoutes.patch("/ods/:id/estado", autorizar("Administrador"), catalogos.cambiarEstadoOds);
catalogosRoutes.delete("/ods/:id", autorizar("Administrador"), catalogos.eliminarOds);
catalogosRoutes.post("/modalidades-proyecto", autorizar("Administrador"), catalogos.crearModalidadProyecto);
catalogosRoutes.put("/modalidades-proyecto/:id", autorizar("Administrador"), catalogos.actualizarModalidadProyecto);
catalogosRoutes.patch(
  "/modalidades-proyecto/:id/estado",
  autorizar("Administrador"),
  catalogos.cambiarEstadoModalidadProyecto
);
catalogosRoutes.delete(
  "/modalidades-proyecto/:id",
  autorizar("Administrador"),
  catalogos.eliminarModalidadProyecto
);
catalogosRoutes.post("/tipos-proyecto", autorizar("Administrador"), catalogos.crearTipoProyecto);
catalogosRoutes.put("/tipos-proyecto/:id", autorizar("Administrador"), catalogos.actualizarTipoProyecto);
catalogosRoutes.patch(
  "/tipos-proyecto/:id/estado",
  autorizar("Administrador"),
  catalogos.cambiarEstadoTipoProyecto
);
catalogosRoutes.delete("/tipos-proyecto/:id", autorizar("Administrador"), catalogos.eliminarTipoProyecto);
catalogosRoutes.post("/periodos", autorizar("Administrador"), catalogos.crearPeriodo);
catalogosRoutes.put("/periodos/:id", autorizar("Administrador"), catalogos.actualizarPeriodo);
catalogosRoutes.patch("/periodos/:id/estado", autorizar("Administrador"), catalogos.cambiarEstadoPeriodo);
catalogosRoutes.delete("/periodos/:id", autorizar("Administrador"), catalogos.eliminarPeriodo);