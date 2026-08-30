import { Router } from "express";
import {
  crearConvocatoria,
  listarConvocatorias,
  obtenerConvocatoria,
  actualizarConvocatoria,
  cambiarEstadoConvocatoria,
  eliminarConvocatoria,
} from "../convocatorias/convocatorias.controller";
import { autenticar } from "../middlewares/auth.middleware";
import { autorizar } from "../middlewares/authorize.middleware";

export const convocatoriasRoutes = Router();

convocatoriasRoutes.use(autenticar);

// Consulta y listado: cualquier usuario autenticado (un investigador
// necesita ver las convocatorias activas para poder registrar un proyecto).
convocatoriasRoutes.get("/", listarConvocatorias);
convocatoriasRoutes.get("/:id", obtenerConvocatoria);

// Creación, edición y cambio de estado: solo Administrador (RQF09-RQF11).
convocatoriasRoutes.post("/", autorizar("Administrador"), crearConvocatoria);
convocatoriasRoutes.put("/:id", autorizar("Administrador"), actualizarConvocatoria);
convocatoriasRoutes.patch("/:id/estado", autorizar("Administrador"), cambiarEstadoConvocatoria);
convocatoriasRoutes.delete("/:id", autorizar("Administrador"), eliminarConvocatoria);