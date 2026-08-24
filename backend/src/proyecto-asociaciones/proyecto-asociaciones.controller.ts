import type { Request, Response, NextFunction } from "express";
import * as asociaciones from "./proyecto-asociaciones.service";

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (
    error instanceof asociaciones.ProyectoNoEncontradoError ||
    error instanceof asociaciones.AsociacionNoEncontradaError
  ) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof asociaciones.NoAutorizadoProyectoError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  if (error instanceof asociaciones.RegistroDuplicadoError) {
    res.status(409).json({ error: "Duplicado", mensaje: error.message });
    return;
  }
  next(error);
}

function usuarioReq(req: Request) {
  return { id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles };
}

// RQF19 - Áreas de conocimiento
export async function agregarArea(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_area_conocimiento } = req.body;
    if (!id_area_conocimiento) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_area_conocimiento es obligatorio" });
      return;
    }
    const registro = await asociaciones.agregarArea(Number(req.params.id), id_area_conocimiento, usuarioReq(req));
    res.status(201).json({ mensaje: "Área asociada correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function listarAreas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await asociaciones.listarAreas(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function quitarArea(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await asociaciones.quitarArea(Number(req.params.id), Number(req.params.idArea), usuarioReq(req));
    res.status(200).json({ mensaje: "Área removida correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}

// RQF20 - Programas académicos
export async function agregarPrograma(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_programa, programa_otro } = req.body;
    if (!id_programa && !programa_otro) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "Envía id_programa (catálogo) o programa_otro (texto libre)",
      });
      return;
    }
    const registro = await asociaciones.agregarPrograma(
      Number(req.params.id),
      { id_programa, programa_otro },
      usuarioReq(req)
    );
    res.status(201).json({ mensaje: "Programa asociado correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function listarProgramas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await asociaciones.listarProgramas(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function quitarPrograma(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await asociaciones.quitarPrograma(Number(req.params.id), Number(req.params.idPrograma), usuarioReq(req));
    res.status(200).json({ mensaje: "Programa removido correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}

// RQF22 - Financiación
export async function registrarFinanciacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { valor_solicitado_unicesmag, valor_contrapartida } = req.body;
    if (valor_solicitado_unicesmag === undefined) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "valor_solicitado_unicesmag es obligatorio",
      });
      return;
    }
    const registro = await asociaciones.registrarFinanciacion(
      Number(req.params.id),
      { valor_solicitado_unicesmag, valor_contrapartida },
      usuarioReq(req)
    );
    res.status(200).json({ mensaje: "Financiación registrada correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function obtenerFinanciacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const registro = await asociaciones.obtenerFinanciacion(Number(req.params.id));
    if (!registro) {
      res.status(404).json({ error: "No encontrado", mensaje: "Este proyecto aún no tiene financiación registrada" });
      return;
    }
    res.status(200).json(registro);
  } catch (error) {
    manejarError(error, res, next);
  }
}

// RQF23 / RQF25 - Grupos de investigación, línea y ODS
export async function agregarGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_grupo, id_linea_investigacion, id_ods } = req.body;
    if (!id_grupo) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "id_grupo es obligatorio" });
      return;
    }
    const registro = await asociaciones.agregarGrupo(
      Number(req.params.id),
      { id_grupo, id_linea_investigacion, id_ods },
      usuarioReq(req)
    );
    res.status(201).json({ mensaje: "Grupo asociado correctamente", registro });
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function listarGruposDelProyecto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await asociaciones.listarGruposDelProyecto(Number(req.params.id)));
  } catch (error) {
    manejarError(error, res, next);
  }
}
export async function quitarGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await asociaciones.quitarGrupo(Number(req.params.id), Number(req.params.idGrupo), usuarioReq(req));
    res.status(200).json({ mensaje: "Grupo removido correctamente" });
  } catch (error) {
    manejarError(error, res, next);
  }
}
