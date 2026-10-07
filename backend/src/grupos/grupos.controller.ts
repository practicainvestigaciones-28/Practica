import type { Request, Response, NextFunction } from "express";
import * as gruposService from "./grupos.service";
import { OrdenInvalidoError } from "../utils/ordenManual";

/** POST /api/grupos-investigacion - RQF23. Cualquier usuario autenticado puede
 * crear un grupo nuevo (lo usa el investigador desde el registro de proyecto);
 * editar/desactivar/eliminar sigue restringido al Administrador. */
export async function crearGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, id_tipo_grupo } = req.body;

    if (!nombre || !id_tipo_grupo) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "nombre e id_tipo_grupo son obligatorios" });
      return;
    }

    const grupo = await gruposService.crearGrupo(req.body);
    res.status(201).json({ mensaje: "Grupo de investigación creado correctamente", grupo });
  } catch (error) {
    next(error);
  }
}

/** GET /api/grupos-investigacion */
export async function listarGrupos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const soloActivos = req.query.activo === "true" ? true : undefined;
    res.status(200).json(await gruposService.listarGrupos(soloActivos));
  } catch (error) {
    next(error);
  }
}

function manejarErrorConocido(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof gruposService.GrupoNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof gruposService.GrupoEnUsoError) {
    res.status(409).json({ error: "En uso", mensaje: error.message });
    return;
  }
  if (error instanceof gruposService.NoAutorizadoError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  if (error instanceof OrdenInvalidoError) {
    res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
  next(error);
}

/** GET /api/grupos-investigacion/mios — grupos que administra el líder autenticado. */
export async function listarGruposDeLider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await gruposService.listarGruposDeLider(req.usuario!.id_usuario));
  } catch (error) {
    next(error);
  }
}

/** GET /api/grupos-investigacion/lideres-disponibles — para el selector de asignación. Solo Administrador. */
export async function listarLideresDisponibles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await gruposService.listarLideresDisponibles());
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/grupos-investigacion/reordenar — reordena el catálogo (arrastrar y soltar). Solo Administrador. */
export async function reordenarGrupos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ids } = req.body as { ids?: number[] };
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "number")) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "ids debe ser un arreglo de números" });
      return;
    }
    await gruposService.reordenarGrupos(ids);
    res.status(200).json({ mensaje: "Orden actualizado correctamente" });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PUT /api/grupos-investigacion/:id — editar la información general. Administrador, o el líder asignado a este grupo. */
export async function actualizarGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const datos = req.body as Partial<gruposService.DatosGrupoInvestigacion>;
    if (datos.nombre !== undefined && !datos.nombre.trim()) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "El nombre no puede quedar vacío" });
      return;
    }
    const registro = await gruposService.actualizarGrupo(Number(req.params.id), datos, {
      id_usuario: req.usuario!.id_usuario,
      roles: req.usuario!.roles,
    });
    res.status(200).json({ mensaje: "Actualizado correctamente", registro });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PATCH /api/grupos-investigacion/:id/estado — activar/desactivar. Solo Administrador. */
export async function cambiarEstadoGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { activo } = req.body as { activo?: boolean };
    if (typeof activo !== "boolean") {
      res.status(400).json({ error: "Datos incompletos", mensaje: "activo debe ser true o false" });
      return;
    }
    const registro = await gruposService.cambiarEstadoGrupo(Number(req.params.id), activo);
    res.status(200).json({
      mensaje: activo ? "Activado correctamente" : "Desactivado correctamente",
      registro,
    });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** DELETE /api/grupos-investigacion/:id — borrado real. Solo Administrador. */
export async function eliminarGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await gruposService.eliminarGrupo(Number(req.params.id));
    res.status(200).json({ mensaje: "Eliminado correctamente" });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /api/grupos-investigacion/:id */
export async function obtenerGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const grupo = await gruposService.obtenerGrupo(Number(req.params.id));
    res.status(200).json(grupo);
  } catch (error) {
    if (error instanceof gruposService.GrupoNoEncontradoError) {
      res.status(404).json({ error: "No encontrado", mensaje: error.message });
      return;
    }
    next(error);
  }
}
