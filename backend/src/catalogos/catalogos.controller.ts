import type { Request, Response, NextFunction } from "express";
import * as catalogos from "./catalogos.service";

/** Fábrica genérica: crea un handler POST { nombre, descripcion? } -> catálogo */
function crearHandlerSimple(fnCrear: (nombre: string, descripcion?: string) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { nombre, descripcion } = req.body as { nombre?: string; descripcion?: string };
      if (!nombre) {
        res.status(400).json({ error: "Datos incompletos", mensaje: "El nombre es obligatorio" });
        return;
      }
      const registro = await fnCrear(nombre, descripcion);
      res.status(201).json({ mensaje: "Creado correctamente", registro });
    } catch (error) {
      next(error);
    }
  };
}

/** Fábrica genérica: crea un handler GET -> listado del catálogo */
function listarHandlerSimple(fnListar: () => Promise<unknown>) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json(await fnListar());
    } catch (error) {
      next(error);
    }
  };
}

export const crearAreaConocimiento = crearHandlerSimple(catalogos.crearAreaConocimiento);
export const listarAreasConocimiento = listarHandlerSimple(catalogos.listarAreasConocimiento);

export const crearFacultad = crearHandlerSimple((nombre) => catalogos.crearFacultad(nombre));
export const listarFacultades = listarHandlerSimple(catalogos.listarFacultades);

export const crearTipoPrograma = crearHandlerSimple((nombre) => catalogos.crearTipoPrograma(nombre));
export const listarTiposPrograma = listarHandlerSimple(catalogos.listarTiposPrograma);

export const crearTipoGrupo = crearHandlerSimple((nombre) => catalogos.crearTipoGrupo(nombre));
export const listarTiposGrupo = listarHandlerSimple(catalogos.listarTiposGrupo);

export const crearLineaInvestigacion = crearHandlerSimple(catalogos.crearLineaInvestigacion);
export const listarLineasInvestigacion = listarHandlerSimple(catalogos.listarLineasInvestigacion);

export const crearOds = crearHandlerSimple(catalogos.crearOds);
export const listarOds = listarHandlerSimple(catalogos.listarOds);

export const listarProgramas = listarHandlerSimple(catalogos.listarProgramas);

/** POST /api/catalogos/programas — necesita facultad y tipo de programa, no encaja en la fábrica genérica */
export async function crearPrograma(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, id_facultad, id_tipo_programa } = req.body;
    if (!nombre || !id_facultad || !id_tipo_programa) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "nombre, id_facultad y id_tipo_programa son obligatorios",
      });
      return;
    }
    const registro = await catalogos.crearPrograma(nombre, id_facultad, id_tipo_programa);
    res.status(201).json({ mensaje: "Creado correctamente", registro });
  } catch (error) {
    next(error);
  }
}

/* Modalidades de proyecto */
export const crearModalidadProyecto = crearHandlerSimple(catalogos.crearModalidadProyecto);
export const listarModalidadesProyecto = listarHandlerSimple(catalogos.listarModalidadesProyecto);

export const crearTipoProyecto = crearHandlerSimple((nombre) => catalogos.crearTipoProyecto(nombre));
export const listarTiposProyecto = listarHandlerSimple(catalogos.listarTiposProyecto);

/* Periodos */
export const crearPeriodo = crearHandlerSimple((nombre) => catalogos.crearPeriodo(nombre));
export const listarPeriodos = listarHandlerSimple(catalogos.listarPeriodos);

//Docente
export const listarDedicaciones = listarHandlerSimple(catalogos.listarDedicaciones);

//Usuario
export const listarRolesProyecto = listarHandlerSimple(catalogos.listarRolesProyecto);
export const listarRolesEstudiante = listarHandlerSimple(catalogos.listarRolesEstudiante);