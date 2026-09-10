import { Router } from "express";
import {
  login,
  logout,
  perfil,
  registrarActividad,
  solicitarRecuperacion,
  restablecerContraseña,
  cambiarContraseña,
} from "../auth/auth.controller";
import { autenticar } from "../middlewares/auth.middleware";

export const authRoutes = Router();

// Públicas
authRoutes.post("/login", login);
authRoutes.post("/recuperar-contrasena", solicitarRecuperacion);
authRoutes.post("/restablecer-contrasena", restablecerContraseña);

// Protegidas (requieren token)
authRoutes.post("/logout", autenticar, logout);
authRoutes.get("/perfil", autenticar, perfil);

// RQF04 - Heartbeat: el frontend lo llama al navegar o al interactuar, para
// que el reloj de inactividad refleje que el usuario sigue trabajando aunque
// esa pantalla no consulte la API.
authRoutes.post("/actividad", autenticar, registrarActividad);
authRoutes.patch("/cambiar-contrasena", autenticar, cambiarContraseña);
