import { Router } from "express";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";
import * as pagos from "../../pagos/pagos.controller";

export const pagosRoutes = Router();

pagosRoutes.use(autenticar);

// Datos bancarios propios del par evaluador logueado — cada quien registra y
// edita solo los suyos, no hace falta id en la ruta.
pagosRoutes.get("/datos-bancarios", autorizar("Par Evaluador"), pagos.obtenerMisDatosBancarios);
pagosRoutes.put("/datos-bancarios", autorizar("Par Evaluador"), pagos.guardarMisDatosBancarios);
