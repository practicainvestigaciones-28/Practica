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
    if (error instanceof usuariosService.UsuarioConDatosAsociadosError) {
        res.status(409).json({ error: "Usuario con datos asociados", mensaje: error.message });
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
        const { nombre, apellido, correo, roles, codigo, cedula } = req.body as {
            nombre?: string;
            apellido?: string;
            correo?: string;
            roles?: string[];
            codigo?: string;
            cedula?: string;
        };

        if (!nombre || !apellido || !correo || !roles || roles.length === 0) {
            res.status(400).json({
                error: "Datos incompletos",
                mensaje: "nombre, apellido, correo y al menos un rol son obligatorios",
            });
            return;
        }

        const usuario = await usuariosService.crearUsuario({ nombre, apellido, correo, roles, codigo, cedula });
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

        // RQF05 - un administrador no puede desactivar su propia cuenta: se
        // quedaría sin poder volver a entrar (el login bloquea cuentas
        // inactivas) y sin nadie más para reactivarla desde la app.
        if (!activo && Number(req.params.id) === req.usuario!.id_usuario) {
            res.status(409).json({
                error: "Operación no permitida",
                mensaje: "No puedes desactivar tu propia cuenta.",
            });
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

/**
 * DELETE /api/usuarios/:id - RQF05, solo Administrador. Borrado definitivo,
 * solo si el usuario no tiene nada asociado en el sistema (ver
 * eliminarUsuario) — si tiene algo, usa PATCH /:id/estado para desactivarlo.
 */
export async function eliminarUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // Mismo motivo que al desactivar: un administrador no puede borrar su
        // propia cuenta desde aquí.
        if (Number(req.params.id) === req.usuario!.id_usuario) {
            res.status(409).json({
                error: "Operación no permitida",
                mensaje: "No puedes eliminar tu propia cuenta.",
            });
            return;
        }

        await usuariosService.eliminarUsuario(Number(req.params.id));
        res.status(200).json({ mensaje: "Usuario eliminado correctamente" });
    } catch (error) {
        manejarError(error, res, next);
    }
}
