import type { Request, Response, NextFunction } from "express";
import * as service from "./historicos.service";
import { emitirCambio } from "../ws/socket";

function aFecha(v: unknown): Date | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new service.DatosHistoricosInvalidosError(`Fecha inválida: ${String(v)}`);
  return d;
}

/** Convierte las fechas que llegan como texto en el JSON a Date. */
function normalizar(body: Record<string, any>): service.DatosSeguimientoHistorico {
  const a = body.acta_inicio ?? {};
  const f = body.informe_final;
  const c = body.acta_cierre;
  return {
    acta_inicio: {
      ...a,
      fecha_inicio: aFecha(a.fecha_inicio) as Date,
      fecha_acta_aprobacion: aFecha(a.fecha_acta_aprobacion),
    },
    informes_avance: Array.isArray(body.informes_avance)
      ? body.informes_avance.map((i: Record<string, any>) => ({ ...i, fecha_radicacion: aFecha(i.fecha_radicacion) }) as service.DatosInformeAvanceHistorico)
      : undefined,
    informe_final: f ? { ...f, fecha_radicacion: aFecha(f.fecha_radicacion) } : undefined,
    acta_cierre: c
      ? {
          ...c,
          fecha_inicio_real: aFecha(c.fecha_inicio_real),
          fecha_finalizacion_real: aFecha(c.fecha_finalizacion_real),
          fecha_acta: aFecha(c.fecha_acta),
        }
      : undefined,
  };
}

function manejarError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof service.ProyectoHistoricoNoEncontradoError || error instanceof service.DocumentoHistoricoNoEncontradoError) {
    res.status(404).json({ error: "No encontrado", mensaje: error.message });
    return;
  }
  if (error instanceof service.NoPuedeVerHistoricoError) {
    res.status(403).json({ error: "Acceso denegado", mensaje: error.message });
    return;
  }
  if (error instanceof service.ProyectoNoHistoricoError || error instanceof service.SeguimientoHistoricoYaRegistradoError) {
    res.status(409).json({ error: "No permitido", mensaje: error.message });
    return;
  }
  if (error instanceof service.DatosHistoricosInvalidosError || error instanceof service.TipoDocumentoHistoricoInvalidoError) {
    res.status(400).json({ error: "Datos inválidos", mensaje: error.message });
    return;
  }
  next(error);
}

/** POST /api/proyectos/:id/historico/seguimiento — solo Administrador. */
export async function registrarSeguimientoHistorico(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.registrarSeguimientoHistorico(Number(req.params.id), normalizar(req.body ?? {}), req.usuario!.id_usuario);
    emitirCambio("proyectos");
    emitirCambio("seguimiento");
    res.status(201).json({ mensaje: "Seguimiento histórico registrado correctamente", ...resultado });
  } catch (error) {
    manejarError(error, res, next);
  }
}

const sesion = (req: Request) => ({ id_usuario: req.usuario!.id_usuario, roles: req.usuario!.roles });

/** POST /api/proyectos/:id/historico/documentos — solo Administrador (multipart: archivo, tipo, numero_periodo). */
export async function cargarDocumentoHistorico(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Datos incompletos", mensaje: "Debes adjuntar el PDF en el campo 'archivo'" });
      return;
    }
    const { tipo, numero_periodo } = req.body as { tipo?: string; numero_periodo?: string };
    const documento = await service.guardarDocumentoHistorico(
      Number(req.params.id),
      String(tipo ?? ""),
      numero_periodo ? Number(numero_periodo) : null,
      req.file.filename,
      // multer entrega el nombre en latin1: se reinterpreta como UTF-8 para conservar tildes y ñ.
      Buffer.from(req.file.originalname, "latin1").toString("utf8"),
      req.usuario!.id_usuario
    );
    emitirCambio("proyecto-detalle", { id_proyecto: Number(req.params.id) });
    res.status(201).json({ mensaje: "Documento guardado correctamente", documento });
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /api/proyectos/:id/historico/documentos */
export async function listarDocumentosHistoricos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await service.listarDocumentosHistoricos(Number(req.params.id), sesion(req)));
  } catch (error) {
    manejarError(error, res, next);
  }
}

/** GET /api/proyectos/:id/historico/documentos/:idDocumento/descarga */
export async function descargarDocumentoHistorico(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ruta, nombre } = await service.obtenerDocumentoHistoricoParaDescarga(Number(req.params.id), Number(req.params.idDocumento), sesion(req));
    res.download(ruta, nombre, (error) => {
      if (error && !res.headersSent) res.status(404).json({ error: "No encontrado", mensaje: "El archivo no existe en el servidor" });
    });
  } catch (error) {
    manejarError(error, res, next);
  }
}
