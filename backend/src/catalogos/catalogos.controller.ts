import type { Request, Response, NextFunction } from "express";
import * as catalogos from "./catalogos.service";

function manejarErrorConocido(error: unknown, res: Response, next: NextFunction): void {
  if (
    error instanceof catalogos.ProgramaNoEncontradoError ||
    error instanceof catalogos.LineaInvestigacionNoEncontradaError ||
    error instanceof catalogos.ModalidadProyectoNoEncontradaError ||
    error instanceof catalogos.TipoProyectoNoEncontradoError
  ) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  next(error);
}

/** Fábrica genérica: crea un handler PUT { nombre } -> catálogo actualizado */
function actualizarHandlerSimple(fnActualizar: (id: number, nombre: string) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { nombre } = req.body as { nombre?: string };
      if (!nombre) {
        res.status(400).json({ error: "Datos incompletos", mensaje: "El nombre es obligatorio" });
        return;
      }
      const registro = await fnActualizar(Number(req.params.id), nombre);
      res.status(200).json({ mensaje: "Actualizado correctamente", registro });
    } catch (error) {
      manejarErrorConocido(error, res, next);
    }
  };
}

/** Fábrica genérica: crea un handler PATCH .../estado { activo } -> catálogo actualizado */
function cambiarEstadoHandlerSimple(
  fnCambiarEstado: (id: number, activo: boolean) => Promise<unknown>,
  campoActivo = "activo"
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const activo = (req.body as Record<string, unknown>)[campoActivo];
      if (typeof activo !== "boolean") {
        res.status(400).json({ error: "Datos incompletos", mensaje: `${campoActivo} debe ser true o false` });
        return;
      }
      const registro = await fnCambiarEstado(Number(req.params.id), activo);
      res.status(200).json({
        mensaje: activo ? "Activado correctamente" : "Desactivado correctamente",
        registro,
      });
    } catch (error) {
      manejarErrorConocido(error, res, next);
    }
  };
}

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
export const actualizarLineaInvestigacion = actualizarHandlerSimple(catalogos.actualizarLineaInvestigacion);
export const cambiarEstadoLineaInvestigacion = cambiarEstadoHandlerSimple(
  catalogos.cambiarEstadoLineaInvestigacion,
  "activa"
);

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

/** PUT /api/catalogos/programas/:id — editar nombre. Solo Administrador. */
export async function actualizarPrograma(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre } = req.body as { nombre?: string };
    if (!nombre) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "El nombre es obligatorio" });
      return;
    }
    const registro = await catalogos.actualizarPrograma(Number(req.params.id), nombre);
    res.status(200).json({ mensaje: "Actualizado correctamente", registro });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PATCH /api/catalogos/programas/:id/estado — activar/desactivar. Solo Administrador. */
export async function cambiarEstadoPrograma(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { activo } = req.body as { activo?: boolean };
    if (typeof activo !== "boolean") {
      res.status(400).json({ error: "Datos incompletos", mensaje: "activo debe ser true o false" });
      return;
    }
    const registro = await catalogos.cambiarEstadoPrograma(Number(req.params.id), activo);
    res.status(200).json({
      mensaje: activo ? "Programa activado correctamente" : "Programa desactivado correctamente",
      registro,
    });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/* Modalidades de proyecto */
export const crearModalidadProyecto = crearHandlerSimple(catalogos.crearModalidadProyecto);
export const listarModalidadesProyecto = listarHandlerSimple(catalogos.listarModalidadesProyecto);
export const actualizarModalidadProyecto = actualizarHandlerSimple(catalogos.actualizarModalidadProyecto);
export const cambiarEstadoModalidadProyecto = cambiarEstadoHandlerSimple(catalogos.cambiarEstadoModalidadProyecto);

export const crearTipoProyecto = crearHandlerSimple((nombre) => catalogos.crearTipoProyecto(nombre));
export const listarTiposProyecto = listarHandlerSimple(catalogos.listarTiposProyecto);
export const actualizarTipoProyecto = actualizarHandlerSimple(catalogos.actualizarTipoProyecto);
export const cambiarEstadoTipoProyecto = cambiarEstadoHandlerSimple(catalogos.cambiarEstadoTipoProyecto);

/* Periodos */
export const crearPeriodo = crearHandlerSimple((nombre) => catalogos.crearPeriodo(nombre));
export const listarPeriodos = listarHandlerSimple(catalogos.listarPeriodos);

//Docente
export const listarDedicaciones = listarHandlerSimple(catalogos.listarDedicaciones);

//Usuario
export const listarRolesProyecto = listarHandlerSimple(catalogos.listarRolesProyecto);
export const listarRolesEstudiante = listarHandlerSimple(catalogos.listarRolesEstudiante);