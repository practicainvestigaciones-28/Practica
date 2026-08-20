import { Router } from "express";
import { login, logout, perfil, solicitarRecuperacion, restablecerContraseña, cambiarContraseña } from "../controllers/auth.controller";
import { autenticar } from "../middlewares/auth.middleware";

export const authRoutes = Router();

// Públicas
authRoutes.post("/login", login);
authRoutes.post("/recuperar-contrasena", solicitarRecuperacion);
authRoutes.post("/restablecer-contrasena", restablecerContraseña);

// Protegidas (requieren token)
authRoutes.post("/logout", autenticar, logout);
authRoutes.get("/perfil", autenticar, perfil);
authRoutes.patch("/cambiar-contrasena", autenticar, cambiarContraseña);
