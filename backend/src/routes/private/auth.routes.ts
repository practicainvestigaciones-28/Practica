import { Router } from "express";
import { logout, perfil, registrarActividad, cambiarContraseña } from "../../auth/auth.controller";
import { autenticar } from "../../middlewares/auth.middleware";

export const authRoutesPrivate = Router();

authRoutesPrivate.use(autenticar);

authRoutesPrivate.post("/logout", logout);
authRoutesPrivate.get("/perfil", perfil);

// RQF04 - Heartbeat: el frontend lo llama al navegar o al interactuar, para
// que el reloj de inactividad refleje que el usuario sigue trabajando aunque
// esa pantalla no consulte la API.
authRoutesPrivate.post("/actividad", registrarActividad);
authRoutesPrivate.patch("/cambiar-contrasena", cambiarContraseña);
