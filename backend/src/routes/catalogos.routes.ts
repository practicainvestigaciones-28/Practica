import { Router } from "express";
import * as catalogos from "../catalogos/catalogos.controller";
import { autenticar } from "../middlewares/auth.middleware";
import { autorizar } from "../middlewares/authorize.middleware";

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

// Creación: solo Administrador
catalogosRoutes.post("/areas-conocimiento", autorizar("Administrador"), catalogos.crearAreaConocimiento);
catalogosRoutes.post("/facultades", autorizar("Administrador"), catalogos.crearFacultad);
catalogosRoutes.post("/tipos-programa", autorizar("Administrador"), catalogos.crearTipoPrograma);
catalogosRoutes.post("/programas", autorizar("Administrador"), catalogos.crearPrograma);
catalogosRoutes.post("/tipos-grupo", autorizar("Administrador"), catalogos.crearTipoGrupo);
catalogosRoutes.post("/lineas-investigacion", autorizar("Administrador"), catalogos.crearLineaInvestigacion);
catalogosRoutes.post("/ods", autorizar("Administrador"), catalogos.crearOds);
// Modalidades de proyecto y tipos de proyecto
catalogosRoutes.get("/modalidades-proyecto", catalogos.listarModalidadesProyecto);
catalogosRoutes.get("/tipos-proyecto", catalogos.listarTiposProyecto);
// ...
catalogosRoutes.post("/modalidades-proyecto", autorizar("Administrador"), catalogos.crearModalidadProyecto);
catalogosRoutes.post("/tipos-proyecto", autorizar("Administrador"), catalogos.crearTipoProyecto);