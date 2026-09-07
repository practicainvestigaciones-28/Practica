import { Router } from "express";
import { autenticar } from "../middlewares/auth.middleware";
import { autorizar } from "../middlewares/authorize.middleware";
import { listarPermisos, crearPermiso } from "../permisos/permisos.controller";

export const permisosRoutes = Router();

permisosRoutes.use(autenticar);

// RQF08 - Catálogo de permisos: solo Administrador
permisosRoutes.get("/", autorizar("Administrador"), listarPermisos);
permisosRoutes.post("/", autorizar("Administrador"), crearPermiso);
