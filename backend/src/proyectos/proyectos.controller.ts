import type { Request, Response, NextFunction } from "express";
import * as proyectosService from "./proyectos.service";
import { obtenerParametrosPaginacion, construirRespuestaPaginada } from "../utils/paginacion";

function manejarErrorConocido(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof proyectosService.ConvocatoriaNoEncontradaError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof proyectosService.ConvocatoriaCerradaError) {
    res.status(409).json({ error: "Convocatoria cerrada", mensaje: error.message });
    return;
  }
  if (error instanceof proyectosService.ConvocatoriaVencidaError) {
    res.status(409).json({ error: "Convocatoria vencida", mensaje: error.message });
    return;
  }
  if (error instanceof proyectosService.ProyectoNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof proyectosService.NoAutorizadoError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  if (error instanceof proyectosService.CamposIncompletosError) {
    res.status(400).json({ error: "Datos incompletos", mensaje: error.message, faltantes: error.faltantes });
    return;
  }
  if (error instanceof proyectosService.ResponsableNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  next(error);
}

/** POST /api/proyectos - RQF13 */
export async function crearProyecto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_convocatoria, id_modalidad_proyecto, id_tipo_proyecto, titulo, id_responsable, ...datosProyecto } = req.body;

    if (!id_convocatoria || !id_modalidad_proyecto || !id_tipo_proyecto || !titulo) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "id_convocatoria, id_modalidad_proyecto, id_tipo_proyecto y titulo son obligatorios",
      });
      return;
    }

    // id_responsable: solo lo usa el Administrador al cargar el proyecto de
    // otra persona (p. ej. desde el documento Word) — el proyecto queda
    // atribuido a esa persona, no a quien lo está registrando por ella.
    let idResponsableValidado: number | undefined;
    if (id_responsable !== undefined) {
      if (!req.usuario!.roles.includes("Administrador")) {
        res.status(403).json({ error: "Acceso denegado", mensaje: "Solo un Administrador puede asignar el proyecto a otro responsable" });
        return;
      }
      const idNumerico = Number(id_responsable);
      if (!Number.isInteger(idNumerico) || idNumerico <= 0) {
        res.status(400).json({ error: "Datos incompletos", mensaje: "id_responsable debe ser un número entero válido" });
        return;
      }
      idResponsableValidado = idNumerico;
    }

    const proyecto = await proyectosService.crearProyecto(
      { id_convocatoria, id_modalidad_proyecto, id_tipo_proyecto, titulo, ...datosProyecto },
      req.usuario!.id_usuario,
      idResponsableValidado
    );
    res.status(201).json({ mensaje: "Proyecto registrado correctamente", proyecto });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /api/proyectos?page=&limit= - RQF15 / RQF75 */
export async function listarProyectos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { estado, id_convocatoria, q } = req.query;
    const paginacion = obtenerParametrosPaginacion(req.query);
    const { data, total } = await proyectosService.listarProyectos(
      {
        estado: typeof estado === "string" ? estado : undefined,
        id_convocatoria: id_convocatoria ? Number(id_convocatoria) : undefined,
        q: typeof q === "string" ? q : undefined,
      },
      paginacion
    );
    res.status(200).json(construirRespuestaPaginada(data, total, paginacion));
  } catch (error) {
    next(error);
  }
}

/** GET /api/proyectos/:id */
export async function obtenerProyecto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const proyecto = await proyectosService.obtenerProyecto(Number(req.params.id));
    res.status(200).json(proyecto);
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PUT /api/proyectos/:id - RQF14 */
export async function actualizarProyecto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const proyecto = await proyectosService.actualizarProyecto(Number(req.params.id), req.body, {
      id_usuario: req.usuario!.id_usuario,
      roles: req.usuario!.roles,
    });
    res.status(200).json({ mensaje: "Proyecto actualizado correctamente", proyecto });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}
