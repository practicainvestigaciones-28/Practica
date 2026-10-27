import type { NextFunction, Request, Response } from "express";
import * as service from "./acta-inicio.service";
import type { DatosActa } from "./acta-inicio.reglas";

function manejarErrorConocido(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof service.ProyectoNoEncontradoError || error instanceof service.ActaNoEncontradaError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof service.NoAutorizadoActaError) {
    res.status(403).json({ error: "No autorizado", mensaje: error.message });
    return;
  }
  if (error instanceof service.EstadoActaInvalidoError) {
    res.status(409).json({ error: "Conflicto", mensaje: error.message });
    return;
  }
  if (error instanceof service.ActaInvalidaError) {
    res.status(422).json({ error: "Acta incompleta", mensaje: error.message, faltantes: error.faltantes });
    return;
  }
  if (error instanceof service.CodigoFirmaInvalidoError) {
    res.status(400).json({ error: "Código no válido", mensaje: error.message });
    return;
  }
  if (error instanceof service.EnlaceFirmaInvalidoError) {
    res.status(404).json({ error: "Enlace no válido", mensaje: error.message });
    return;
  }
  next(error);
}

const sesion = (req: Request): service.UsuarioSesion => ({ id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles });

/** GET /api/acta-inicio */
export async function listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.listarActas(sesion(req)));
  } catch (error) {
    next(error);
  }
}

/** GET /api/acta-inicio/estados */
export async function estados(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.estadosActas());
  } catch (error) {
    next(error);
  }
}

/** GET /api/acta-inicio/proyecto/:id */
export async function obtener(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.obtenerActa(Number(req.params.id), sesion(req)));
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PUT /api/acta-inicio/proyecto/:id */
export async function guardarDatos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const datos = req.body as Partial<DatosActa>;
    const completos: DatosActa = {
      tipo_proyecto: String(datos.tipo_proyecto ?? ""),
      numero_acta_aprobacion: String(datos.numero_acta_aprobacion ?? ""),
      fecha_acta_aprobacion: String(datos.fecha_acta_aprobacion ?? ""),
      centro_costos: String(datos.centro_costos ?? ""),
      fecha_inicio: String(datos.fecha_inicio ?? ""),
      duracion_meses: Number(datos.duracion_meses ?? 0),
      vigencias: Array.isArray(datos.vigencias)
        ? datos.vigencias.map((v) => ({ anio: Number(v.anio), valor_asignado: Number(v.valor_asignado) }))
        : [],
    };
    res.status(200).json(await service.guardarDatos(Number(req.params.id), completos, sesion(req)));
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PATCH /api/acta-inicio/proyecto/:id/participantes/:idUsuarioProyecto */
export async function guardarContacto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const detalle = await service.guardarContacto(
      Number(req.params.id),
      Number(req.params.idUsuarioProyecto),
      req.body as Record<string, string | null>,
      sesion(req)
    );
    res.status(200).json(detalle);
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** POST /api/acta-inicio/:id/generar */
export async function generar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { vicerrector_nombre, vicerrector_correo } = (req.body ?? {}) as { vicerrector_nombre?: string; vicerrector_correo?: string };
    res.status(200).json(
      await service.generarActa(Number(req.params.id), sesion(req), { nombre: vicerrector_nombre, correo: vicerrector_correo })
    );
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** POST /api/acta-inicio/:id/reabrir */
export async function reabrir(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.reabrirActa(Number(req.params.id), sesion(req)));
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** POST /api/acta-inicio/:id/compromisos */
export async function aceptarCompromisos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clausulas, version_texto } = req.body as { clausulas?: string[]; version_texto?: string };
    const detalle = await service.aceptarCompromisos(
      Number(req.params.id),
      Array.isArray(clausulas) ? clausulas.map(String) : [],
      version_texto,
      sesion(req)
    );
    res.status(200).json(detalle);
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** POST /api/acta-inicio/:id/firmar */
export async function firmar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { codigo } = (req.body ?? {}) as { codigo?: string };
    res.status(200).json(await service.firmarActa(Number(req.params.id), sesion(req), codigo));
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** PATCH /api/acta-inicio/:id/vicerrector */
export async function actualizarVicerrector(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, correo } = (req.body ?? {}) as { nombre?: string; correo?: string };
    res.status(200).json(await service.actualizarVicerrector(Number(req.params.id), { nombre, correo }, sesion(req)));
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** POST /api/acta-inicio/:id/reenviar-firma */
export async function reenviarFirma(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.reenviarSolicitudes(Number(req.params.id), sesion(req)));
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** POST /api/acta-inicio/:id/firma/codigo */
export async function solicitarCodigo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.solicitarCodigoFirmaActa(Number(req.params.id), sesion(req)));
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** POST /api/acta-inicio/proyecto/:id/codigo-firma — código para firmar en Seguimiento. */
export async function solicitarCodigoSeguimiento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { documento } = (req.body ?? {}) as { documento?: string };
    res.status(200).json(await service.solicitarCodigoSeguimiento(Number(req.params.id), sesion(req), documento));
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** POST /api/acta-inicio/proyecto/:id/codigo-firma/verificar */
export async function verificarCodigoSeguimiento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { codigo } = (req.body ?? {}) as { codigo?: string };
    res.status(200).json(await service.verificarCodigoSeguimiento(Number(req.params.id), sesion(req), codigo));
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** GET /api/firma-acta/:token — público: a quién corresponde el enlace y si pide código. */
export async function infoEnlace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.infoFirmaPorEnlace(String(req.params.token)));
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** POST /api/firma-acta/:token/codigo — público: envía el código al correo personal. */
export async function solicitarCodigoEnlace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.solicitarCodigoPorEnlace(String(req.params.token)));
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}

/** POST /api/firma-acta/:token — público: el enlace del correo firma directo. */
export async function firmarPorEnlace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { codigo } = (req.body ?? {}) as { codigo?: string };
    const resultado = await service.firmarPorEnlace(String(req.params.token), codigo);
    res.status(200).json({
      mensaje: resultado.ya_firmado ? "Esta firma ya estaba registrada" : "Firma registrada correctamente",
      ...resultado,
    });
  } catch (error) {
    manejarErrorConocido(error, res, next);
  }
}
