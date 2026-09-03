import type { Request, Response, NextFunction } from "express";
import * as usuariosService from "./usuarios.service";
import { obtenerParametrosPaginacion, construirRespuestaPaginada } from "../utils/paginacion";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof usuariosService.UsuarioNoEncontradoError) {
        res.status(404).json({ error: "No encontrado", mensaje: error.message });
        return;
    }
    if (error instanceof usuariosService.CorreoDuplicadoError) {
        res.status(409).json({ error: "Correo duplicado", mensaje: error.message });
        return;
    }
    if (error instanceof usuariosService.RolInvalidoError) {
        res.status(400).json({ error: "Rol inválido", mensaje: error.message });
        return;
    }
    next(error);
}

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

/** POST /api/usuarios - RQF05, solo Administrador */
export async function crearUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { nombre, apellido, correo, contraseña, rol, codigo, cedula } = req.body as {
            nombre?: string;
            apellido?: string;
            correo?: string;
            contraseña?: string;
            rol?: string;
            codigo?: string;
            cedula?: string;
        };

        if (!nombre || !apellido || !correo || !contraseña || !rol) {
            res.status(400).json({
                error: "Datos incompletos",
                mensaje: "nombre, apellido, correo, contraseña y rol son obligatorios",
            });
            return;
        }

        const usuario = await usuariosService.crearUsuario({ nombre, apellido, correo, contraseña, rol, codigo, cedula });
        res.status(201).json({ mensaje: "Usuario registrado correctamente", usuario });
    } catch (error) {
        manejarError(error, res, next);
    }
}

/** PUT /api/usuarios/:id - RQF05, solo Administrador */
export async function actualizarUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const usuario = await usuariosService.actualizarUsuario(Number(req.params.id), req.body);
        res.status(200).json({ mensaje: "Usuario actualizado correctamente", usuario });
    } catch (error) {
        manejarError(error, res, next);
    }
}

/** PATCH /api/usuarios/:id/estado - RQF05, solo Administrador */
export async function cambiarEstadoUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { activo } = req.body as { activo?: boolean };
        if (typeof activo !== "boolean") {
            res.status(400).json({ error: "Datos incompletos", mensaje: "activo debe ser true o false" });
            return;
        }

        const usuario = await usuariosService.cambiarEstadoUsuario(Number(req.params.id), activo);
        res.status(200).json({
            mensaje: activo ? "Usuario activado correctamente" : "Usuario desactivado correctamente",
            usuario,
        });
    } catch (error) {
        manejarError(error, res, next);
    }
}
