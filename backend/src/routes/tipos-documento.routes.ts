import { Router } from "express";
import * as tiposDoc from "../controllers/tipos-documento.controller";
import { autenticar } from "../middlewares/auth.middleware";
import { autorizar } from "../middlewares/authorize.middleware";

export const tiposDocumentoRoutes = Router();

tiposDocumentoRoutes.use(autenticar);

// Consulta: cualquier autenticado (el frontend arma el formulario de carga con esto)
tiposDocumentoRoutes.get("/etapas", tiposDoc.listarEtapas);
tiposDocumentoRoutes.get("/", tiposDoc.listarTiposDocumento);

// Gestión del catálogo: solo Administrador (RQF36)
tiposDocumentoRoutes.post("/etapas", autorizar("Administrador"), tiposDoc.crearEtapa);
tiposDocumentoRoutes.post("/", autorizar("Administrador"), tiposDoc.crearTipoDocumento);
tiposDocumentoRoutes.put("/:id", autorizar("Administrador"), tiposDoc.actualizarTipoDocumento);
