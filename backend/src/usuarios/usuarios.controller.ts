import type { Request, Response, NextFunction } from "express";
import * as usuariosService from "./usuarios.service";
import { obtenerParametrosPaginacion, construirRespuestaPaginada } from "../utils/paginacion";

/** GET /api/usuarios/buscar?q=... */
export async function buscarUsuarios(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const q = typeof req.query.q === "string" ? req.query.q : "";
        const usuarios = await usuariosService.buscarUsuarios(q);
        res.status(200).json(usuarios);
    } catch (error) {
        next(error);
    }
}

/** GET /api/usuarios?page=&limit= — listado paginado, solo Administrador */
export async function listarUsuarios(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const paginacion = obtenerParametrosPaginacion(req.query);
        const { data, total } = await usuariosService.listarUsuarios(paginacion);
        res.status(200).json(construirRespuestaPaginada(data, total, paginacion));
    } catch (error) {
        next(error);
    }
}