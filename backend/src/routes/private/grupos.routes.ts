import { Router } from "express";
import {
  crearGrupo,
  listarGrupos,
  listarGruposDeLider,
  listarLideresDisponibles,
  obtenerGrupo,
  actualizarGrupo,
  cambiarEstadoGrupo,
  eliminarGrupo,
  reordenarGrupos,
} from "../../grupos/grupos.controller";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";

export const gruposRoutes = Router();

gruposRoutes.use(autenticar);

gruposRoutes.get("/", listarGrupos);
gruposRoutes.patch("/reordenar", autorizar("Administrador"), reordenarGrupos);
// Rutas fijas antes de "/:id" para que Express no las confunda con un id.
gruposRoutes.get("/mios", autorizar("Líder de investigación", "Administrador"), listarGruposDeLider);
gruposRoutes.get("/lideres-disponibles", autorizar("Administrador"), listarLideresDisponibles);
gruposRoutes.get("/:id", obtenerGrupo);
// Crear SÍ es de cualquier usuario autenticado (no solo Administrador): el
// formulario de registro de proyecto (pestaña "Grupos y egresados") deja que
// el propio investigador escriba un grupo nuevo si el suyo todavía no existe
// en el catálogo — editar/desactivar/eliminar sigue siendo solo del Admin o
// del líder asignado a ESE grupo (ver permiso fino en grupos.service.ts).
gruposRoutes.post("/", crearGrupo);
gruposRoutes.put("/:id", autorizar("Administrador", "Líder de investigación"), actualizarGrupo);
gruposRoutes.patch("/:id/estado", autorizar("Administrador"), cambiarEstadoGrupo);
gruposRoutes.delete("/:id", autorizar("Administrador"), eliminarGrupo);
