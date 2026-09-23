import { Router } from "express";
import {
  crearConvocatoria,
  listarConvocatorias,
  obtenerConvocatoria,
  actualizarConvocatoria,
  cambiarEstadoConvocatoria,
  eliminarConvocatoria,
} from "../../convocatorias/convocatorias.controller";
import {
  obtenerOpciones,
  reemplazarOpciones,
  obtenerLimitesTexto,
  reemplazarLimitesTexto,
} from "../../convocatorias/convocatoria-opciones.controller";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";

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

// Selección por convocatoria: qué catálogos puede elegir un investigador al
// crear un proyecto bajo esta convocatoria. Lectura abierta (Crear Proyecto
// la necesita); escritura solo Administrador.
convocatoriasRoutes.get("/:id/opciones", obtenerOpciones);
convocatoriasRoutes.put("/:id/opciones", autorizar("Administrador"), reemplazarOpciones);
convocatoriasRoutes.get("/:id/limites-texto", obtenerLimitesTexto);
convocatoriasRoutes.put("/:id/limites-texto", autorizar("Administrador"), reemplazarLimitesTexto);