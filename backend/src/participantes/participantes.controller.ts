import type { Request, Response, NextFunction } from "express";
import * as participantesService from "./participantes.service";

function manejarErrorConocido(error: unknown, res: Response, next: NextFunction): void {
  if (
    error instanceof participantesService.ProyectoNoEncontradoError ||
    error instanceof participantesService.ParticipacionNoEncontradaError
  ) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof participantesService.NoAutorizadoError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  if (
    error instanceof participantesService.UsuarioNoEncontradoError ||
    error instanceof participantesService.CatalogoInvalidoError ||
    error instanceof participantesService.RolEstudianteNoAplicaError
  ) {
    res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
  if (error instanceof participantesService.ParticipanteDuplicadoError) {
    res.status(409).json({ error: "Duplicado", mensaje: error.message });
    return;
  }
  next(error);
}

/** POST /api/proyectos/:id/participantes - RQF17 */
export async function agregarParticipante(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { participante, id_dedicacion, id_rol_pro, id_rol_estudiante } = req.body;

    if (!participante || !id_dedicacion || !id_rol_pro) {
      res.status(400).json({
        error: "Datos incompletos",
        mensaje: "participante, id_dedicacion y id_rol_pro son obligatorios",
      });
      return;
    }

    const registro = await participantesService.agregarParticipante(
      Number(req.params.id),
      { participante, id_dedicacion, id_rol_pro, id_rol_estudiante },
      { id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles }
    );

    res.status(201).json({ mensaje: "Participante agregado correctamente", participante: registro });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /api/proyectos/:id/participantes */
export async function listarParticipantes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const participantes = await participantesService.listarParticipantes(Number(req.params.id));
    res.status(200).json(participantes);
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PUT /api/proyectos/:id/participantes/:idParticipante */
export async function actualizarParticipante(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_dedicacion, id_rol_pro, id_rol_estudiante } = req.body;

    const registro = await participantesService.actualizarParticipante(
      Number(req.params.id),
      Number(req.params.idParticipante),
      { id_dedicacion, id_rol_pro, id_rol_estudiante },
      { id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles }
    );

    res.status(200).json({ mensaje: "Participante actualizado correctamente", participante: registro });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** DELETE /api/proyectos/:id/participantes/:idParticipante */
export async function quitarParticipante(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await participantesService.quitarParticipante(
      Number(req.params.id),
      Number(req.params.idParticipante),
      { id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles }
    );

    res.status(200).json({ mensaje: "Participante removido correctamente" });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PUT /api/proyectos/:id/participantes/:idParticipante/egresado - RQF24 */
export async function registrarEgresado(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const registro = await participantesService.registrarEgresado(
      Number(req.params.id),
      Number(req.params.idParticipante),
      req.body,
      { id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles }
    );
    res.status(200).json({ mensaje: "Información de egresado registrada correctamente", registro });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /api/proyectos/:id/participantes/:idParticipante/egresado */
export async function obtenerEgresado(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const registro = await participantesService.obtenerEgresado(
      Number(req.params.id),
      Number(req.params.idParticipante)
    );
    if (!registro) {
      res.status(404).json({ error: "No encontrado", mensaje: "Este participante no tiene información de egresado" });
      return;
    }
    res.status(200).json(registro);
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}
