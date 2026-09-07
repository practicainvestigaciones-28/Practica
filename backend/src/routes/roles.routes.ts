import { Router } from "express";
import { autenticar } from "../middlewares/auth.middleware";
import { autorizar } from "../middlewares/authorize.middleware";
import { listarRoles, crearRol, actualizarRol, cambiarEstadoRol } from "../roles/roles.controller";
import { listarPermisosDeRol, asignarPermisosRol } from "../permisos/permisos.controller";

export const rolesRoutes = Router();

rolesRoutes.use(autenticar);

// RQF06 - Gestión de roles: solo Administrador
rolesRoutes.get("/", autorizar("Administrador"), listarRoles);
rolesRoutes.post("/", autorizar("Administrador"), crearRol);
rolesRoutes.put("/:id", autorizar("Administrador"), actualizarRol);
rolesRoutes.patch("/:id/estado", autorizar("Administrador"), cambiarEstadoRol);

// RQF08 - Permisos por rol: solo Administrador
rolesRoutes.get("/:id/permisos", autorizar("Administrador"), listarPermisosDeRol);
rolesRoutes.put("/:id/permisos", autorizar("Administrador"), asignarPermisosRol);
