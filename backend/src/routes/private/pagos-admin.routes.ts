import { Router } from "express";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";
import { uploadDocumento } from "../../config/upload";
import * as pagos from "../../pagos/pagos.controller";

export const pagosAdminRoutes = Router();

pagosAdminRoutes.use(autenticar);
pagosAdminRoutes.use(autorizar("Administrador"));

// Resumen de todos los pares evaluadores (cuántos proyectos evaluó cada uno, cuántos pagos quedan pendientes).
pagosAdminRoutes.get("/pares", pagos.listarPares);

// Datos/documentos bancarios de un par concreto (los mismos que él registra en su propia vista).
pagosAdminRoutes.get("/pares/:idUsuario/datos-bancarios", pagos.obtenerDatosBancariosDePar);
pagosAdminRoutes.get("/pares/:idUsuario/documentos/:tipo", pagos.descargarDocumentoDePar);

// Evaluaciones de Pares de ese par, con el estado de pago de cada una.
pagosAdminRoutes.get("/pares/:idUsuario/evaluaciones", pagos.listarEvaluacionesDePar);

// Registrar el pago de una evaluación, y su comprobante.
pagosAdminRoutes.put("/evaluaciones/:idEvaluacion/pago", pagos.registrarPago);
pagosAdminRoutes.post("/pagos/:idPago/comprobante", uploadDocumento.single("archivo"), pagos.subirComprobante);
pagosAdminRoutes.get("/pagos/:idPago/comprobante", pagos.descargarComprobante);
