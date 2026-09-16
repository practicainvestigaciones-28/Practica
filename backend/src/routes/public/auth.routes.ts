import { Router } from "express";
import { login, solicitarRecuperacion, restablecerContraseña } from "../../auth/auth.controller";

export const authRoutesPublic = Router();

authRoutesPublic.post("/login", login);
authRoutesPublic.post("/recuperar-contrasena", solicitarRecuperacion);
authRoutesPublic.post("/restablecer-contrasena", restablecerContraseña);
