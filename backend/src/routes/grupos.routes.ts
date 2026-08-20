import { Router } from "express";
import { crearGrupo, listarGrupos, obtenerGrupo } from "../controllers/grupos.controller";
import { autenticar } from "../middlewares/auth.middleware";
import { autorizar } from "../middlewares/authorize.middleware";

export const gruposRoutes = Router();

gruposRoutes.use(autenticar);

gruposRoutes.get("/", listarGrupos);
gruposRoutes.get("/:id", obtenerGrupo);
gruposRoutes.post("/", autorizar("Administrador"), crearGrupo);
