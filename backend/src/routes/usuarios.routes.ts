import { Router } from "express";
import { registrarHojaVida, obtenerHojaVida } from "../hoja-vida/hoja-vida.controller";
import {
  buscarUsuarios,
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
} from "../usuarios/usuarios.controller";
import { autenticar } from "../middlewares/auth.middleware";
import { autorizar } from "../middlewares/authorize.middleware";

export const usuariosRoutes = Router();

usuariosRoutes.use(autenticar);

usuariosRoutes.get("/", autorizar("Administrador"), listarUsuarios);
usuariosRoutes.get("/buscar", buscarUsuarios);

// RQF05 - Gestión de usuarios del sistema: solo Administrador
usuariosRoutes.post("/", autorizar("Administrador"), crearUsuario);
usuariosRoutes.put("/:id", autorizar("Administrador"), actualizarUsuario);
usuariosRoutes.patch("/:id/estado", autorizar("Administrador"), cambiarEstadoUsuario);

usuariosRoutes.get("/:id/hoja-vida", obtenerHojaVida);
usuariosRoutes.put("/:id/hoja-vida", registrarHojaVida);