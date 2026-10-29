import { Router } from "express";
import { registrarHojaVida, obtenerHojaVida } from "../../hoja-vida/hoja-vida.controller";
import {
  buscarUsuarios,
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  eliminarUsuario,
} from "../../usuarios/usuarios.controller";
import { listarRolesDeUsuario, asignarRolesUsuario } from "../../roles/roles.controller";
import { subirFotoPerfil, obtenerFotoPerfil, quitarFotoPerfil } from "../../usuarios/foto-perfil.controller";
import { selloAdministrador } from "../../usuarios/sello-administrador";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";

export const usuariosRoutes = Router();

usuariosRoutes.use(autenticar);

usuariosRoutes.get("/", autorizar("Administrador"), listarUsuarios);
usuariosRoutes.get("/buscar", buscarUsuarios);

// Foto de perfil del usuario en sesión (cualquier rol).
usuariosRoutes.get("/me/foto", obtenerFotoPerfil);
usuariosRoutes.post("/me/foto", subirFotoPerfil);
usuariosRoutes.delete("/me/foto", quitarFotoPerfil);

// Nombre y cargo del Administrador para el sello de actas e informes (cualquier rol los genera en PDF).
usuariosRoutes.get("/sello-administrador", selloAdministrador);

// RQF05 - Gestión de usuarios del sistema: solo Administrador
usuariosRoutes.post("/", autorizar("Administrador"), crearUsuario);
usuariosRoutes.put("/:id", autorizar("Administrador"), actualizarUsuario);
usuariosRoutes.patch("/:id/estado", autorizar("Administrador"), cambiarEstadoUsuario);
// Borrado definitivo — solo posible si el usuario no tiene nada asociado (ver eliminarUsuario en el servicio).
usuariosRoutes.delete("/:id", autorizar("Administrador"), eliminarUsuario);

usuariosRoutes.get("/:id/hoja-vida", obtenerHojaVida);
usuariosRoutes.put("/:id/hoja-vida", registrarHojaVida);

// RQF07 - Asignación de roles múltiples a un usuario: solo Administrador
usuariosRoutes.get("/:id/roles", autorizar("Administrador"), listarRolesDeUsuario);
usuariosRoutes.put("/:id/roles", autorizar("Administrador"), asignarRolesUsuario);