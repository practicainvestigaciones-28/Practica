import { Router } from "express";
import { registrarHojaVida, obtenerHojaVida } from "../hoja-vida/hoja-vida.controller";
import { buscarUsuarios, listarUsuarios } from "../usuarios/usuarios.controller";
import { autenticar } from "../middlewares/auth.middleware";
import { autorizar } from "../middlewares/authorize.middleware";

export const usuariosRoutes = Router();

usuariosRoutes.use(autenticar);

usuariosRoutes.get("/", autorizar("Administrador"), listarUsuarios);
usuariosRoutes.get("/buscar", buscarUsuarios);
usuariosRoutes.get("/:id/hoja-vida", obtenerHojaVida);
usuariosRoutes.put("/:id/hoja-vida", registrarHojaVida);