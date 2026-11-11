import { Router } from "express";
import { buscarEstudiante, sincronizarDocentes, sincronizarEstudiantes } from "../../ruah/ruah.controller";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";

export const ruahRoutes = Router();

ruahRoutes.use(autenticar);

// Quien registra un proyecto (Investigador, o el Administrador a su nombre) busca al estudiante por su código.
ruahRoutes.get("/estudiantes/:codigo", autorizar("Investigador", "Administrador"), buscarEstudiante);
ruahRoutes.post("/sincronizar-docentes", autorizar("Administrador"), sincronizarDocentes);
ruahRoutes.post("/sincronizar-estudiantes", autorizar("Administrador"), sincronizarEstudiantes);
