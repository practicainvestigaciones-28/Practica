import { Router } from "express";
import { bienvenidasPendientes, buscarEstudiante, enviarBienvenidas, sincronizarDocentes, sincronizarEstudiantes } from "../../ruah/ruah.controller";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";

export const ruahRoutes = Router();

ruahRoutes.use(autenticar);

// Quien registra un proyecto (Investigador, o el Administrador a su nombre) busca al estudiante por su código.
ruahRoutes.get("/estudiantes/:codigo", autorizar("Investigador", "Administrador"), buscarEstudiante);
ruahRoutes.post("/sincronizar-docentes", autorizar("Administrador"), sincronizarDocentes);
ruahRoutes.post("/sincronizar-estudiantes", autorizar("Administrador"), sincronizarEstudiantes);
// La bienvenida se envía aparte de la sincronización: primero se ven cuántas cuentas faltan y luego se decide enviarla.
ruahRoutes.get("/bienvenidas-pendientes", autorizar("Administrador"), bienvenidasPendientes);
ruahRoutes.post("/enviar-bienvenidas", autorizar("Administrador"), enviarBienvenidas);
