import { Router } from "express";
import { autenticar } from "../../middlewares/auth.middleware";
import { autorizar } from "../../middlewares/authorize.middleware";
import { uploadDocumento } from "../../config/upload";
import * as pagos from "../../pagos/pagos.controller";

export const pagosRoutes = Router();

pagosRoutes.use(autenticar);
pagosRoutes.use(autorizar("Par Evaluador"));

// Datos bancarios propios del par evaluador logueado — cada quien registra y
// edita solo los suyos, no hace falta id en la ruta.
pagosRoutes.get("/datos-bancarios", pagos.obtenerMisDatosBancarios);
pagosRoutes.put("/datos-bancarios", pagos.guardarMisDatosBancarios);

// Documentos de soporte (RUT, certificación bancaria, cédula).
pagosRoutes.post("/datos-bancarios/documentos/:tipo", uploadDocumento.single("archivo"), pagos.subirMiDocumentoPago);
pagosRoutes.get("/datos-bancarios/documentos/:tipo", pagos.descargarMiDocumentoPago);

// Historial de pagos por las evaluaciones de Pares realizadas.
pagosRoutes.get("/historial", pagos.obtenerMiHistorialPagos);
pagosRoutes.get("/historial/:idPago/comprobante", pagos.descargarMiComprobante);
