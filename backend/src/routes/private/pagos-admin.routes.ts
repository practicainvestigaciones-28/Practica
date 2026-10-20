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

// Registrar el pago de una evaluación.
pagosAdminRoutes.put("/evaluaciones/:idEvaluacion/pago", pagos.registrarPago);

// Certificado de participación (PDF) y correo de agradecimiento — exige
// tener certificado cargado, y es el envío del correo el que marca el pago
// como realizado (ver enviarAgradecimientoPago).
pagosAdminRoutes.post("/pagos/:idPago/certificado", uploadDocumento.single("archivo"), pagos.subirCertificado);
pagosAdminRoutes.get("/pagos/:idPago/certificado", pagos.descargarCertificado);
pagosAdminRoutes.post("/pagos/:idPago/agradecimiento", pagos.enviarAgradecimiento);
