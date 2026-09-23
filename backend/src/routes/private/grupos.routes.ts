import { Router } from "express";
import {
  crearGrupo,
  listarGrupos,
  obtenerGrupo,
  actualizarGrupo,
  cambiarEstadoGrupo,
  eliminarGrupo,
} from "../../grupos/grupos.controller";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";

export const gruposRoutes = Router();

gruposRoutes.use(autenticar);

gruposRoutes.get("/", listarGrupos);
gruposRoutes.get("/:id", obtenerGrupo);
gruposRoutes.post("/", autorizar("Administrador"), crearGrupo);
gruposRoutes.put("/:id", autorizar("Administrador"), actualizarGrupo);
gruposRoutes.patch("/:id/estado", autorizar("Administrador"), cambiarEstadoGrupo);
gruposRoutes.delete("/:id", autorizar("Administrador"), eliminarGrupo);
